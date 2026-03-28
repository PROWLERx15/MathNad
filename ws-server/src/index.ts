import 'dotenv/config';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { parse } from 'url';
import { handleConnection } from './gameHandler';

// Validate required env vars at startup
const required = ['DATABASE_URL', 'CONTRACT_ADDRESS', 'SETTLE_API_URL'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required env var: ${key}`);
    process.exit(1);
  }
}
console.log('Env vars OK:', required.map(k => `${k}=${k === 'DATABASE_URL' ? '***' : process.env[k]}`).join(', '));

const port = parseInt(process.env.PORT || '8080', 10);

const server = createServer((_req, res) => {
  // Health check endpoint for Render
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('MathNad WS Server OK');
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const { pathname } = parse(req.url!, true);

  if (pathname === '/ws' || pathname === '/') {
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

server.listen(port, () => {
  console.log(`> MathNad WS Server listening on port ${port}`);
});
