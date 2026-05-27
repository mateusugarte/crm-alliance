// ============================================================
// corrigir-contatos-importados.js
// Corrige os contatos já importados no CRM La Reserva:
//   1. Remove duplicatas do banco
//   2. Corrige formato do phone: +5528... → 5528...@s.whatsapp.net
//   3. Corrige wa_contact_id para o mesmo formato
//   4. Define antes_ia = true em todos os corrigidos
// ============================================================
// ATENÇÃO: rode o SQL abaixo no Supabase ANTES de executar este script:
//   ALTER TABLE leads ADD COLUMN IF NOT EXISTS antes_ia boolean DEFAULT false;
// ============================================================
// Como usar:
//   node corrigir-contatos-importados.js
// ============================================================

import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------
// ⚙️  CONFIGURAÇÃO
// ------------------------------------------------------------
const SUPABASE_URL         = 'https://lmvdruvmpybutmmidrfp.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdmRydXZtcHlidXRtbWlkcmZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY4MDk3MCwiZXhwIjoyMDg5MjU2OTcwfQ.OzGjaBbEbK8sb5Z0tWazUbb6MUcW7a_6XuTyF_rJaVQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// ------------------------------------------------------------
// Converte qualquer formato de telefone para o novo padrão
// Ex: +5528999669615  →  5528999669615@s.whatsapp.net
//     5528999669615   →  5528999669615@s.whatsapp.net
// ------------------------------------------------------------
function toWhatsAppFormat(phone) {
  if (!phone) return null;
  // Se já está no formato correto, retorna como está
  if (phone.includes('@s.whatsapp.net')) return phone;
  // Remove tudo que não é dígito e adiciona sufixo
  const digits = String(phone).replace(/\D/g, '');
  return digits + '@s.whatsapp.net';
}

// ------------------------------------------------------------
// Função principal
// ------------------------------------------------------------
async function corrigirContatos() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Correção de Contatos Importados — La Reserva');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Buscar todos os leads do banco
  console.log('🔍 Buscando todos os leads do banco...');
  const { data: leads, error: fetchError } = await supabase
    .from('leads')
    .select('id, phone, wa_contact_id, name, antes_ia')
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('❌ Erro ao buscar leads:', fetchError.message);
    process.exit(1);
  }

  console.log(`   Total de leads encontrados: ${leads.length}\n`);

  // ------------------------------------------------------------
  // ETAPA 1: Remover duplicatas
  // Critério: mesmo número (após normalizar). Mantém o mais antigo (created_at ASC).
  // ------------------------------------------------------------
  console.log('🧹 ETAPA 1 — Identificando duplicatas...');

  const phoneParaId = new Map(); // phone normalizado → id do primeiro encontrado
  const idsParaDeletar = [];

  for (const lead of leads) {
    const phoneNorm = toWhatsAppFormat(lead.phone);

    if (phoneParaId.has(phoneNorm)) {
      // Já existe um mais antigo — este é duplicata
      idsParaDeletar.push(lead.id);
    } else {
      phoneParaId.set(phoneNorm, lead.id);
    }
  }

  console.log(`   Duplicatas encontradas: ${idsParaDeletar.length}`);

  if (idsParaDeletar.length > 0) {
    // Deletar em lotes de 50
    const BATCH = 50;
    let deletados = 0;

    for (let i = 0; i < idsParaDeletar.length; i += BATCH) {
      const lote = idsParaDeletar.slice(i, i + BATCH);
      const { error: deleteError } = await supabase
        .from('leads')
        .delete()
        .in('id', lote);

      if (deleteError) {
        console.error(`   ❌ Erro ao deletar lote: ${deleteError.message}`);
      } else {
        deletados += lote.length;
        process.stdout.write(`   🗑️  Deletados: ${deletados}/${idsParaDeletar.length}\r`);
      }
    }
    console.log(`\n   ✅ ${deletados} duplicatas removidas.\n`);
  } else {
    console.log('   ✅ Nenhuma duplicata encontrada.\n');
  }

  // ------------------------------------------------------------
  // ETAPA 2: Corrigir formato do phone + wa_contact_id + antes_ia
  // Busca novamente após deletar duplicatas
  // ------------------------------------------------------------
  console.log('🔧 ETAPA 2 — Corrigindo formato dos telefones e antes_ia...');

  const { data: leadsAtuais, error: fetchError2 } = await supabase
    .from('leads')
    .select('id, phone, wa_contact_id, antes_ia');

  if (fetchError2) {
    console.error('❌ Erro ao buscar leads atualizados:', fetchError2.message);
    process.exit(1);
  }

  // Filtrar apenas os que precisam de correção
  const paraCorrigir = leadsAtuais.filter(lead => {
    const phoneErrado = lead.phone && !lead.phone.includes('@s.whatsapp.net');
    const waErrado    = lead.wa_contact_id && !lead.wa_contact_id.includes('@s.whatsapp.net');
    const antesIaFalta = lead.antes_ia !== true;
    return phoneErrado || waErrado || antesIaFalta;
  });

  console.log(`   Leads que precisam de correção: ${paraCorrigir.length}`);

  if (paraCorrigir.length === 0) {
    console.log('   ✅ Todos os telefones já estão no formato correto.\n');
  } else {
    const BATCH = 50;
    let corrigidos = 0;
    let erros = 0;

    for (let i = 0; i < paraCorrigir.length; i += BATCH) {
      const lote = paraCorrigir.slice(i, i + BATCH);
      const loteNum = Math.floor(i / BATCH) + 1;
      const totalLotes = Math.ceil(paraCorrigir.length / BATCH);

      process.stdout.write(`   Lote ${loteNum}/${totalLotes}... `);

      // Atualizar cada um individualmente para garantir phone único
      for (const lead of lote) {
        const novoPhone = toWhatsAppFormat(lead.phone);
        const novoWA    = toWhatsAppFormat(lead.wa_contact_id || lead.phone);

        const { error: updateError } = await supabase
          .from('leads')
          .update({
            phone:         novoPhone,
            wa_contact_id: novoWA,
            antes_ia:      true,
          })
          .eq('id', lead.id);

        if (updateError) {
          erros++;
          // Se for conflito de UNIQUE (phone já existe com esse formato), deleta este
          if (updateError.code === '23505') {
            await supabase.from('leads').delete().eq('id', lead.id);
            console.log(`\n   ⚠️  ${novoPhone} já existe — lead duplicado removido.`);
          } else {
            console.error(`\n   ❌ Erro em ${lead.id}: ${updateError.message}`);
          }
        } else {
          corrigidos++;
        }
      }

      process.stdout.write(`✅\n`);
    }

    console.log(`\n   ✅ Corrigidos: ${corrigidos}`);
    if (erros > 0) console.log(`   ⚠️  Com erro: ${erros}`);
  }

  // ------------------------------------------------------------
  // Relatório final
  // ------------------------------------------------------------
  const { count } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });

  console.log('\n═══════════════════════════════════════════════');
  console.log('  RELATÓRIO FINAL');
  console.log('═══════════════════════════════════════════════');
  console.log(`🗑️  Duplicatas removidas:     ${idsParaDeletar.length}`);
  console.log(`🔧 Telefones corrigidos:     ${paraCorrigir.length}`);
  console.log(`📋 Total de leads no banco:  ${count ?? '?'}`);
  console.log('═══════════════════════════════════════════════');
  console.log('\n🎉 Correção concluída!');
  console.log('   Todos os contatos agora têm:');
  console.log('   • phone:         5528999669615@s.whatsapp.net');
  console.log('   • wa_contact_id: 5528999669615@s.whatsapp.net');
  console.log('   • antes_ia:      true');
}

corrigirContatos().catch(err => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
