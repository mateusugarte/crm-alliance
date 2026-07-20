export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { resumeActiveCampaigns } = await import('@/lib/disparo/engine')
      await resumeActiveCampaigns()
    } catch (err) {
      console.error('[disparo-engine] Falha ao retomar campanhas no boot:', err)
    }
  }
}
