"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = __importDefault(require("ws"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const wss = new ws_1.default.Server({ server });
let userCount = 0;
// Rate limiting configuration
const MAX_TOKENS = 5;
const REFILL_RATE = 1; // tokens per second
const REFILL_INTERVAL = 1000; // 1 second in milliseconds
function refillTokens(ws) {
    const now = Date.now();
    const timePassed = now - ws.lastRefill;
    const tokensToAdd = Math.floor(timePassed / REFILL_INTERVAL) * REFILL_RATE;
    ws.tokens = Math.min(MAX_TOKENS, ws.tokens + tokensToAdd);
    ws.lastRefill = now;
}
function canSendMessage(ws) {
    refillTokens(ws);
    if (ws.tokens > 0) {
        ws.tokens--;
        return true;
    }
    return false;
}
function parseMessage(data) {
    if (typeof data === "string") {
        return data;
    }
    else if (data instanceof Buffer) {
        return data.toString("utf-8");
    }
    else if (data instanceof ArrayBuffer) {
        return new TextDecoder().decode(data);
    }
    else if (Array.isArray(data)) {
        return Buffer.concat(data).toString("utf-8");
    }
    throw new Error("Unsupported message format");
}
// List of sensitive words to filter
const sensitiveWords = ["sex", "asshole", "bc", "mc", "ass", "fuck"];
function filterSensitiveContent(message) {
    let filteredMessage = message;
    sensitiveWords.forEach((word) => {
        const regex = new RegExp(word, "gi");
        filteredMessage = filteredMessage.replace(regex, "*".repeat(word.length));
    });
    return filteredMessage;
}
wss.on("connection", (ws) => {
    userCount++;
    const customWs = ws;
    customWs.id = Math.random().toString(36);
    customWs.tokens = MAX_TOKENS;
    customWs.lastRefill = Date.now();
    console.log("New client connected. Total users:", userCount);
    wss.clients.forEach((client) => {
        if (client.readyState === ws_1.default.OPEN) {
            client.send(JSON.stringify({ type: "userCount", userCount }));
        }
    });
    customWs.on("message", (message) => {
        if (canSendMessage(customWs)) {
            // Filter sensitive content
            const parsedMessage = parseMessage(message);
            const filteredMessage = filterSensitiveContent(parsedMessage);
            wss.clients.forEach((client) => {
                const clientWs = client;
                if (clientWs !== customWs && client.readyState === ws_1.default.OPEN) {
                    client.send(JSON.stringify({ type: "message", filteredMessage }));
                }
            });
        }
        else {
            customWs.send(JSON.stringify({
                type: "error",
                message: "Rate limit exceeded. Please wait before sending another message.",
            }));
        }
    });
    ws.on("close", () => {
        userCount--;
        console.log("Client disconnected. Total users:", userCount);
        // Notify all clients of the updated user count
        wss.clients.forEach((client) => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(JSON.stringify({ type: "userCount", userCount }));
            }
        });
    });
});
server.listen(8080, () => {
    console.log("WebSocket server is running on port 8080");
});
