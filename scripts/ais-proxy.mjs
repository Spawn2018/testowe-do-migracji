#!/usr/bin/env node
/**
 * AISStream WebSocket proxy — SERVER ONLY.
 * Client ↔ ws://localhost:4175/ais ↔ wss://stream.aisstream.io/v0/stream
 * Requires env AISSTREAM_API_KEY. Without key, emits seed status to clients.
 */
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.AIS_PROXY_PORT || 4175);
const KEY = process.env.AISSTREAM_API_KEY || '';
const UPSTREAM = 'wss://stream.aisstream.io/v0/stream';
const MMSI = ['311852000', '311000787', '219031605', '219030885', '219031310']; // Wawel, Nova Star, Spirit, Estelle, Ebba
const BBOX = [
  [
    [54.0, 15.2],
    [59.3, 19.9],
  ],
];

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`watch-tower AIS proxy · key=${KEY ? 'set' : 'MISSING'} · port ${PORT}\n`);
});

const wss = new WebSocketServer({ server, path: '/ais' });

wss.on('connection', (client) => {
  if (!KEY) {
    client.send(JSON.stringify({ type: 'status', mode: 'seed', reason: 'no AISSTREAM_API_KEY' }));
    return;
  }

  let upstream;
  try {
    upstream = new WebSocket(UPSTREAM);
  } catch (e) {
    client.send(JSON.stringify({ type: 'status', mode: 'seed', reason: String(e) }));
    return;
  }

  upstream.on('open', () => {
    const sub = {
      APIKey: KEY,
      BoundingBoxes: BBOX,
      FiltersShipMMSI: MMSI,
      FilterMessageTypes: ['PositionReport'],
    };
    upstream.send(JSON.stringify(sub));
    client.send(JSON.stringify({ type: 'status', mode: 'live' }));
  });

  upstream.on('message', (data) => {
    if (client.readyState === WebSocket.OPEN) client.send(data.toString());
  });
  upstream.on('error', () => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'status', mode: 'seed', reason: 'upstream error' }));
    }
  });
  upstream.on('close', () => client.close());
  client.on('close', () => upstream.close());
  client.on('message', () => {
    /* client hello ignored — subscription owned by proxy */
  });
});

server.listen(PORT, () => {
  console.log(`[ais-proxy] listening :${PORT}/ais · key ${KEY ? 'OK' : 'MISSING → seed mode'}`);
});
