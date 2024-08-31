import express from "express";
import http from "http";

import WebSocket from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let userCount = 0;

// Rate limiting configuration
const MAX_TOKENS = 5;
const REFILL_RATE = 1; // tokens per second
const REFILL_INTERVAL = 1000; // 1 second in milliseconds

interface CustomWebSocket extends WebSocket {
  id: string;
  tokens: number;
  lastRefill: number;
}

function refillTokens(ws: CustomWebSocket) {
  const now = Date.now();
  const timePassed = now - ws.lastRefill;
  const tokensToAdd = Math.floor(timePassed / REFILL_INTERVAL) * REFILL_RATE;

  ws.tokens = Math.min(MAX_TOKENS, ws.tokens + tokensToAdd);
  ws.lastRefill = now;
}

function canSendMessage(ws: CustomWebSocket): boolean {
  refillTokens(ws);

  if (ws.tokens > 0) {
    ws.tokens--;
    return true;
  }

  return false;
}

wss.on("connection", (ws) => {
  userCount++;
  const customWs = ws as CustomWebSocket;
  customWs.id = Math.random().toString(36);
  customWs.tokens = MAX_TOKENS;
  customWs.lastRefill = Date.now();

  console.log("New client connected. Total users:", userCount);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "userCount", userCount }));
    }
  });

  customWs.on("message", (message) => {
    if (Buffer.isBuffer(message)) {
      // @ts-ignore
      message = message.toString();
    }

    if (canSendMessage(customWs)) {
      wss.clients.forEach((client) => {
        const clientWs = client as CustomWebSocket;
        if (clientWs !== customWs && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "message", message }));
        }
      });
    } else {
      customWs.send(
        JSON.stringify({
          type: "error",
          message:
            "Rate limit exceeded. Please wait before sending another message.",
        })
      );
    }
  });

  ws.on("close", () => {
    userCount--;
    console.log("Client disconnected. Total users:", userCount);

    // Notify all clients of the updated user count
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "userCount", userCount }));
      }
    });
  });
});

server.listen(8080, () => {
  console.log("WebSocket server is running on port 8080");
});
