import { createServer as createHttpsServer } from 'https';
import { createServer as createHttpServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { handleConnection } from './server/gameHandler';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Use HTTPS in dev if certs exist (required for Privy embedded wallets)
const certPath = './certs/cert.pem';
const keyPath = './certs/key.pem';
const useHttps = dev && existsSync(certPath) && existsSync(keyPath);

app.prepare().then(() => {
  const server = useHttps
    ? createHttpsServer(
        {
          key: readFileSync(keyPath),
          cert: readFileSync(certPath),
        },
        (req, res) => {
          const parsedUrl = parse(req.url!, true);
          handle(req, res, parsedUrl);
        }
      )
    : createHttpServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
      });

  // Attach WebSocket server at /ws
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url!, true);

    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    handleConnection(ws);
  });

  const protocol = useHttps ? 'https' : 'http';
  server.listen(port, () => {
    console.log(`> MathNad ready on ${protocol}://${hostname}:${port}`);
    console.log(`> WebSocket server attached at /ws`);
  });
});
