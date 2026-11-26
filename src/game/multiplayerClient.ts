import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ClientWsMessage,
  MultiplayerRoomSnapshot,
  P2PDataMessage,
  PLAYER_COLORS,
  PublicRoomSummary,
  RemoteRunnerPose,
  RoomPlayerInfo,
  RoomRankingEntry,
  RtcSignalPayload,
  ServerWsMessage,
} from './multiplayerTypes';
import { CharacterId, OutfitId } from './shop';

// Zero external STUN/TURN servers: 100% offline local WiFi / Hotspot LAN ICE gathering
const LOCAL_RTC_CONFIG: RTCConfiguration = {
  iceServers: [],
};

const LOCAL_CHANNEL_NAME = 'cavale_ouaga_hotspot_rooms_v1';
const LOCAL_STORAGE_ROOMS_KEY = 'cavale_ouaga_offline_rooms_v1';

interface PeerEntry {
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  isInitiator: boolean;
  connected: boolean;
}

interface DirectPendingSlot {
  slotId: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
}

export type TransportMode = 'lan_ws' | 'hotspot_p2p';

export interface UseMultiplayerResult {
  connected: boolean;
  connecting: boolean;
  transportMode: TransportMode;
  error: string | null;
  playerId: string | null;
  room: MultiplayerRoomSnapshot | null;
  availableRooms: PublicRoomSummary[];
  p2pCount: number;
  directOfferCode: string | null;
  directAnswerCode: string | null;
  directBusy: boolean;
  remotePosesRef: React.MutableRefObject<Map<string, RemoteRunnerPose>>;
  clearError: () => void;
  discoverRooms: () => void;
  createRoom: (name: string, characterId: CharacterId, outfitId: OutfitId, level?: number) => void;
  joinRoom: (code: string, name: string, characterId: CharacterId, outfitId: OutfitId) => void;
  updateProfile: (name: string, characterId: CharacterId, outfitId: OutfitId) => void;
  setLevel: (level: number) => void;
  startRace: () => void;
  playAgain: () => void;
  leaveRoom: () => void;
  createDirectInvite: () => Promise<void>;
  acceptDirectInvite: (
    offerCode: string,
    name: string,
    characterId: CharacterId,
    outfitId: OutfitId
  ) => Promise<void>;
  completeDirectInvite: (answerCode: string) => Promise<boolean>;
  resetDirectCodes: () => void;
  sendPose: (pose: Omit<RemoteRunnerPose, 'playerId' | 'ts'>) => void;
  sendFinished: (payload: {
    distanceMeters: number;
    worldScroll: number;
    coinsCollected: number;
    score: number;
    arrestReason: string;
  }) => void;
}

function encodeToken(prefix: string, obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return `${prefix}:${btoa(bin)}`;
}

function decodeToken<T>(raw: string, expectedPrefix: string): T | null {
  try {
    const trimmed = raw.trim();
    if (!trimmed.startsWith(`${expectedPrefix}:`)) return null;
    const b64 = trimmed.slice(expectedPrefix.length + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function waitForIceGathering(pc: RTCPeerConnection, timeoutMs: number = 900): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', onState);
      resolve();
    }, timeoutMs);
    const onState = () => {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', onState);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', onState);
  });
}

function computeLocalRankings(players: RoomPlayerInfo[]): RoomRankingEntry[] {
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

function sanitizeLocalName(raw: string | undefined, fallback: string): string {
  const cleaned = (raw || '').trim().replace(/\s+/g, ' ').slice(0, 14);
  return cleaned || fallback;
}

function readLocalStoredRooms(): Record<string, { room: MultiplayerRoomSnapshot; updatedAt: number }> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ROOMS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<
      string,
      { room: MultiplayerRoomSnapshot; updatedAt: number }
    >;
    const cutoff = Date.now() - 20 * 60 * 1000;
    const cleaned: Record<string, { room: MultiplayerRoomSnapshot; updatedAt: number }> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && v.room && v.updatedAt > cutoff) {
        cleaned[k] = v;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

function writeLocalStoredRoom(room: MultiplayerRoomSnapshot | null, removeCode?: string): void {
  try {
    const map = readLocalStoredRooms();
    if (removeCode) {
      delete map[removeCode];
    }
    if (room) {
      map[room.code] = { room, updatedAt: Date.now() };
    }
    localStorage.setItem(LOCAL_STORAGE_ROOMS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

function listLocalStoredSummaries(): PublicRoomSummary[] {
  const map = readLocalStoredRooms();
  const list: PublicRoomSummary[] = [];
  for (const entry of Object.values(map)) {
    const r = entry.room;
    if (r.status === 'LOBBY' && r.players.length > 0) {
      const host = r.players.find((p) => p.id === r.hostId) ?? r.players[0];
      list.push({
        code: r.code,
        hostName: host.name,
        level: r.level,
        playerCount: r.players.length,
        maxPlayers: 4,
        status: r.status,
      });
    }
  }
  return list;
}

type BcMessage =
  | { type: 'bc:rooms_ping' }
  | { type: 'bc:room_announce'; room: MultiplayerRoomSnapshot }
  | { type: 'bc:room_closed'; code: string }
  | {
      type: 'bc:join_request';
      code: string;
      playerId: string;
      name: string;
      characterId: CharacterId;
      outfitId: OutfitId;
    }
  | { type: 'bc:room_state'; room: MultiplayerRoomSnapshot }
  | { type: 'bc:race_start'; room: MultiplayerRoomSnapshot }
  | { type: 'bc:race_results'; room: MultiplayerRoomSnapshot }
  | { type: 'bc:pose'; code: string; pose: RemoteRunnerPose }
  | {
      type: 'bc:finished';
      code: string;
      playerId: string;
      distanceMeters: number;
      worldScroll: number;
      coinsCollected: number;
      score: number;
      arrestReason: string;
    }
  | {
      type: 'bc:update_profile';
      code: string;
      playerId: string;
      name: string;
      characterId: CharacterId;
      outfitId: OutfitId;
    }
  | { type: 'bc:leave'; code: string; playerId: string };

export function useMultiplayerClient(options?: {
  onRaceStart?: (room: MultiplayerRoomSnapshot) => void;
  onRaceResults?: (room: MultiplayerRoomSnapshot) => void;
}): UseMultiplayerResult {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [transportMode, setTransportMode] = useState<TransportMode>('lan_ws');
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<MultiplayerRoomSnapshot | null>(null);
  const [availableRooms, setAvailableRooms] = useState<PublicRoomSummary[]>(() =>
    listLocalStoredSummaries()
  );
  const [p2pCount, setP2pCount] = useState(0);
  const [directOfferCode, setDirectOfferCode] = useState<string | null>(null);
  const [directAnswerCode, setDirectAnswerCode] = useState<string | null>(null);
  const [directBusy, setDirectBusy] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const wsOpenPromiseRef = useRef<Promise<boolean> | null>(null);
  const lastWsFailAtRef = useRef<number>(0);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const transportModeRef = useRef<TransportMode>('lan_ws');
  transportModeRef.current = transportMode;

  const playerIdRef = useRef<string | null>(null);
  const roomRef = useRef<MultiplayerRoomSnapshot | null>(null);
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  const directPendingRef = useRef<DirectPendingSlot | null>(null);
  const guestDirectPcRef = useRef<{ pc: RTCPeerConnection; dc: RTCDataChannel | null } | null>(null);
  const remotePosesRef = useRef<Map<string, RemoteRunnerPose>>(new Map());
  const offlineFinishTimerRef = useRef<number | null>(null);
  const lastWsPoseSentRef = useRef<number>(0);
  const lastP2pPoseSentRef = useRef<number>(0);
  const onRaceStartRef = useRef(options?.onRaceStart);
  const onRaceResultsRef = useRef(options?.onRaceResults);

  onRaceStartRef.current = options?.onRaceStart;
  onRaceResultsRef.current = options?.onRaceResults;

  const refreshP2pCount = useCallback(() => {
    let count = 0;
    for (const entry of peersRef.current.values()) {
      if (entry.connected && entry.dc?.readyState === 'open') count++;
    }
    setP2pCount(count);
  }, []);

  const closeAllPeers = useCallback(() => {
    for (const entry of peersRef.current.values()) {
      try {
        entry.dc?.close();
      } catch {}
      try {
        entry.pc.close();
      } catch {}
    }
    peersRef.current.clear();

    if (directPendingRef.current) {
      try {
        directPendingRef.current.dc.close();
      } catch {}
      try {
        directPendingRef.current.pc.close();
      } catch {}
      directPendingRef.current = null;
    }

    if (guestDirectPcRef.current) {
      try {
        guestDirectPcRef.current.dc?.close();
      } catch {}
      try {
        guestDirectPcRef.current.pc.close();
      } catch {}
      guestDirectPcRef.current = null;
    }

    setDirectOfferCode(null);
    setDirectAnswerCode(null);
    setP2pCount(0);
  }, []);

  const sendWs = useCallback((msg: ClientWsMessage): boolean => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  const broadcastP2pPacket = useCallback((packet: P2PDataMessage, excludePeerId?: string) => {
    const raw = JSON.stringify(packet);
    for (const [peerId, entry] of peersRef.current.entries()) {
      if (excludePeerId && peerId === excludePeerId) continue;
      if (entry.dc?.readyState === 'open') {
        try {
          entry.dc.send(raw);
        } catch {
          // ignore transient send error
        }
      }
    }
  }, []);

  const postBc = useCallback((msg: BcMessage) => {
    try {
      bcRef.current?.postMessage(msg);
    } catch {
      // BroadcastChannel unavailable
    }
  }, []);

  const ingestRemotePose = useCallback((pose: RemoteRunnerPose) => {
    if (!pose || pose.playerId === playerIdRef.current) return;
    const prev = remotePosesRef.current.get(pose.playerId);
    if (prev && prev.worldScroll > pose.worldScroll + 0.5 && prev.isAlive === pose.isAlive) {
      return;
    }
    remotePosesRef.current.set(pose.playerId, pose);
  }, []);

  const commitOfflineRoomState = useCallback(
    (nextRoom: MultiplayerRoomSnapshot, emitBc: boolean = true) => {
      const normalized: MultiplayerRoomSnapshot = {
        ...nextRoom,
        rankings: computeLocalRankings(nextRoom.players),
      };
      roomRef.current = normalized;
      setRoom(normalized);
      writeLocalStoredRoom(normalized);
      setAvailableRooms(listLocalStoredSummaries());
      if (emitBc) {
        postBc({ type: 'bc:room_state', room: normalized });
      }
      if (normalized.hostId === playerIdRef.current) {
        broadcastP2pPacket({ type: 'p2p:room_state', room: normalized });
      }
    },
    [broadcastP2pPacket, postBc]
  );

  const finalizeOfflineRaceIfReady = useCallback(
    (currentRoom: MultiplayerRoomSnapshot) => {
      if (currentRoom.status !== 'RACING' || currentRoom.hostId !== playerIdRef.current) return;
      const alive = currentRoom.players.filter((p) => p.isAlive);
      const dead = currentRoom.players.filter((p) => !p.isAlive);

      const finishNow = (r: MultiplayerRoomSnapshot) => {
        if (offlineFinishTimerRef.current !== null) {
          window.clearTimeout(offlineFinishTimerRef.current);
          offlineFinishTimerRef.current = null;
        }
        const finished: MultiplayerRoomSnapshot = {
          ...r,
          status: 'FINISHED',
          rankings: computeLocalRankings(r.players),
        };
        roomRef.current = finished;
        setRoom(finished);
        writeLocalStoredRoom(finished);
        postBc({ type: 'bc:race_results', room: finished });
        broadcastP2pPacket({ type: 'p2p:race_results', room: finished });
        onRaceResultsRef.current?.(finished);
      };

      if (alive.length === 0) {
        finishNow(currentRoom);
        return;
      }

      if (alive.length === 1 && dead.length > 0 && currentRoom.players.length >= 2) {
        const survivor = alive[0];
        const maxDeadDistance = Math.max(...dead.map((d) => d.distanceMeters));
        if (survivor.distanceMeters > maxDeadDistance + 5 && offlineFinishTimerRef.current === null) {
          offlineFinishTimerRef.current = window.setTimeout(() => {
            offlineFinishTimerRef.current = null;
            const latest = roomRef.current;
            if (latest && latest.status === 'RACING') {
              finishNow(latest);
            }
          }, 1200);
        }
      }
    },
    [broadcastP2pPacket, postBc]
  );

  const handleIncomingP2pMessage = useCallback(
    (peerKey: string, data: P2PDataMessage) => {
      if (data.type === 'pose' && data.pose) {
        const pose = { ...data.pose, playerId: data.pose.playerId || peerKey };
        ingestRemotePose(pose);
        const curRoom = roomRef.current;
        if (curRoom && curRoom.hostId === playerIdRef.current && curRoom.status === 'RACING') {
          let changed = false;
          const nextPlayers = curRoom.players.map((p) => {
            if (p.id === pose.playerId && p.isAlive) {
              changed = true;
              return {
                ...p,
                distanceMeters: Math.max(p.distanceMeters, pose.distanceMeters),
                worldScroll: Math.max(p.worldScroll, pose.worldScroll),
                coinsCollected: Math.max(p.coinsCollected, pose.coinsCollected),
                score: Math.max(p.score, pose.score),
              };
            }
            return p;
          });
          if (changed) {
            roomRef.current = { ...curRoom, players: nextPlayers };
          }
          // Host relays poses to other P2P peers in multi-phone star mesh
          broadcastP2pPacket({ type: 'pose', pose }, peerKey);
          finalizeOfflineRaceIfReady(roomRef.current!);
        }
        return;
      }

      if (data.type === 'p2p:hello') {
        const curRoom = roomRef.current;
        if (!curRoom || curRoom.hostId !== playerIdRef.current) return;
        const usedSlots = new Set(curRoom.players.map((p) => p.slot));
        let freeSlot: 0 | 1 | 2 | 3 | null = null;
        for (const s of [0, 1, 2, 3] as const) {
          if (!usedSlots.has(s)) {
            freeSlot = s;
            break;
          }
        }
        if (freeSlot === null) return;

        // Re-key peer entry under real remote playerId so poses & disconnects match cleanly
        const existingEntry = peersRef.current.get(peerKey);
        if (existingEntry && peerKey !== data.playerId) {
          peersRef.current.delete(peerKey);
          peersRef.current.set(data.playerId, existingEntry);
        }

        const color = PLAYER_COLORS[freeSlot];
        const exists = curRoom.players.some((p) => p.id === data.playerId);
        const updatedPlayers: RoomPlayerInfo[] = exists
          ? curRoom.players.map((p) =>
              p.id === data.playerId
                ? {
                    ...p,
                    name: sanitizeLocalName(data.name, p.name),
                    characterId: data.characterId,
                    outfitId: data.outfitId,
                  }
                : p
            )
          : [
              ...curRoom.players,
              {
                id: data.playerId,
                name: sanitizeLocalName(data.name, `Joueur ${freeSlot + 1}`),
                slot: freeSlot,
                colorHex: color.hex,
                colorLabel: color.label,
                colorInt: color.int,
                characterId: data.characterId,
                outfitId: data.outfitId,
                isHost: false,
                isAlive: true,
                distanceMeters: 0,
                worldScroll: 0,
                coinsCollected: 0,
                score: 0,
              },
            ];

        const nextRoom: MultiplayerRoomSnapshot = {
          ...curRoom,
          players: updatedPlayers,
          rankings: computeLocalRankings(updatedPlayers),
        };
        roomRef.current = nextRoom;
        setRoom(nextRoom);
        writeLocalStoredRoom(nextRoom);
        setAvailableRooms(listLocalStoredSummaries());

        const entry = peersRef.current.get(data.playerId);
        if (entry?.dc?.readyState === 'open') {
          try {
            entry.dc.send(
              JSON.stringify({
                type: 'p2p:room_state',
                assignedPlayerId: data.playerId,
                room: nextRoom,
              } satisfies P2PDataMessage)
            );
          } catch {}
        }
        broadcastP2pPacket({ type: 'p2p:room_state', room: nextRoom }, data.playerId);
        setDirectOfferCode(null);
        return;
      }

      if (data.type === 'p2p:room_state') {
        if (data.assignedPlayerId) {
          playerIdRef.current = data.assignedPlayerId;
          setPlayerId(data.assignedPlayerId);
        }
        roomRef.current = data.room;
        setRoom(data.room);
        setDirectAnswerCode(null);
        setError(null);
        return;
      }

      if (data.type === 'p2p:race_start') {
        remotePosesRef.current.clear();
        roomRef.current = data.room;
        setRoom(data.room);
        onRaceStartRef.current?.(data.room);
        return;
      }

      if (data.type === 'p2p:race_results') {
        roomRef.current = data.room;
        setRoom(data.room);
        onRaceResultsRef.current?.(data.room);
        return;
      }

      if (data.type === 'p2p:finished') {
        const curRoom = roomRef.current;
        if (!curRoom || curRoom.hostId !== playerIdRef.current || curRoom.status !== 'RACING') return;
        const nextPlayers = curRoom.players.map((p) =>
          p.id === data.playerId
            ? {
                ...p,
                isAlive: false,
                distanceMeters: Math.max(p.distanceMeters, Math.floor(data.distanceMeters)),
                worldScroll: Math.max(p.worldScroll, data.worldScroll),
                coinsCollected: Math.max(p.coinsCollected, Math.floor(data.coinsCollected)),
                score: Math.max(p.score, Math.floor(data.score)),
                arrestReason: data.arrestReason,
              }
            : p
        );
        const updated: MultiplayerRoomSnapshot = {
          ...curRoom,
          players: nextPlayers,
          rankings: computeLocalRankings(nextPlayers),
        };
        commitOfflineRoomState(updated);
        finalizeOfflineRaceIfReady(updated);
        return;
      }

      if (data.type === 'p2p:update_profile') {
        const curRoom = roomRef.current;
        if (!curRoom || curRoom.hostId !== playerIdRef.current) return;
        const nextPlayers = curRoom.players.map((p) =>
          p.id === data.playerId
            ? {
                ...p,
                name: sanitizeLocalName(data.name, p.name),
                characterId: data.characterId,
                outfitId: data.outfitId,
              }
            : p
        );
        commitOfflineRoomState({ ...curRoom, players: nextPlayers });
        return;
      }

      if (data.type === 'p2p:leave') {
        const curRoom = roomRef.current;
        if (!curRoom || curRoom.hostId !== playerIdRef.current) return;
        const leavingId = data.playerId || peerKey;
        const peerEntry = peersRef.current.get(leavingId);
        if (peerEntry) {
          try {
            peerEntry.dc?.close();
          } catch {}
          try {
            peerEntry.pc.close();
          } catch {}
          peersRef.current.delete(leavingId);
          refreshP2pCount();
        }
        remotePosesRef.current.delete(leavingId);
        const nextPlayers = curRoom.players.filter((p) => p.id !== leavingId);
        const updated: MultiplayerRoomSnapshot = {
          ...curRoom,
          players: nextPlayers,
          rankings: computeLocalRankings(nextPlayers),
        };
        commitOfflineRoomState(updated);
        finalizeOfflineRaceIfReady(updated);
        return;
      }

      if (data.type === 'p2p:room_closed') {
        const curRoom = roomRef.current;
        if (!curRoom || curRoom.hostId === playerIdRef.current) return;
        if (offlineFinishTimerRef.current !== null) {
          window.clearTimeout(offlineFinishTimerRef.current);
          offlineFinishTimerRef.current = null;
        }
        closeAllPeers();
        remotePosesRef.current.clear();
        playerIdRef.current = null;
        roomRef.current = null;
        setPlayerId(null);
        setRoom(null);
        setError('L’hôte a fermé le salon.');
      }
    },
    [
      broadcastP2pPacket,
      closeAllPeers,
      commitOfflineRoomState,
      finalizeOfflineRaceIfReady,
      ingestRemotePose,
      refreshP2pCount,
    ]
  );

  const setupDataChannel = useCallback(
    (peerId: string, entry: PeerEntry, dc: RTCDataChannel, onOpenHook?: () => void) => {
      entry.dc = dc;
      dc.onopen = () => {
        entry.connected = true;
        refreshP2pCount();
        onOpenHook?.();
      };
      dc.onclose = () => {
        entry.connected = false;
        refreshP2pCount();
      };
      dc.onerror = () => {
        entry.connected = false;
        refreshP2pCount();
      };
      dc.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as P2PDataMessage;
          handleIncomingP2pMessage(peerId, data);
        } catch {
          // ignore malformed P2P message
        }
      };
    },
    [handleIncomingP2pMessage, refreshP2pCount]
  );

  const ensurePeerConnection = useCallback(
    (remoteId: string, initiateOffer: boolean): PeerEntry | null => {
      if (typeof RTCPeerConnection === 'undefined') return null;
      const existing = peersRef.current.get(remoteId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(LOCAL_RTC_CONFIG);
      const entry: PeerEntry = {
        pc,
        dc: null,
        isInitiator: initiateOffer,
        connected: false,
      };
      peersRef.current.set(remoteId, entry);

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendWs({
            type: 'rtc:signal',
            toId: remoteId,
            candidate: ev.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed' ||
          pc.connectionState === 'disconnected'
        ) {
          entry.connected = false;
          refreshP2pCount();
        }
      };

      pc.ondatachannel = (ev) => {
        setupDataChannel(remoteId, entry, ev.channel);
      };

      if (initiateOffer) {
        const dc = pc.createDataChannel('poses', {
          ordered: false,
          maxRetransmits: 0,
        });
        setupDataChannel(remoteId, entry, dc);
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (pc.localDescription) {
              sendWs({
                type: 'rtc:signal',
                toId: remoteId,
                description: pc.localDescription.toJSON(),
              });
            }
          })
          .catch(() => {});
      }

      return entry;
    },
    [refreshP2pCount, sendWs, setupDataChannel]
  );

  const handleRtcSignal = useCallback(
    async (signal: RtcSignalPayload) => {
      const myId = playerIdRef.current;
      if (!myId || signal.fromId === myId) return;
      const entry = ensurePeerConnection(signal.fromId, false);
      if (!entry) return;
      const pc = entry.pc;

      try {
        if (signal.description) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.description));
          if (signal.description.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (pc.localDescription) {
              sendWs({
                type: 'rtc:signal',
                toId: signal.fromId,
                description: pc.localDescription.toJSON(),
              });
            }
          }
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch {
        // WebSocket relay fallback stays active
      }
    },
    [ensurePeerConnection, sendWs]
  );

  const syncPeersForRoom = useCallback(
    (nextRoom: MultiplayerRoomSnapshot) => {
      if (transportModeRef.current !== 'lan_ws') return;
      const myId = playerIdRef.current;
      if (!myId) return;
      const activeIds = new Set(nextRoom.players.map((p) => p.id));

      for (const [peerId, entry] of peersRef.current.entries()) {
        if (!activeIds.has(peerId)) {
          try {
            entry.dc?.close();
          } catch {}
          try {
            entry.pc.close();
          } catch {}
          peersRef.current.delete(peerId);
          remotePosesRef.current.delete(peerId);
        }
      }

      for (const p of nextRoom.players) {
        if (p.id === myId) continue;
        if (!peersRef.current.has(p.id)) {
          ensurePeerConnection(p.id, myId < p.id);
        }
      }
      refreshP2pCount();
    },
    [ensurePeerConnection, refreshP2pCount]
  );

  // Local BroadcastChannel for zero-internet local discovery & multi-tab sync
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel(LOCAL_CHANNEL_NAME);
    bcRef.current = bc;

    bc.onmessage = (ev: MessageEvent<BcMessage>) => {
      const msg = ev.data;
      if (!msg) return;

      if (msg.type === 'bc:rooms_ping') {
        const curRoom = roomRef.current;
        if (
          curRoom &&
          curRoom.status === 'LOBBY' &&
          curRoom.hostId === playerIdRef.current &&
          transportModeRef.current === 'hotspot_p2p'
        ) {
          bc.postMessage({ type: 'bc:room_announce', room: curRoom } satisfies BcMessage);
        }
        return;
      }

      if (msg.type === 'bc:room_announce') {
        writeLocalStoredRoom(msg.room);
        setAvailableRooms(listLocalStoredSummaries());
        return;
      }

      if (msg.type === 'bc:room_closed') {
        writeLocalStoredRoom(null, msg.code);
        setAvailableRooms(listLocalStoredSummaries());
        const curRoom = roomRef.current;
        if (curRoom && curRoom.code === msg.code && curRoom.hostId !== playerIdRef.current) {
          if (offlineFinishTimerRef.current !== null) {
            window.clearTimeout(offlineFinishTimerRef.current);
            offlineFinishTimerRef.current = null;
          }
          closeAllPeers();
          remotePosesRef.current.clear();
          playerIdRef.current = null;
          roomRef.current = null;
          setPlayerId(null);
          setRoom(null);
          setError('L’hôte a fermé le salon.');
        }
        return;
      }

      if (msg.type === 'bc:join_request') {
        const curRoom = roomRef.current;
        if (
          !curRoom ||
          curRoom.code !== msg.code ||
          curRoom.hostId !== playerIdRef.current ||
          curRoom.status !== 'LOBBY' ||
          curRoom.players.length >= 4
        ) {
          return;
        }
        const used = new Set(curRoom.players.map((p) => p.slot));
        const freeSlot = ([0, 1, 2, 3] as const).find((s) => !used.has(s)) ?? 0;
        const color = PLAYER_COLORS[freeSlot];
        const exists = curRoom.players.some((p) => p.id === msg.playerId);
        const nextPlayers = exists
          ? curRoom.players
          : [
              ...curRoom.players,
              {
                id: msg.playerId,
                name: sanitizeLocalName(msg.name, `Joueur ${freeSlot + 1}`),
                slot: freeSlot,
                colorHex: color.hex,
                colorLabel: color.label,
                colorInt: color.int,
                characterId: msg.characterId,
                outfitId: msg.outfitId,
                isHost: false,
                isAlive: true,
                distanceMeters: 0,
                worldScroll: 0,
                coinsCollected: 0,
                score: 0,
              },
            ];
        commitOfflineRoomState({ ...curRoom, players: nextPlayers });
        return;
      }

      if (msg.type === 'bc:room_state') {
        writeLocalStoredRoom(msg.room);
        setAvailableRooms(listLocalStoredSummaries());
        const cur = roomRef.current;
        const myId = playerIdRef.current;
        if (
          (cur && cur.code === msg.room.code) ||
          (myId && msg.room.players.some((p) => p.id === myId))
        ) {
          roomRef.current = msg.room;
          setRoom(msg.room);
          setError(null);
        }
        return;
      }

      if (msg.type === 'bc:race_start') {
        if (roomRef.current?.code === msg.room.code) {
          remotePosesRef.current.clear();
          roomRef.current = msg.room;
          setRoom(msg.room);
          onRaceStartRef.current?.(msg.room);
        }
        return;
      }

      if (msg.type === 'bc:race_results') {
        if (roomRef.current?.code === msg.room.code) {
          roomRef.current = msg.room;
          setRoom(msg.room);
          onRaceResultsRef.current?.(msg.room);
        }
        return;
      }

      if (msg.type === 'bc:pose') {
        if (roomRef.current?.code === msg.code) {
          ingestRemotePose(msg.pose);
        }
        return;
      }

      if (msg.type === 'bc:finished') {
        const curRoom = roomRef.current;
        if (
          curRoom &&
          curRoom.code === msg.code &&
          curRoom.hostId === playerIdRef.current &&
          curRoom.status === 'RACING'
        ) {
          const nextPlayers = curRoom.players.map((p) =>
            p.id === msg.playerId
              ? {
                  ...p,
                  isAlive: false,
                  distanceMeters: Math.max(p.distanceMeters, Math.floor(msg.distanceMeters)),
                  worldScroll: Math.max(p.worldScroll, msg.worldScroll),
                  coinsCollected: Math.max(p.coinsCollected, Math.floor(msg.coinsCollected)),
                  score: Math.max(p.score, Math.floor(msg.score)),
                  arrestReason: msg.arrestReason,
                }
              : p
          );
          const updated: MultiplayerRoomSnapshot = {
            ...curRoom,
            players: nextPlayers,
            rankings: computeLocalRankings(nextPlayers),
          };
          commitOfflineRoomState(updated);
          finalizeOfflineRaceIfReady(updated);
        }
        return;
      }

      if (msg.type === 'bc:update_profile') {
        const curRoom = roomRef.current;
        if (curRoom && curRoom.code === msg.code && curRoom.hostId === playerIdRef.current) {
          const nextPlayers = curRoom.players.map((p) =>
            p.id === msg.playerId
              ? {
                  ...p,
                  name: sanitizeLocalName(msg.name, p.name),
                  characterId: msg.characterId,
                  outfitId: msg.outfitId,
                }
              : p
          );
          commitOfflineRoomState({ ...curRoom, players: nextPlayers });
        }
        return;
      }

      if (msg.type === 'bc:leave') {
        const curRoom = roomRef.current;
        if (curRoom && curRoom.code === msg.code && curRoom.hostId === playerIdRef.current) {
          remotePosesRef.current.delete(msg.playerId);
          const nextPlayers = curRoom.players.filter((p) => p.id !== msg.playerId);
          const updated: MultiplayerRoomSnapshot = {
            ...curRoom,
            players: nextPlayers,
            rankings: computeLocalRankings(nextPlayers),
          };
          commitOfflineRoomState(updated);
          finalizeOfflineRaceIfReady(updated);
        }
      }
    };

    return () => {
      bc.close();
      bcRef.current = null;
    };
  }, [closeAllPeers, commitOfflineRoomState, finalizeOfflineRaceIfReady, ingestRemotePose]);

  const ensureWsConnected = useCallback(
    (opts?: { silent?: boolean }): Promise<boolean> => {
      const existing = wsRef.current;
      if (existing && existing.readyState === WebSocket.OPEN) {
        return Promise.resolve(true);
      }

      // If offline on a remote HTTPS URL (no local server on this host), switch seamlessly to offline Hotspot P2P
      const host = window.location.hostname;
      const isLocalHost =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.startsWith('192.168.') ||
        host.startsWith('10.') ||
        host.startsWith('172.');
      if (typeof navigator !== 'undefined' && !navigator.onLine && !isLocalHost) {
        setTransportMode('hotspot_p2p');
        setConnected(false);
        setConnecting(false);
        return Promise.resolve(false);
      }

      // Avoid hammering WebSocket or flickering spinners during background room polling after a failure
      if (opts?.silent && lastWsFailAtRef.current > 0 && Date.now() - lastWsFailAtRef.current < 15000) {
        setTransportMode('hotspot_p2p');
        return Promise.resolve(false);
      }

      if (wsOpenPromiseRef.current) {
        return wsOpenPromiseRef.current;
      }

      if (!opts?.silent) {
        setConnecting(true);
      }
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/multiplayer`);
      wsRef.current = ws;

      const promise = new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          wsOpenPromiseRef.current = null;
          setConnecting(false);
          if (ok) {
            lastWsFailAtRef.current = 0;
            setTransportMode('lan_ws');
            setConnected(true);
          } else {
            lastWsFailAtRef.current = Date.now();
            setTransportMode('hotspot_p2p');
            setConnected(false);
            try {
              ws.close();
            } catch {}
            if (wsRef.current === ws) wsRef.current = null;
          }
          resolve(ok);
        };

        const timeoutId = window.setTimeout(() => {
          finish(false);
        }, 1500);

        ws.onopen = () => {
          finish(true);
          ws.send(JSON.stringify({ type: 'rooms:subscribe' } satisfies ClientWsMessage));
        };

      ws.onmessage = (ev) => {
        let data: ServerWsMessage;
        try {
          data = JSON.parse(String(ev.data)) as ServerWsMessage;
        } catch {
          return;
        }

        if (data.type === 'rooms:list') {
          setAvailableRooms(data.rooms);
        } else if (data.type === 'room:joined') {
          playerIdRef.current = data.playerId;
          setPlayerId(data.playerId);
          roomRef.current = data.room;
          setRoom(data.room);
          setError(null);
          syncPeersForRoom(data.room);
        } else if (data.type === 'room:state') {
          roomRef.current = data.room;
          setRoom(data.room);
          syncPeersForRoom(data.room);
        } else if (data.type === 'race:start') {
          remotePosesRef.current.clear();
          roomRef.current = data.room;
          setRoom(data.room);
          syncPeersForRoom(data.room);
          onRaceStartRef.current?.(data.room);
        } else if (data.type === 'race:results') {
          roomRef.current = data.room;
          setRoom(data.room);
          onRaceResultsRef.current?.(data.room);
        } else if (data.type === 'player:pose') {
          ingestRemotePose(data.pose);
        } else if (data.type === 'rtc:signal') {
          void handleRtcSignal(data.signal);
        } else if (data.type === 'room:error') {
          setError(data.message);
        }
      };

      ws.onerror = () => {
        // Never show a blocking "no internet" error! Fall back cleanly to offline Hotspot mode.
        finish(false);
      };

      ws.onclose = () => {
        setConnected(false);
        setConnecting(false);
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (!settled) {
          finish(false);
        }
      };
    });

    wsOpenPromiseRef.current = promise;
    return promise;
  }, [handleRtcSignal, ingestRemotePose, syncPeersForRoom]);

  useEffect(() => {
    return () => {
      if (offlineFinishTimerRef.current !== null) {
        window.clearTimeout(offlineFinishTimerRef.current);
      }
      closeAllPeers();
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    };
  }, [closeAllPeers]);

  const clearError = useCallback(() => setError(null), []);

  const discoverRooms = useCallback(() => {
    setAvailableRooms(listLocalStoredSummaries());
    postBc({ type: 'bc:rooms_ping' });
    void ensureWsConnected({ silent: true }).then((ok) => {
      if (ok) {
        sendWs({ type: 'rooms:subscribe' });
      } else {
        setAvailableRooms(listLocalStoredSummaries());
      }
    });
  }, [ensureWsConnected, postBc, sendWs]);

  const createRoom = useCallback(
    (name: string, characterId: CharacterId, outfitId: OutfitId, level: number = 1) => {
      setError(null);
      void ensureWsConnected().then((ok) => {
        if (ok) {
          setTransportMode('lan_ws');
          sendWs({ type: 'room:create', name, characterId, outfitId, level });
          return;
        }

        // 100% Offline Hotspot P2P Room Creation (zero internet needed)
        setTransportMode('hotspot_p2p');
        const code = String(Math.floor(1000 + Math.random() * 9000));
        const myId = `p_${Math.random().toString(36).slice(2, 10)}`;
        const color = PLAYER_COLORS[0];
        const hostPlayer: RoomPlayerInfo = {
          id: myId,
          name: sanitizeLocalName(name, 'DIDI'),
          slot: 0,
          colorHex: color.hex,
          colorLabel: color.label,
          colorInt: color.int,
          characterId,
          outfitId,
          isHost: true,
          isAlive: true,
          distanceMeters: 0,
          worldScroll: 0,
          coinsCollected: 0,
          score: 0,
        };
        const offlineRoom: MultiplayerRoomSnapshot = {
          code,
          status: 'LOBBY',
          level: Math.max(1, Math.floor(level || 1)),
          seed: Math.floor(1 + Math.random() * 2000000000),
          hostId: myId,
          players: [hostPlayer],
          rankings: computeLocalRankings([hostPlayer]),
        };
        playerIdRef.current = myId;
        setPlayerId(myId);
        roomRef.current = offlineRoom;
        setRoom(offlineRoom);
        writeLocalStoredRoom(offlineRoom);
        setAvailableRooms(listLocalStoredSummaries());
        postBc({ type: 'bc:room_announce', room: offlineRoom });
      });
    },
    [ensureWsConnected, postBc, sendWs]
  );

  const joinRoom = useCallback(
    (code: string, name: string, characterId: CharacterId, outfitId: OutfitId) => {
      setError(null);
      const cleanedCode = code.replace(/\D/g, '').slice(0, 4);
      void ensureWsConnected().then((ok) => {
        if (ok) {
          setTransportMode('lan_ws');
          sendWs({ type: 'room:join', code: cleanedCode, name, characterId, outfitId });
          return;
        }

        // Offline local/BroadcastChannel join by 4-digit code
        setTransportMode('hotspot_p2p');
        const stored = readLocalStoredRooms()[cleanedCode];
        if (!stored) {
          setError(
            `Salon "${cleanedCode}" non détecté ici. Sur 2 téléphones sans serveur local, utilisez "Connexion directe Hotspot".`
          );
          return;
        }
        if (stored.room.status !== 'LOBBY') {
          setError('Cette partie a déjà commencé.');
          return;
        }
        if (stored.room.players.length >= 4) {
          setError('Ce salon est déjà complet (4/4 joueurs).');
          return;
        }
        const myId = `p_${Math.random().toString(36).slice(2, 10)}`;
        playerIdRef.current = myId;
        setPlayerId(myId);

        const used = new Set(stored.room.players.map((p) => p.slot));
        const freeSlot = ([0, 1, 2, 3] as const).find((s) => !used.has(s)) ?? 0;
        const color = PLAYER_COLORS[freeSlot];
        const joinedPlayer: RoomPlayerInfo = {
          id: myId,
          name: sanitizeLocalName(name, `Joueur ${freeSlot + 1}`),
          slot: freeSlot,
          colorHex: color.hex,
          colorLabel: color.label,
          colorInt: color.int,
          characterId,
          outfitId,
          isHost: false,
          isAlive: true,
          distanceMeters: 0,
          worldScroll: 0,
          coinsCollected: 0,
          score: 0,
        };
        const updatedRoom: MultiplayerRoomSnapshot = {
          ...stored.room,
          players: [...stored.room.players, joinedPlayer],
          rankings: computeLocalRankings([...stored.room.players, joinedPlayer]),
        };
        roomRef.current = updatedRoom;
        setRoom(updatedRoom);
        writeLocalStoredRoom(updatedRoom);
        postBc({
          type: 'bc:join_request',
          code: cleanedCode,
          playerId: myId,
          name: joinedPlayer.name,
          characterId,
          outfitId,
        });
      });
    },
    [ensureWsConnected, postBc, sendWs]
  );

  const updateProfile = useCallback(
    (name: string, characterId: CharacterId, outfitId: OutfitId) => {
      if (transportModeRef.current === 'lan_ws' && sendWs({ type: 'room:update_profile', name, characterId, outfitId })) {
        return;
      }
      const curRoom = roomRef.current;
      const myId = playerIdRef.current;
      if (!curRoom || !myId) return;
      if (curRoom.hostId === myId) {
        const nextPlayers = curRoom.players.map((p) =>
          p.id === myId
            ? { ...p, name: sanitizeLocalName(name, p.name), characterId, outfitId }
            : p
        );
        commitOfflineRoomState({ ...curRoom, players: nextPlayers });
      } else {
        postBc({
          type: 'bc:update_profile',
          code: curRoom.code,
          playerId: myId,
          name,
          characterId,
          outfitId,
        });
        broadcastP2pPacket({
          type: 'p2p:update_profile',
          playerId: myId,
          name,
          characterId,
          outfitId,
        });
      }
    },
    [broadcastP2pPacket, commitOfflineRoomState, postBc, sendWs]
  );

  const setLevel = useCallback(
    (level: number) => {
      if (transportModeRef.current === 'lan_ws' && sendWs({ type: 'room:set_level', level })) {
        return;
      }
      const curRoom = roomRef.current;
      if (!curRoom || curRoom.hostId !== playerIdRef.current || curRoom.status !== 'LOBBY') return;
      commitOfflineRoomState({
        ...curRoom,
        level: Math.max(1, Math.min(60, Math.floor(level || 1))),
      });
    },
    [commitOfflineRoomState, sendWs]
  );

  const startRace = useCallback(() => {
    if (transportModeRef.current === 'lan_ws' && sendWs({ type: 'room:start' })) {
      return;
    }
    const curRoom = roomRef.current;
    if (!curRoom || curRoom.hostId !== playerIdRef.current) return;
    if (curRoom.players.length < 2) {
      setError('Il faut au moins 2 joueurs pour lancer la partie.');
      return;
    }
    const started: MultiplayerRoomSnapshot = {
      ...curRoom,
      status: 'RACING',
      seed: Math.floor(1 + Math.random() * 2000000000),
      players: curRoom.players.map((p) => ({
        ...p,
        isAlive: true,
        distanceMeters: 0,
        worldScroll: 0,
        coinsCollected: 0,
        score: 0,
        arrestReason: undefined,
      })),
    };
    started.rankings = computeLocalRankings(started.players);
    remotePosesRef.current.clear();
    roomRef.current = started;
    setRoom(started);
    writeLocalStoredRoom(started);
    postBc({ type: 'bc:race_start', room: started });
    broadcastP2pPacket({ type: 'p2p:race_start', room: started });
    onRaceStartRef.current?.(started);
  }, [broadcastP2pPacket, postBc, sendWs]);

  const playAgain = useCallback(() => {
    remotePosesRef.current.clear();
    if (transportModeRef.current === 'lan_ws' && sendWs({ type: 'room:play_again' })) {
      return;
    }
    const curRoom = roomRef.current;
    if (!curRoom || curRoom.hostId !== playerIdRef.current) return;
    const resetPlayers = curRoom.players.map((p) => ({
      ...p,
      isAlive: true,
      distanceMeters: 0,
      worldScroll: 0,
      coinsCollected: 0,
      score: 0,
      arrestReason: undefined,
    }));
    commitOfflineRoomState({
      ...curRoom,
      status: 'LOBBY',
      players: resetPlayers,
    });
  }, [commitOfflineRoomState, sendWs]);

  const leaveRoom = useCallback(() => {
    if (offlineFinishTimerRef.current !== null) {
      window.clearTimeout(offlineFinishTimerRef.current);
      offlineFinishTimerRef.current = null;
    }
    const curRoom = roomRef.current;
    const myId = playerIdRef.current;
    sendWs({ type: 'room:leave' });
    if (curRoom && myId) {
      if (curRoom.hostId === myId) {
        writeLocalStoredRoom(null, curRoom.code);
        postBc({ type: 'bc:room_closed', code: curRoom.code });
        broadcastP2pPacket({ type: 'p2p:room_closed' });
      } else {
        postBc({ type: 'bc:leave', code: curRoom.code, playerId: myId });
        broadcastP2pPacket({ type: 'p2p:leave', playerId: myId });
      }
    }
    closeAllPeers();
    remotePosesRef.current.clear();
    playerIdRef.current = null;
    roomRef.current = null;
    setPlayerId(null);
    setRoom(null);
    setError(null);
    setAvailableRooms(listLocalStoredSummaries());
  }, [broadcastP2pPacket, closeAllPeers, postBc, sendWs]);

  // Direct Offline WebRTC P2P Pairing (works across 2+ phones on same Hotspot with ZERO internet & ZERO server)
  const createDirectInvite = useCallback(async () => {
    const curRoom = roomRef.current;
    if (!curRoom || typeof RTCPeerConnection === 'undefined') return;
    setError(null);
    setDirectBusy(true);
    try {
      if (directPendingRef.current) {
        try {
          directPendingRef.current.dc.close();
        } catch {}
        try {
          directPendingRef.current.pc.close();
        } catch {}
      }
      const slotId = `direct_${Math.random().toString(36).slice(2, 9)}`;
      const pc = new RTCPeerConnection(LOCAL_RTC_CONFIG);
      const dc = pc.createDataChannel('cavale', { ordered: true });
      const entry: PeerEntry = { pc, dc, isInitiator: true, connected: false };
      peersRef.current.set(slotId, entry);
      setupDataChannel(slotId, entry, dc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc, 900);

      directPendingRef.current = { slotId, pc, dc };
      const hostName =
        curRoom.players.find((p) => p.id === curRoom.hostId)?.name || 'DIDI';
      const token = encodeToken('CO1', {
        c: curRoom.code,
        h: hostName,
        s: pc.localDescription?.sdp || '',
      });
      setDirectOfferCode(token);
    } catch {
      setError('Impossible de générer le code direct P2P sur cet appareil.');
    } finally {
      setDirectBusy(false);
    }
  }, [setupDataChannel]);

  const acceptDirectInvite = useCallback(
    async (offerCode: string, name: string, characterId: CharacterId, outfitId: OutfitId) => {
      const payload = decodeToken<{ c: string; h: string; s: string }>(offerCode, 'CO1');
      if (!payload || !payload.s) {
        setError('Code d’invitation Hotspot invalide. Copiez tout le bloc CO1:...');
        return;
      }
      if (typeof RTCPeerConnection === 'undefined') {
        setError('WebRTC non supporté par ce navigateur.');
        return;
      }

      setError(null);
      setDirectBusy(true);
      try {
        const myId = `p_${Math.random().toString(36).slice(2, 10)}`;
        playerIdRef.current = myId;
        setPlayerId(myId);
        setTransportMode('hotspot_p2p');

        const pc = new RTCPeerConnection(LOCAL_RTC_CONFIG);
        const entry: PeerEntry = { pc, dc: null, isInitiator: false, connected: false };
        peersRef.current.set('host_direct', entry);
        guestDirectPcRef.current = { pc, dc: null };

        pc.ondatachannel = (ev) => {
          if (guestDirectPcRef.current) guestDirectPcRef.current.dc = ev.channel;
          setupDataChannel('host_direct', entry, ev.channel, () => {
            ev.channel.send(
              JSON.stringify({
                type: 'p2p:hello',
                playerId: myId,
                name: sanitizeLocalName(name, 'AWA'),
                characterId,
                outfitId,
              } satisfies P2PDataMessage)
            );
          });
        };

        await pc.setRemoteDescription({ type: 'offer', sdp: payload.s });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitForIceGathering(pc, 900);

        const answerToken = encodeToken('CA1', {
          s: pc.localDescription?.sdp || '',
        });
        setDirectAnswerCode(answerToken);
      } catch {
        setError('Erreur lors de la connexion directe Hotspot.');
      } finally {
        setDirectBusy(false);
      }
    },
    [setupDataChannel]
  );

  const completeDirectInvite = useCallback(async (answerCode: string): Promise<boolean> => {
    const payload = decodeToken<{ s: string }>(answerCode, 'CA1');
    const pending = directPendingRef.current;
    if (!payload || !payload.s || !pending) {
      setError('Code de réponse invalide. Copiez tout le bloc CA1:...');
      return false;
    }
    setError(null);
    setDirectBusy(true);
    try {
      await pending.pc.setRemoteDescription({ type: 'answer', sdp: payload.s });
      directPendingRef.current = null;
      return true;
    } catch {
      setError('Impossible de valider la réponse du pote. Régénérez un code.');
      return false;
    } finally {
      setDirectBusy(false);
    }
  }, []);

  const resetDirectCodes = useCallback(() => {
    setDirectOfferCode(null);
    setDirectAnswerCode(null);
  }, []);

  const sendPose = useCallback(
    (pose: Omit<RemoteRunnerPose, 'playerId' | 'ts'>) => {
      const myId = playerIdRef.current;
      if (!myId) return;
      const now = performance.now();
      const fullPose: RemoteRunnerPose = { ...pose, playerId: myId, ts: Date.now() };

      // Fast P2P over WebRTC DataChannels (~20 Hz)
      if (now - lastP2pPoseSentRef.current >= 48) {
        lastP2pPoseSentRef.current = now;
        broadcastP2pPacket({ type: 'pose', pose: fullPose });
        if (transportModeRef.current === 'hotspot_p2p' && roomRef.current) {
          postBc({ type: 'bc:pose', code: roomRef.current.code, pose: fullPose });
        }
      }

      // Mirror to local LAN WS server (~10 Hz) if connected
      if (transportModeRef.current === 'lan_ws' && now - lastWsPoseSentRef.current >= 95) {
        lastWsPoseSentRef.current = now;
        sendWs({ type: 'player:pose', pose });
      }
    },
    [broadcastP2pPacket, postBc, sendWs]
  );

  const sendFinished = useCallback(
    (payload: {
      distanceMeters: number;
      worldScroll: number;
      coinsCollected: number;
      score: number;
      arrestReason: string;
    }) => {
      if (transportModeRef.current === 'lan_ws' && sendWs({ type: 'player:finished', ...payload })) {
        return;
      }
      const curRoom = roomRef.current;
      const myId = playerIdRef.current;
      if (!curRoom || !myId) return;

      if (curRoom.hostId === myId) {
        const nextPlayers = curRoom.players.map((p) =>
          p.id === myId
            ? {
                ...p,
                isAlive: false,
                distanceMeters: Math.max(p.distanceMeters, Math.floor(payload.distanceMeters)),
                worldScroll: Math.max(p.worldScroll, payload.worldScroll),
                coinsCollected: Math.max(p.coinsCollected, Math.floor(payload.coinsCollected)),
                score: Math.max(p.score, Math.floor(payload.score)),
                arrestReason: payload.arrestReason,
              }
            : p
        );
        const updated: MultiplayerRoomSnapshot = {
          ...curRoom,
          players: nextPlayers,
          rankings: computeLocalRankings(nextPlayers),
        };
        commitOfflineRoomState(updated);
        finalizeOfflineRaceIfReady(updated);
      } else {
        postBc({ type: 'bc:finished', code: curRoom.code, playerId: myId, ...payload });
        broadcastP2pPacket({ type: 'p2p:finished', playerId: myId, ...payload });
      }
    },
    [broadcastP2pPacket, commitOfflineRoomState, finalizeOfflineRaceIfReady, postBc, sendWs]
  );

  return {
    connected,
    connecting,
    transportMode,
    error,
    playerId,
    room,
    availableRooms,
    p2pCount,
    directOfferCode,
    directAnswerCode,
    directBusy,
    remotePosesRef,
    clearError,
    discoverRooms,
    createRoom,
    joinRoom,
    updateProfile,
    setLevel,
    startRace,
    playAgain,
    leaveRoom,
    createDirectInvite,
    acceptDirectInvite,
    completeDirectInvite,
    resetDirectCodes,
    sendPose,
    sendFinished,
  };
}
