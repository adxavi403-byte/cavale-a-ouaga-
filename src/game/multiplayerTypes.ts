import type { CharacterId, OutfitId } from './shop';

export interface PlayerColorSlot {
  slot: 0 | 1 | 2 | 3;
  id: 'red' | 'blue' | 'green' | 'yellow';
  label: string;
  hex: string;
  int: number;
  textHex: string;
}

export const PLAYER_COLORS: PlayerColorSlot[] = [
  {
    slot: 0,
    id: 'red',
    label: 'Rouge',
    hex: '#EF4444',
    int: 0xef4444,
    textHex: '#FFFFFF',
  },
  {
    slot: 1,
    id: 'blue',
    label: 'Bleu',
    hex: '#3B82F6',
    int: 0x3b82f6,
    textHex: '#FFFFFF',
  },
  {
    slot: 2,
    id: 'green',
    label: 'Vert',
    hex: '#22C55E',
    int: 0x22c55e,
    textHex: '#052E16',
  },
  {
    slot: 3,
    id: 'yellow',
    label: 'Jaune',
    hex: '#FACC15',
    int: 0xfacc15,
    textHex: '#1C1917',
  },
];

export type RoomStatus = 'LOBBY' | 'RACING' | 'FINISHED';

export interface RoomPlayerInfo {
  id: string;
  name: string;
  slot: 0 | 1 | 2 | 3;
  colorHex: string;
  colorLabel: string;
  colorInt: number;
  characterId: CharacterId;
  outfitId: OutfitId;
  isHost: boolean;
  isAlive: boolean;
  distanceMeters: number;
  worldScroll: number;
  coinsCollected: number;
  score: number;
  arrestReason?: string;
}

export interface RoomRankingEntry {
  rank: number;
  playerId: string;
  name: string;
  slot: 0 | 1 | 2 | 3;
  colorHex: string;
  colorLabel: string;
  characterId: CharacterId;
  outfitId: OutfitId;
  distanceMeters: number;
  coinsCollected: number;
  score: number;
  isAlive: boolean;
  isWinner: boolean;
}

export interface PublicRoomSummary {
  code: string;
  hostName: string;
  level: number;
  playerCount: number;
  maxPlayers: number;
  status: RoomStatus;
}

export interface MultiplayerRoomSnapshot {
  code: string;
  status: RoomStatus;
  level: number;
  seed: number;
  hostId: string;
  players: RoomPlayerInfo[];
  rankings: RoomRankingEntry[];
}

export interface RemoteRunnerPose {
  playerId: string;
  x: number;
  y: number;
  lane: -1 | 0 | 1;
  worldScroll: number;
  distanceMeters: number;
  coinsCollected: number;
  score: number;
  isSliding: boolean;
  isGrounded: boolean;
  turboActive: boolean;
  hasShield: boolean;
  runCycle: number;
  isAlive: boolean;
  ts: number;
}

export interface RtcSignalPayload {
  fromId: string;
  toId: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export type ClientWsMessage =
  | {
      type: 'rooms:subscribe';
    }
  | {
      type: 'room:create';
      name: string;
      characterId: CharacterId;
      outfitId: OutfitId;
      level?: number;
    }
  | {
      type: 'room:join';
      code: string;
      name: string;
      characterId: CharacterId;
      outfitId: OutfitId;
    }
  | {
      type: 'room:update_profile';
      name: string;
      characterId: CharacterId;
      outfitId: OutfitId;
    }
  | {
      type: 'room:set_level';
      level: number;
    }
  | {
      type: 'room:start';
    }
  | {
      type: 'room:play_again';
    }
  | {
      type: 'room:leave';
    }
  | {
      type: 'player:pose';
      pose: Omit<RemoteRunnerPose, 'playerId' | 'ts'>;
    }
  | {
      type: 'player:finished';
      distanceMeters: number;
      worldScroll: number;
      coinsCollected: number;
      score: number;
      arrestReason: string;
    }
  | {
      type: 'rtc:signal';
      toId: string;
      description?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
    };

export type ServerWsMessage =
  | {
      type: 'rooms:list';
      rooms: PublicRoomSummary[];
    }
  | {
      type: 'room:joined';
      playerId: string;
      room: MultiplayerRoomSnapshot;
    }
  | {
      type: 'room:state';
      room: MultiplayerRoomSnapshot;
    }
  | {
      type: 'race:start';
      room: MultiplayerRoomSnapshot;
    }
  | {
      type: 'race:results';
      room: MultiplayerRoomSnapshot;
    }
  | {
      type: 'player:pose';
      pose: RemoteRunnerPose;
    }
  | {
      type: 'rtc:signal';
      signal: RtcSignalPayload;
    }
  | {
      type: 'room:error';
      message: string;
    };

export type P2PDataMessage =
  | {
      type: 'pose';
      pose: RemoteRunnerPose;
    }
  | {
      type: 'p2p:hello';
      playerId: string;
      name: string;
      characterId: CharacterId;
      outfitId: OutfitId;
    }
  | {
      type: 'p2p:room_state';
      assignedPlayerId?: string;
      room: MultiplayerRoomSnapshot;
    }
  | {
      type: 'p2p:race_start';
      room: MultiplayerRoomSnapshot;
    }
  | {
      type: 'p2p:race_results';
      room: MultiplayerRoomSnapshot;
    }
  | {
      type: 'p2p:finished';
      playerId: string;
      distanceMeters: number;
      worldScroll: number;
      coinsCollected: number;
      score: number;
      arrestReason: string;
    }
  | {
      type: 'p2p:update_profile';
      playerId: string;
      name: string;
      characterId: CharacterId;
      outfitId: OutfitId;
    }
  | {
      type: 'p2p:leave';
      playerId: string;
    }
  | {
      type: 'p2p:room_closed';
    };
