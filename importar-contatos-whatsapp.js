// ============================================================
// importar-contatos-whatsapp.js
// Importa contatos do WhatsApp CSV para o CRM La Reserva
// Ignora automaticamente contatos que já existem no banco
// ============================================================
// Como usar:
//   1. Coloque o CSV na mesma pasta deste script
//   2. Instale dependências: npm install @supabase/supabase-js papaparse
//   3. Configure as variáveis SUPABASE_URL e SUPABASE_SERVICE_KEY abaixo
//   4. Execute: node importar-contatos-whatsapp.js
// ============================================================

import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';

// ------------------------------------------------------------
// ⚙️  CONFIGURAÇÃO — preencha com suas credenciais do Supabase
// Encontre em: Supabase Dashboard → Project Settings → API
// ------------------------------------------------------------
const SUPABASE_URL        = 'https://lmvdruvmpybutmmidrfp.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdmRydXZtcHlidXRtbWlkcmZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY4MDk3MCwiZXhwIjoyMDg5MjU2OTcwfQ.OzGjaBbEbK8sb5Z0tWazUbb6MUcW7a_6XuTyF_rJaVQ'; // usa service_role para bypassar RLS

// Nome do arquivo CSV (deve estar na mesma pasta que este script)
const CSV_FILENAME = 'WA-Contact-Export-Chat- 11_05_2026, 15_30_31.csv';

// ------------------------------------------------------------
// Inicializa cliente Supabase com service_role (bypassa RLS)
// ------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// ------------------------------------------------------------
// Utilitários
// ------------------------------------------------------------

/**
 * Converte o número do CSV para formato E.164 (+5528999999999)
 * O campo "Phone" do CSV já vem sem o "+", ex: 5528998863284
 */
function formatPhone(rawPhone) {
  const digits = String(rawPhone).replace(/\D/g, '');
  return '+' + digits;
}

/**
 * Normaliza o nome: remove espaços extras, limpa emojis problemáticos
 * Se for "Unknown", retorna null para o campo city ficar em branco
 */
function formatName(name) {
  if (!name || name.trim() === 'Unknown') return 'Contato WhatsApp';
  return name.trim();
}

/**
 * Extrai cidade/país a partir do campo Phone Number Location
 */
function formatLocation(location) {
  if (!location || location === 'Unknown') return null;
  return location.trim();
}

// ------------------------------------------------------------
// Função principal
// ------------------------------------------------------------
async function importarContatos() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Importador de Contatos WhatsApp → CRM La Reserva');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Ler o CSV
  const csvPath = path.resolve(CSV_FILENAME);
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Arquivo não encontrado: ${csvPath}`);
    console.error('   Coloque o CSV na mesma pasta que este script.');
    process.exit(1);
  }

  console.log(`📂 Lendo arquivo: ${CSV_FILENAME}`);
  const csvContent = fs.readFileSync(csvPath, 'utf8');

  const { data: rows, errors } = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  if (errors.length > 0) {
    console.warn(`⚠️  ${errors.length} linha(s) com erro de parsing foram ignoradas.`);
  }

  console.log(`📊 Total de linhas no CSV: ${rows.length}\n`);

  // 2. Buscar todos os telefones já existentes no banco (em uma única query)
  console.log('🔍 Consultando telefones já cadastrados no banco...');
  const { data: existingLeads, error: fetchError } = await supabase
    .from('leads')
    .select('phone');

  if (fetchError) {
    console.error('❌ Erro ao consultar o banco:', fetchError.message);
    process.exit(1);
  }

  // Cria um Set para lookup O(1)
  const phonesExistentes = new Set(existingLeads.map(l => l.phone));
  console.log(`   Contatos já no CRM: ${phonesExistentes.size}\n`);

  // 3. Filtrar apenas os que NÃO existem
  const novos = [];
  const ignorados = [];

  for (const row of rows) {
    const phone = formatPhone(row['Phone']);

    if (phonesExistentes.has(phone)) {
      ignorados.push(phone);
    } else {
      novos.push({
        name:  formatName(row['Name']),
        phone: phone,
        city:  formatLocation(row['Phone Number Location']),
        stage: 'lead_frio',          // stage padrão para importados
        automation_paused: false,
        interaction_count: 0,
        // wa_contact_id pode ser preenchido se disponível
        wa_contact_id: row['Phone E64'] ? String(row['Phone E64']) : null,
      });
    }
  }

  console.log(`✅ Novos contatos para importar: ${novos.length}`);
  console.log(`⏭️  Já existentes (serão ignorados): ${ignorados.length}\n`);

  if (novos.length === 0) {
    console.log('ℹ️  Nenhum contato novo para importar. Tudo já está no CRM!');
    return;
  }

  // 4. Inserir em lotes de 100 (evita timeout)
  const BATCH_SIZE = 100;
  let inseridos = 0;
  let erros = 0;
  const errosDetalhes = [];

  console.log(`⬆️  Iniciando importação em lotes de ${BATCH_SIZE}...\n`);

  for (let i = 0; i < novos.length; i += BATCH_SIZE) {
    const lote = novos.slice(i, i + BATCH_SIZE);
    const loteNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalLotes = Math.ceil(novos.length / BATCH_SIZE);

    process.stdout.write(`   Lote ${loteNum}/${totalLotes} (${lote.length} contatos)... `);

    const { data, error } = await supabase
      .from('leads')
      .insert(lote)
      .select('id');

    if (error) {
      // Se for conflito de UNIQUE (phone), ignora silenciosamente
      if (error.code === '23505') {
        process.stdout.write(`⚠️  duplicata detectada — inserindo um a um\n`);
        // Inserir um a um para salvar o máximo possível
        for (const contato of lote) {
          const { error: singleError } = await supabase
            .from('leads')
            .insert(contato);
          if (singleError) {
            erros++;
            errosDetalhes.push({ phone: contato.phone, erro: singleError.message });
          } else {
            inseridos++;
          }
        }
      } else {
        process.stdout.write(`❌\n`);
        erros += lote.length;
        errosDetalhes.push({ lote: loteNum, erro: error.message });
        console.error(`   Erro no lote ${loteNum}:`, error.message);
      }
    } else {
      inseridos += data.length;
      process.stdout.write(`✅ ${data.length} inseridos\n`);
    }
  }

  // 5. Relatório final
  console.log('\n═══════════════════════════════════════════════');
  console.log('  RELATÓRIO FINAL');
  console.log('═══════════════════════════════════════════════');
  console.log(`📥 Total no CSV:              ${rows.length}`);
  console.log(`✅ Inseridos com sucesso:     ${inseridos}`);
  console.log(`⏭️  Já existiam (ignorados):  ${ignorados.length}`);
  console.log(`❌ Erros:                     ${erros}`);
  console.log('═══════════════════════════════════════════════');

  if (errosDetalhes.length > 0) {
    console.log('\n⚠️  Detalhes dos erros:');
    errosDetalhes.forEach(e => console.log(`   ${JSON.stringify(e)}`));
  }

  console.log('\n🎉 Importação concluída!');
  console.log('   Os novos contatos aparecem no CRM com stage "lead_frio".');
}

// Executar
importarContatos().catch(err => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
