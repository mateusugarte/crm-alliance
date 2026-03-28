/**
 * run-schema.mjs
 * Executa o 001_schema.sql.sql no Supabase via Management API
 * Usage: node run-schema.mjs
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import https from 'https'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtdmRydXZtcHlidXRtbWlkcmZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY4MDk3MCwiZXhwIjoyMDg5MjU2OTcwfQ.OzGjaBbEbK8sb5Z0tWazUbb6MUcW7a_6XuTyF_rJaVQ'
const PROJECT_REF = 'lmvdruvmpybutmmidrfp'
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`

function fetchPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const data = JSON.stringify(body)
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    }
    const req = https.request(options, (res) => {
      let raw = ''
      res.on('data', chunk => raw += chunk)
      res.on('end', () => {
        resolve({ status: res.statusCode, body: raw })
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function executeSQL(sql) {
  // Tenta via Management API (aceita service_role como bearer em alguns contextos)
  const mgmtUrl = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

  const res = await fetchPost(
    mgmtUrl,
    { query: sql },
    { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
  )

  return { status: res.status, body: res.body }
}

async function main() {
  console.log('🚀 CRM Alliance — Executando schema no Supabase...\n')

  const schemaPath = join(ROOT, '001_schema.sql.sql')
  const sql = readFileSync(schemaPath, 'utf-8')

  console.log(`📄 Schema carregado: ${sql.length} caracteres`)
  console.log(`🔗 Projeto: ${PROJECT_REF}\n`)

  // Teste rápido de conectividade
  console.log('🔍 Testando conexão com Management API...')
  const testRes = await executeSQL('SELECT 1 as ok')

  if (testRes.status === 200) {
    console.log('✅ Management API acessível com service_role\n')

    // Executar o schema completo
    console.log('⚙️  Executando schema completo...')
    const schemaRes = await executeSQL(sql)

    if (schemaRes.status === 200) {
      console.log('✅ Schema executado com sucesso!\n')

      // Verificar tabelas
      console.log('🔍 Verificando tabelas criadas...')
      const verifyRes = await executeSQL(`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
      `)

      if (verifyRes.status === 200) {
        const result = JSON.parse(verifyRes.body)
        const tables = result.map ? result.map(r => r.tablename) : []
        console.log('📊 Tabelas no banco:', tables.join(', ') || '(nenhuma)')
      }

      // Verificar seed dos imóveis
      const imoveisRes = await executeSQL('SELECT id, nome FROM imoveis ORDER BY id;')
      if (imoveisRes.status === 200) {
        let rows = []
        try { rows = JSON.parse(imoveisRes.body) } catch {}
        if (rows.length > 0) {
          console.log('\n🏠 Imóveis inseridos:')
          rows.forEach(r => console.log(`   ${r.id}: ${r.nome}`))
        }
      }

      console.log('\n✅ DONE — Banco configurado e pronto!')
    } else {
      console.log(`❌ Erro ao executar schema (HTTP ${schemaRes.status}):`)
      console.log(schemaRes.body)
      suggestManual()
    }
  } else {
    console.log(`❌ Management API retornou HTTP ${testRes.status}`)
    console.log('   O service_role key não é aceito nesta API — tentando método alternativo...\n')
    await tryDirectPostgREST(sql)
  }
}

async function tryDirectPostgREST(sql) {
  // PostgREST não suporta DDL diretamente, mas podemos tentar via rpc
  // Primeiro verificar se exec_sql existe
  console.log('🔍 Verificando endpoint /rest/v1/rpc...')

  const testUrl = `${SUPABASE_URL}/rest/v1/rpc/exec_sql`
  const res = await fetchPost(
    testUrl,
    { sql: 'SELECT 1 as ok' },
    {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    }
  )

  if (res.status === 200) {
    console.log('✅ exec_sql disponível! Executando schema...')

    const schemaRes = await fetchPost(
      testUrl,
      { sql },
      {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      }
    )
    console.log(`Status: ${schemaRes.status}`, schemaRes.body.slice(0, 200))
  } else {
    console.log(`ℹ️  exec_sql não disponível (${res.status})\n`)
    suggestManual()
  }
}

function suggestManual() {
  console.log('─'.repeat(60))
  console.log('📋 EXECUÇÃO MANUAL NO SQL EDITOR:')
  console.log('─'.repeat(60))
  console.log('1. Abrir: https://supabase.com/dashboard/project/lmvdruvmpybutmmidrfp/editor')
  console.log('2. Colar o conteúdo de 001_schema.sql.sql')
  console.log('3. Clicar em Run (Ctrl+Enter)')
  console.log('─'.repeat(60))
}

main().catch(err => {
  console.error('💥 Erro fatal:', err.message)
  process.exit(1)
})
