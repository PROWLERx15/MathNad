"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const http_1 = require("http");
const ws_1 = require("ws");
const url_1 = require("url");
const gameHandler_1 = require("./gameHandler");
const port = parseInt(process.env.PORT || '8080', 10);
const server = (0, http_1.createServer)((_req, res) => {
    // Health check endpoint for Render
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('MathNad WS Server OK');
});
const wss = new ws_1.WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
    const { pathname } = (0, url_1.parse)(req.url, true);
    if (pathname === '/ws' || pathname === '/') {
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    }
    else {
        socket.destroy();
    }
});
wss.on('connection', (ws) => {
    (0, gameHandler_1.handleConnection)(ws);
});
server.listen(port, () => {
    console.log(`> MathNad WS Server listening on port ${port}`);
});
