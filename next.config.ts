import type { NextConfig } from "next";

// URL do serviço EasyPanel, onde o server.js customizado roda de forma persistente
// (necessário para o loop de disparo, que fica vivo entre envios). Sem essa variável,
// as ações abaixo continuam servidas localmente — é assim que o próprio EasyPanel se comporta.
const disparoEngineUrl = process.env.DISPARO_ENGINE_URL;

const nextConfig: NextConfig = {
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
