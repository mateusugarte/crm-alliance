// URL do serviço EasyPanel, onde o server.js customizado roda de forma persistente
// (necessário para o loop de disparo, que fica vivo entre envios). Sem essa variável,
// as ações abaixo continuam servidas localmente — é assim que o próprio EasyPanel se comporta.
const disparoEngineUrl = process.env.DISPARO_ENGINE_URL;

// Config em .mjs (e não .ts) de propósito: o server.js customizado carrega este arquivo
// em tempo de execução, e a imagem de produção roda com `npm ci --omit=dev` — sem o
// typescript instalado, um next.config.ts faz o Next tentar instalá-lo no boot.

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lmvdruvmpybutmmidrfp.supabase.co',
      },
    ],
  },
  async rewrites() {
    if (!disparoEngineUrl) return { beforeFiles: [] };
    return {
      // beforeFiles: intercepta antes das próprias rotas de API deste deploy, que na Vercel
      // (serverless, sem processo persistente) não conseguem manter o loop de envio rodando.
      beforeFiles: [
        {
          source: '/api/reactivation/:id/:action(start|pause|stop)',
          destination: `${disparoEngineUrl}/api/reactivation/:id/:action`,
        },
        {
          source: '/api/campaigns/:id/:action(start|pause|stop)',
          destination: `${disparoEngineUrl}/api/campaigns/:id/:action`,
        },
      ],
    };
  },
};

export default nextConfig;
