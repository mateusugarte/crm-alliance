// Servidor customizado: hospeda o Next.js e o Socket.io na mesma porta/processo,
// para que o motor de disparo (src/lib/disparo/engine.ts) possa emitir eventos
// de progresso em tempo real sem precisar de um segundo serviço.
const { createServer } = require('http')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '3000', 10)
const hostname = process.env.HOSTNAME || '0.0.0.0'

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res))

  const io = new Server(httpServer, {
    cors: { origin: '*' },
  })
  globalThis.__disparoIO = io

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
