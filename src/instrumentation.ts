export async function register() {
  // DISPARO_ENGINE_URL setada = este deploy (Vercel) apenas faz proxy das ações
  // de disparo para o EasyPanel, que é quem roda o processo persistente. Sem esse
  // guard, cada instância serverless da Vercel também sobe seu próprio loop
  // in-memory no boot e passa a disputar os mesmos disparos pendentes com o
  // motor real do EasyPanel, encurtando o intervalo configurado na prática.
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.DISPARO_ENGINE_URL) {
    try {
      const { resumeActiveCampaigns } = await import('@/lib/disparo/engine')
      await resumeActiveCampaigns()
    } catch (err) {
      console.error('[disparo-engine] Falha ao retomar campanhas no boot:', err)
    }
  }
}
