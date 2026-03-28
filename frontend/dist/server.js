"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const https_1 = require("https");
const http_1 = require("http");
const fs_1 = require("fs");
const url_1 = require("url");
const next_1 = __importDefault(require("next"));
const ws_1 = require("ws");
const gameHandler_1 = require("./server/gameHandler");
const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const app = (0, next_1.default)({ dev, hostname, port });
const handle = app.getRequestHandler();
// Use HTTPS in dev if certs exist (required for Privy embedded wallets)
const certPath = './certs/cert.pem';
const keyPath = './certs/key.pem';
const useHttps = dev && (0, fs_1.existsSync)(certPath) && (0, fs_1.existsSync)(keyPath);
app.prepare().then(() => {
    const server = useHttps
        ? (0, https_1.createServer)({
            key: (0, fs_1.readFileSync)(keyPath),
            cert: (0, fs_1.readFileSync)(certPath),
        }, (req, res) => {
            const parsedUrl = (0, url_1.parse)(req.url, true);
            handle(req, res, parsedUrl);
        })
        : (0, http_1.createServer)((req, res) => {
            const parsedUrl = (0, url_1.parse)(req.url, true);
            handle(req, res, parsedUrl);
        });
    // Attach WebSocket server at /ws
    const wss = new ws_1.WebSocketServer({ noServer: true });
    server.on('upgrade', (req, socket, head) => {
        const { pathname } = (0, url_1.parse)(req.url, true);
        if (pathname === '/ws') {
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
    const protocol = useHttps ? 'https' : 'http';
    server.listen(port, () => {
        console.log(`> MathNad ready on ${protocol}://${hostname}:${port}`);
        console.log(`> WebSocket server attached at /ws`);
    });
});
