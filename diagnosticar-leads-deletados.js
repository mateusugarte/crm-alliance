// ============================================================
// diagnosticar-leads-deletados.js
// Encontra lead_ids que existem em interactions mas não em leads
// (leads deletados que tinham conversas — candidatos a restaurar)
// ============================================================
// Como usar:
//   node diagnosticar-leads-deletados.js
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL         = 'https://lmvdruvmpybutmmidrfp.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdmRydXZtcHlidXRtbWlkcmZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY4MDk3MCwiZXhwIjoyMDg5MjU2OTcwfQ.OzGjaBbEbK8sb5Z0tWazUbb6MUcW7a_6XuTyF_rJaVQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function diagnosticar() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Diagnóstico — Leads Deletados com Interações');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Buscar todos os lead_ids distintos nas interações
  console.log('🔍 Buscando lead_ids em interactions...');
  const { data: interactionLeads, error: e1 } = await supabase
    .from('interactions')
    .select('lead_id')
    .order('lead_id');

  if (e1) { console.error('❌ Erro:', e1.message); process.exit(1); }

  const leadIdsComInteracao = [...new Set(interactionLeads.map(r => r.lead_id))];
  console.log(`   lead_ids distintos em interactions: ${leadIdsComInteracao.length}`);

  // 2. Buscar todos os ids de leads ativos
  console.log('🔍 Buscando leads existentes...');
  const { data: leadsAtivos, error: e2 } = await supabase
    .from('leads')
    .select('id, name, phone');

  if (e2) { console.error('❌ Erro:', e2.message); process.exit(1); }

  const leadsAtivosSet = new Set(leadsAtivos.map(l => l.id));
  console.log(`   leads ativos no banco: ${leadsAtivos.length}`);

  // 3. Encontrar lead_ids órfãos (existem em interactions, não existem em leads)
  const orfaos = leadIdsComInteracao.filter(id => !leadsAtivosSet.has(id));
  console.log(`\n⚠️  Lead IDs órfãos (deletados com conversa): ${orfaos.length}\n`);

  if (orfaos.length === 0) {
    console.log('✅ Nenhum lead deletado encontrado com interações.');
    return;
  }

  // 4. Para cada órfão, buscar detalhes das interações
  console.log('📋 Detalhes de cada lead deletado:\n');

  for (const leadId of orfaos) {
    const { data: msgs } = await supabase
      .from('interactions')
      .select('content, direction, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1);

    const ultimaMsg = msgs?.[0];

    const { count } = await supabase
      .from('interactions')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId);

    console.log(`  Lead ID: ${leadId}`);
    console.log(`  Mensagens: ${count ?? '?'}`);
    if (ultimaMsg) {
      console.log(`  Última msg (${ultimaMsg.direction}): "${ultimaMsg.content?.slice(0, 80)}"`);
      console.log(`  Em: ${ultimaMsg.created_at}`);
    }
    console.log('  ─────────────────────────────────────────────────');
  }

  console.log(`\n💡 Total de leads a restaurar: ${orfaos.length}`);
  console.log('   Para restaurar, rode: node restaurar-leads-deletados.js');
}

diagnosticar().catch(err => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
