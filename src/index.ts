import express from "express";
import http from "http";

import WebSocket from "ws";

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let userCount = 0;

wss.on("connection", (ws) => {
  interface CustomWebSocket extends WebSocket {
    id: string;
  }

  userCount++;
  const customWs = ws as CustomWebSocket;
  customWs.id = Math.random().toString(36);
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

    wss.clients.forEach((client) => {
      const clientWs = client as CustomWebSocket;
      if (clientWs !== customWs && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "message", message }));
      }
    });
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
