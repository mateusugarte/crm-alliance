import type { Server as SocketIOServer } from 'socket.io'

declare global {
  var __disparoIO: SocketIOServer | undefined
}

/**
 * A instância do Socket.io é criada em server.js (fora do bundle do Next.js) e
 * exposta via globalThis para que o engine, rodando dentro do processo do Next,
 * consiga emitir eventos nela sem precisar de uma segunda conexão de rede.
 */
export function getIO(): SocketIOServer | undefined {
  return globalThis.__disparoIO
}

export function setIO(io: SocketIOServer) {
  globalThis.__disparoIO = io
}
