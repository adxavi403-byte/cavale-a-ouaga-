import express from 'express';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import {
  PLAYER_COLORS,
  type ClientWsMessage,
  type MultiplayerRoomSnapshot,
  type PublicRoomSummary,
  type RoomPlayerInfo,
  type RoomRankingEntry,
  type ServerWsMessage,
} from './src/game/multiplayerTypes.ts';
import type { CharacterId, OutfitId } from './src/game/shop.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MAX_PLAYERS = 4;

interface ServerPlayer extends RoomPlayerInfo {
  ws: WebSocket;
}

interface ServerRoom {
  code: string;
  status: 'LOBBY' | 'RACING' | 'FINISHED';
  level: number;
  seed: number;
  hostId: string;
  players: ServerPlayer[];
  updatedAt: number;
  finishTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, ServerRoom>();
const socketSession = new WeakMap<WebSocket, { roomCode: string; playerId: string }>();

function generatePlayerId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeName(raw: string | undefined, fallback: string): string {
  const cleaned = (raw || '').trim().replace(/\s+/g, ' ').slice(0, 14);
  return cleaned || fallback;
}

function generateRoomCode(): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (!rooms.has(code)) return code;
  }
  return String(Math.floor(1000 + Math.random() * 9000));
}

function computeRankings(players: ServerPlayer[]): RoomRankingEntry[] {
  const sorted = [...players].sort((a, b) => {
    if (b.distanceMeters !== a.distanceMeters) return b.distanceMeters - a.distanceMeters;
    if (b.score !== a.score) return b.score - a.score;
    return b.coinsCollected - a.coinsCollected;
  });

  return sorted.map((p, idx) => ({
    rank: idx + 1,
    playerId: p.id,
    name: p.name,
    slot: p.slot,
    colorHex: p.colorHex,
    colorLabel: p.colorLabel,
    characterId: p.characterId,
    outfitId: p.outfitId,
    distanceMeters: Math.floor(p.distanceMeters),
    coinsCollected: Math.floor(p.coinsCollected),
    score: Math.floor(p.score),
    isAlive: p.isAlive,
    isWinner: idx === 0,
  }));
}

function toRoomSnapshot(room: ServerRoom): MultiplayerRoomSnapshot {
  return {
    code: room.code,
    status: room.status,
    level: room.level,
    seed: room.seed,
    hostId: room.hostId,
    players: room.players.map(({ ws: _ws, ...rest }) => ({ ...rest })),
    rankings: computeRankings(room.players),
  };
}

function sendTo(ws: WebSocket, msg: ServerWsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(room: ServerRoom, msg: ServerWsMessage, excludePlayerId?: string): void {
  const payload = JSON.stringify(msg);
  for (const player of room.players) {
    if (excludePlayerId && player.id === excludePlayerId) continue;
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(payload);
    }
  }
}

function findNextFreeSlot(room: ServerRoom): 0 | 1 | 2 | 3 {
  const used = new Set(room.players.map((p) => p.slot));
  for (const s of [0, 1, 2, 3] as const) {
    if (!used.has(s)) return s;
  }
  return 0;
}

function listOpenLobbies(): PublicRoomSummary[] {
  const out: PublicRoomSummary[] = [];
  for (const room of rooms.values()) {
    if (room.status !== 'LOBBY' || room.players.length === 0) continue;
    const host = room.players.find((p) => p.id === room.hostId) ?? room.players[0];
    out.push({
      code: room.code,
      hostName: host.name,
      level: room.level,
      playerCount: room.players.length,
      maxPlayers: MAX_PLAYERS,
      status: room.status,
    });
  }
  return out;
}

let activeWss: WebSocketServer | null = null;

function broadcastRoomsList(): void {
  if (!activeWss) return;
  const payload = JSON.stringify({
    type: 'rooms:list',
    rooms: listOpenLobbies(),
  } satisfies ServerWsMessage);
  for (const client of activeWss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function finalizeRace(room: ServerRoom): void {
  if (room.status !== 'RACING') return;
  if (room.finishTimer) {
    clearTimeout(room.finishTimer);
    room.finishTimer = null;
  }
  room.status = 'FINISHED';
  room.updatedAt = Date.now();
  broadcast(room, {
    type: 'race:results',
    room: toRoomSnapshot(room),
  });
}

function maybeFinishRace(room: ServerRoom): void {
  if (room.status !== 'RACING') return;
  const alive = room.players.filter((p) => p.isAlive);
  const dead = room.players.filter((p) => !p.isAlive);

  if (alive.length === 0) {
    finalizeRace(room);
    return;
  }

  // If only 1 runner remains alive and is already strictly farther than every eliminated player,
  // end the race after a short 1.2s victory beat so eliminated friends don't wait endlessly.
  if (alive.length === 1 && dead.length > 0 && room.players.length >= 2) {
    const survivor = alive[0];
    const maxDeadDistance = Math.max(...dead.map((d) => d.distanceMeters));
    if (survivor.distanceMeters > maxDeadDistance + 5 && !room.finishTimer) {
      room.finishTimer = setTimeout(() => {
        room.finishTimer = null;
        if (room.status === 'RACING') {
          finalizeRace(room);
        }
      }, 1200);
    }
  }
}

function removePlayerFromRoom(ws: WebSocket): void {
  const session = socketSession.get(ws);
  if (!session) return;
  socketSession.delete(ws);

  const room = rooms.get(session.roomCode);
  if (!room) return;

  const idx = room.players.findIndex((p) => p.id === session.playerId);
  if (idx === -1) return;

  const [removed] = room.players.splice(idx, 1);
  room.updatedAt = Date.now();

  if (room.players.length === 0) {
    if (room.finishTimer) clearTimeout(room.finishTimer);
    rooms.delete(room.code);
    broadcastRoomsList();
    return;
  }

  if (room.hostId === removed.id) {
    room.hostId = room.players[0].id;
    room.players[0].isHost = true;
  }

  if (room.status === 'RACING') {
    if (room.players.length === 1) {
      finalizeRace(room);
      return;
    }
    maybeFinishRace(room);
  }

  broadcast(room, {
    type: 'room:state',
    room: toRoomSnapshot(room),
  });
  broadcastRoomsList();
}

function getLocalLanUrls(): string[] {
  const privateUrls: string[] = [];
  const linkLocalUrls: string[] = [];
  const ifaces = os.networkInterfaces();
  for (const entries of Object.values(ifaces)) {
    if (!entries) continue;
    for (const info of entries) {
      if (info.family === 'IPv4' && !info.internal) {
        const url = `http://${info.address}:${PORT}`;
        if (info.address.startsWith('169.254.')) {
          linkLocalUrls.push(url);
        } else {
          privateUrls.push(url);
        }
      }
    }
  }
  return [...privateUrls, ...linkLocalUrls];
}

// Clean up idle rooms older than 45 minutes
setInterval(() => {
  const cutoff = Date.now() - 45 * 60 * 1000;
  for (const [code, room] of rooms.entries()) {
    if (room.updatedAt < cutoff) {
      if (room.finishTimer) clearTimeout(room.finishTimer);
      rooms.delete(code);
    }
  }
}, 5 * 60 * 1000);

async function startServer(): Promise<void> {
  const app = express();
  const server = http.createServer(app);

  app.get('/api/local-info', (_req, res) => {
    res.json({
      lanUrls: getLocalLanUrls(),
      activeRooms: rooms.size,
    });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: listOpenLobbies() });
  });

  const wss = new WebSocketServer({ server, path: '/ws/multiplayer' });
  activeWss = wss;

  wss.on('connection', (ws) => {
    sendTo(ws, {
      type: 'rooms:list',
      rooms: listOpenLobbies(),
    });

    ws.on('message', (raw) => {
      let msg: ClientWsMessage;
      try {
        msg = JSON.parse(String(raw)) as ClientWsMessage;
      } catch {
        return;
      }

      if (msg.type === 'rooms:subscribe') {
        sendTo(ws, {
          type: 'rooms:list',
          rooms: listOpenLobbies(),
        });
        return;
      }

      if (msg.type === 'room:create') {
        removePlayerFromRoom(ws);
        const code = generateRoomCode();
        const playerId = generatePlayerId();
        const color = PLAYER_COLORS[0];
        const player: ServerPlayer = {
          id: playerId,
          name: sanitizeName(msg.name, 'DIDI'),
          slot: 0,
          colorHex: color.hex,
          colorLabel: color.label,
          colorInt: color.int,
          characterId: (msg.characterId || 'didi') as CharacterId,
          outfitId: (msg.outfitId || 'base') as OutfitId,
          isHost: true,
          isAlive: true,
          distanceMeters: 0,
          worldScroll: 0,
          coinsCollected: 0,
          score: 0,
          ws,
        };
        const room: ServerRoom = {
          code,
          status: 'LOBBY',
          level: Math.max(1, Math.floor(msg.level || 1)),
          seed: Math.floor(1 + Math.random() * 2000000000),
          hostId: playerId,
          players: [player],
          updatedAt: Date.now(),
          finishTimer: null,
        };
        rooms.set(code, room);
        socketSession.set(ws, { roomCode: code, playerId });
        sendTo(ws, {
          type: 'room:joined',
          playerId,
          room: toRoomSnapshot(room),
        });
        broadcastRoomsList();
        return;
      }

      if (msg.type === 'room:join') {
        removePlayerFromRoom(ws);
        const code = (msg.code || '').trim();
        const room = rooms.get(code);
        if (!room) {
          sendTo(ws, {
            type: 'room:error',
            message: `Salon "${code}" introuvable. Vérifiez le code à 4 chiffres.`,
          });
          return;
        }
        if (room.status === 'RACING') {
          sendTo(ws, {
            type: 'room:error',
            message: 'La course a déjà commencé dans ce salon.',
          });
          return;
        }
        if (room.players.length >= MAX_PLAYERS) {
          sendTo(ws, {
            type: 'room:error',
            message: 'Ce salon est déjà complet (4/4 joueurs).',
          });
          return;
        }

        const slot = findNextFreeSlot(room);
        const color = PLAYER_COLORS[slot];
        const playerId = generatePlayerId();
        const player: ServerPlayer = {
          id: playerId,
          name: sanitizeName(msg.name, `Joueur ${slot + 1}`),
          slot,
          colorHex: color.hex,
          colorLabel: color.label,
          colorInt: color.int,
          characterId: (msg.characterId || 'didi') as CharacterId,
          outfitId: (msg.outfitId || 'base') as OutfitId,
          isHost: false,
          isAlive: true,
          distanceMeters: 0,
          worldScroll: 0,
          coinsCollected: 0,
          score: 0,
          ws,
        };

        room.players.push(player);
        room.updatedAt = Date.now();
        socketSession.set(ws, { roomCode: room.code, playerId });

        const snap = toRoomSnapshot(room);
        sendTo(ws, {
          type: 'room:joined',
          playerId,
          room: snap,
        });
        broadcast(
          room,
          {
            type: 'room:state',
            room: snap,
          },
          playerId
        );
        broadcastRoomsList();
        return;
      }

      const session = socketSession.get(ws);
      if (!session) return;
      const room = rooms.get(session.roomCode);
      if (!room) return;
      const sender = room.players.find((p) => p.id === session.playerId);
      if (!sender) return;

      if (msg.type === 'room:leave') {
        removePlayerFromRoom(ws);
        return;
      }

      if (msg.type === 'room:update_profile') {
        sender.name = sanitizeName(msg.name, sender.name);
        sender.characterId = (msg.characterId || sender.characterId) as CharacterId;
        sender.outfitId = (msg.outfitId || sender.outfitId) as OutfitId;
        room.updatedAt = Date.now();
        broadcast(room, {
          type: 'room:state',
          room: toRoomSnapshot(room),
        });
        broadcastRoomsList();
        return;
      }

      if (msg.type === 'room:set_level') {
        if (room.hostId !== sender.id || room.status !== 'LOBBY') return;
        room.level = Math.max(1, Math.min(60, Math.floor(msg.level || 1)));
        room.updatedAt = Date.now();
        broadcast(room, {
          type: 'room:state',
          room: toRoomSnapshot(room),
        });
        broadcastRoomsList();
        return;
      }

      if (msg.type === 'room:start') {
        if (room.hostId !== sender.id) return;
        if (room.players.length < 2) {
          sendTo(ws, {
            type: 'room:error',
            message: 'Il faut au moins 2 joueurs pour lancer la partie.',
          });
          return;
        }
        if (room.finishTimer) {
          clearTimeout(room.finishTimer);
          room.finishTimer = null;
        }
        room.status = 'RACING';
        room.seed = Math.floor(1 + Math.random() * 2000000000);
        room.updatedAt = Date.now();
        for (const p of room.players) {
          p.isAlive = true;
          p.distanceMeters = 0;
          p.worldScroll = 0;
          p.coinsCollected = 0;
          p.score = 0;
          p.arrestReason = undefined;
        }
        broadcast(room, {
          type: 'race:start',
          room: toRoomSnapshot(room),
        });
        broadcastRoomsList();
        return;
      }

      if (msg.type === 'room:play_again') {
        if (room.hostId !== sender.id) return;
        if (room.finishTimer) {
          clearTimeout(room.finishTimer);
          room.finishTimer = null;
        }
        room.status = 'LOBBY';
        room.updatedAt = Date.now();
        for (const p of room.players) {
          p.isAlive = true;
          p.distanceMeters = 0;
          p.worldScroll = 0;
          p.coinsCollected = 0;
          p.score = 0;
          p.arrestReason = undefined;
        }
        broadcast(room, {
          type: 'room:state',
          room: toRoomSnapshot(room),
        });
        broadcastRoomsList();
        return;
      }

      if (msg.type === 'player:pose') {
        if (room.status !== 'RACING') return;
        if (sender.isAlive) {
          sender.distanceMeters = Math.max(sender.distanceMeters, Number(msg.pose.distanceMeters) || 0);
          sender.worldScroll = Math.max(sender.worldScroll, Number(msg.pose.worldScroll) || 0);
          sender.coinsCollected = Math.max(sender.coinsCollected, Number(msg.pose.coinsCollected) || 0);
          sender.score = Math.max(sender.score, Number(msg.pose.score) || 0);
        }
        room.updatedAt = Date.now();
        broadcast(
          room,
          {
            type: 'player:pose',
            pose: {
              ...msg.pose,
              playerId: sender.id,
              ts: Date.now(),
            },
          },
          sender.id
        );
        maybeFinishRace(room);
        return;
      }

      if (msg.type === 'player:finished') {
        if (room.status !== 'RACING') return;
        sender.isAlive = false;
        sender.distanceMeters = Math.max(sender.distanceMeters, Math.floor(Number(msg.distanceMeters) || 0));
        sender.worldScroll = Math.max(sender.worldScroll, Number(msg.worldScroll) || 0);
        sender.coinsCollected = Math.max(sender.coinsCollected, Math.floor(Number(msg.coinsCollected) || 0));
        sender.score = Math.max(sender.score, Math.floor(Number(msg.score) || 0));
        sender.arrestReason = (msg.arrestReason || '').slice(0, 120);
        room.updatedAt = Date.now();

        broadcast(room, {
          type: 'room:state',
          room: toRoomSnapshot(room),
        });
        maybeFinishRace(room);
        return;
      }

      if (msg.type === 'rtc:signal') {
        const target = room.players.find((p) => p.id === msg.toId);
        if (!target) return;
        sendTo(target.ws, {
          type: 'rtc:signal',
          signal: {
            fromId: sender.id,
            toId: msg.toId,
            description: msg.description,
            candidate: msg.candidate,
          },
        });
      }
    });

    ws.on('close', () => {
      removePlayerFromRoom(ws);
    });

    ws.on('error', () => {
      removePlayerFromRoom(ws);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });

    // HMR is disabled in this environment; serve a WebSocket-free /@vite/client shim
    // so Vite 8's client script never attempts a blocked port-24678 WebSocket connection.
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if (typeof document !== 'undefined') {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id) || typeof document === 'undefined') return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (typeof document === 'undefined') return;
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const hot = {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
  return hot;
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
export class ErrorOverlay extends (typeof HTMLElement !== 'undefined' ? HTMLElement : Object) {}
`.trimStart());
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
          if (filePath.endsWith('manifest.json') || filePath.endsWith('.webmanifest')) {
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Cavale Ouaga server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Cavale Ouaga server:', err);
  process.exit(1);
});
