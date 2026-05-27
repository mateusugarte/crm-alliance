// ============================================================
// atualizar-data-antes-ia.js
// Define created_at = '2026-03-15T10:00:00Z' para todos os
// leads onde antes_ia = true, para que apareçam no filtro
// de data corretamente no CRM.
// ============================================================
// Como usar:
//   node atualizar-data-antes-ia.js
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL         = 'https://lmvdruvmpybutmmidrfp.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdmRydXZtcHlidXRtbWlkcmZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY4MDk3MCwiZXhwIjoyMDg5MjU2OTcwfQ.OzGjaBbEbK8sb5Z0tWazUbb6MUcW7a_6XuTyF_rJaVQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

const DATA_ANTES_IA = '2026-03-15T10:00:00.000Z';

async function atualizarData() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Atualizar created_at — Contatos Antes da IA');
  console.log('═══════════════════════════════════════════════\n');

  // Busca todos os leads antes_ia = true
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, name, created_at')
    .eq('antes_ia', true);

  if (error) {
    console.error('❌ Erro ao buscar leads:', error.message);
    process.exit(1);
  }

  console.log(`📋 Leads antes_ia encontrados: ${leads.length}`);
  if (leads.length === 0) {
    console.log('   Nenhum lead com antes_ia = true. Execute corrigir-contatos-importados.js primeiro.');
    process.exit(0);
  }

  // Atualiza em lote
  const ids = leads.map(l => l.id);
  const { error: updateError } = await supabase
    .from('leads')
    .update({ created_at: DATA_ANTES_IA })
    .in('id', ids);

  if (updateError) {
    console.error('❌ Erro ao atualizar:', updateError.message);
    process.exit(1);
  }

  console.log(`✅ ${leads.length} leads atualizados → created_at = ${DATA_ANTES_IA}`);
  console.log('\n💡 No filtro personalizado do CRM, selecione:');
  console.log('   De: 2026-03-01  Até: 2026-03-31');
  console.log('   para ver todos os contatos antes da IA.\n');
}

atualizarData().catch(err => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
