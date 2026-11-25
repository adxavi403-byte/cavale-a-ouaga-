import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  Link2,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Share2,
  Trophy,
  UserPlus,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { TransportMode } from '../game/multiplayerClient';
import {
  MultiplayerRoomSnapshot,
  PLAYER_COLORS,
  PublicRoomSummary,
} from '../game/multiplayerTypes';
import { CharacterId, getCharacterById, OutfitId } from '../game/shop';
import { soundEngine } from '../game/sound';
import { getLevelConfig } from '../game/types';

interface MultiplayerModalProps {
  isOpen: boolean;
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
  defaultName: string;
  characterId: CharacterId;
  outfitId: OutfitId;
  bestLevel: number;
  onClearError: () => void;
  onDiscoverRooms: () => void;
  onCreateRoom: (name: string, level: number) => void;
  onJoinRoom: (code: string, name: string) => void;
  onUpdateName: (name: string) => void;
  onSetLevel: (level: number) => void;
  onStartRace: () => void;
  onPlayAgain: () => void;
  onLeaveRoom: () => void;
  onCreateDirectInvite: () => Promise<void>;
  onAcceptDirectInvite: (offerCode: string, name: string) => Promise<void>;
  onCompleteDirectInvite: (answerCode: string) => Promise<boolean>;
  onResetDirectCodes: () => void;
  onClose: () => void;
}

const RANK_LABELS = ['1er', '2e', '3e', '4e'];

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  isOpen,
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
  defaultName,
  characterId,
  bestLevel,
  onClearError,
  onDiscoverRooms,
  onCreateRoom,
  onJoinRoom,
  onUpdateName,
  onSetLevel,
  onStartRace,
  onPlayAgain,
  onLeaveRoom,
  onCreateDirectInvite,
  onAcceptDirectInvite,
  onCompleteDirectInvite,
  onResetDirectCodes,
  onClose,
}) => {
  const [view, setView] = useState<'choice' | 'join'>('choice');
  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('cavale_ouaga_mp_name');
      if (saved && saved.trim()) return saved.trim().slice(0, 14);
    } catch {}
    return defaultName;
  });
  const [codeInput, setCodeInput] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedDirect, setCopiedDirect] = useState<boolean>(false);
  const [showDirectBox, setShowDirectBox] = useState<boolean>(false);
  const [pasteOfferInput, setPasteOfferInput] = useState<string>('');
  const [pasteAnswerInput, setPasteAnswerInput] = useState<string>('');
  const [lanUrls, setLanUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      if (!room) {
        setCodeInput('');
        setPasteOfferInput('');
        setPasteAnswerInput('');
        setShowDirectBox(false);
        setCopiedCode(false);
        setCopiedDirect(false);
      }
      return;
    }
    if (!room) {
      onDiscoverRooms();
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onEsc, { capture: true });
    return () => window.removeEventListener('keydown', onEsc, { capture: true });
  }, [isOpen, room, onClose, onDiscoverRooms]);

  // Periodically refresh open Hotspot salons while browsing
  useEffect(() => {
    if (!isOpen || room) return;
    const interval = window.setInterval(() => {
      onDiscoverRooms();
    }, 3500);
    return () => window.clearInterval(interval);
  }, [isOpen, room, onDiscoverRooms]);

  useEffect(() => {
    if (!isOpen || !room || room.status !== 'LOBBY' || transportMode !== 'lan_ws') return;
    let cancelled = false;
    fetch('/api/local-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { lanUrls?: string[] } | null) => {
        if (!cancelled && data && Array.isArray(data.lanUrls)) {
          setLanUrls(data.lanUrls.slice(0, 2));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, room, transportMode]);

  if (!isOpen) return null;

  const trimmedName = playerName.trim().slice(0, 14) || getCharacterById(characterId).name;
  const isHost = Boolean(room && playerId && room.hostId === playerId);
  const canStart = Boolean(room && isHost && room.players.length >= 2);

  const persistName = (next: string) => {
    setPlayerName(next);
    try {
      localStorage.setItem('cavale_ouaga_mp_name', next.trim().slice(0, 14));
    } catch {}
  };

  const handleCopyText = (text: string, setFlag: (v: boolean) => void) => {
    soundEngine.playClick();
    navigator.clipboard?.writeText(text).catch(() => {});
    setFlag(true);
    window.setTimeout(() => setFlag(false), 1800);
  };

  const handleShareText = async (title: string, text: string) => {
    soundEngine.playClick();
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    handleCopyText(text, setCopiedDirect);
  };

  const handleCreate = () => {
    soundEngine.playClick();
    onClearError();
    onCreateRoom(trimmedName, 1);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = codeInput.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length !== 4) return;
    soundEngine.playClick();
    onClearError();
    onJoinRoom(cleaned, trimmedName);
  };

  const handleAutoJoin = (code: string) => {
    soundEngine.playClick();
    onClearError();
    onJoinRoom(code, trimmedName);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mp-modal-title"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-lg rounded-2xl border border-orange-500/40 bg-[#1C1613] p-5 sm:p-6 text-[#FAF5EE] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Wifi className="h-3.5 w-3.5" />
              <span>
                {connected
                  ? 'WiFi Local / Point d’Accès · Sans internet'
                  : 'Mode Hors Ligne · Point d’Accès prêt'}
              </span>
            </div>
            <h2
              id="mp-modal-title"
              className="mt-0.5 font-display text-xl sm:text-2xl font-extrabold text-[#FAF5EE]"
            >
              {room?.status === 'FINISHED'
                ? 'Classement de la course'
                : room
                  ? `Salon · Code ${room.code}`
                  : 'Jouer avec mes potes'}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            aria-label="Fermer le multijoueur"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-[#261E1A] text-[#D6CBC0] hover:bg-[#342924] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Non-blocking contextual notice */}
        {error && (
          <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/50 px-3.5 py-2.5 text-xs font-semibold text-amber-200">
            {error}
          </div>
        )}

        {/* STATE 1: CHOICE / JOIN SCREEN (Not in a room yet) */}
        {!room && (
          <div className="mt-4 space-y-4">
            {/* Editable Player Name */}
            <div>
              <label
                htmlFor="mp-player-name"
                className="block text-xs font-semibold text-[#D6CBC0] mb-1.5"
              >
                Ton nom (affiché dans le salon, au-dessus du coureur et au classement)
              </label>
              <input
                id="mp-player-name"
                type="text"
                maxLength={14}
                value={playerName}
                onChange={(e) => persistName(e.target.value)}
                placeholder={getCharacterById(characterId).name}
                className="w-full rounded-xl border border-white/15 bg-[#120E0C] px-3.5 py-2.5 text-sm font-bold text-[#FAF5EE] placeholder-[#786D64] focus:border-amber-400 focus:outline-none"
              />
            </div>

            {view === 'choice' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={connecting}
                    onClick={handleCreate}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-amber-400/70 bg-amber-500 px-4 py-5 text-center text-[#161210] hover:bg-amber-400 active:scale-[0.98] disabled:opacity-60 transition-all shadow-lg shadow-amber-500/15"
                  >
                    {connecting ? (
                      <Loader2 className="h-7 w-7 animate-spin" />
                    ) : (
                      <Users className="h-7 w-7" />
                    )}
                    <span className="font-display text-base font-black">CRÉER UNE PARTIE</span>
                    <span className="text-[11px] font-semibold opacity-85">
                      Tu es l’Hôte · Salon automatique + Code 4 chiffres
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onClearError();
                      onDiscoverRooms();
                      setView('join');
                    }}
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-orange-500/60 bg-[#281A14] px-4 py-5 text-center text-[#FAF5EE] hover:bg-[#342119] active:scale-[0.98] transition-all"
                  >
                    <UserPlus className="h-7 w-7 text-orange-400" />
                    <span className="font-display text-base font-black">REJOINDRE UNE PARTIE</span>
                    <span className="text-[11px] text-[#D6CBC0]">
                      Clique sur le salon d’un pote ou tape son code
                    </span>
                  </button>
                </div>

                {/* Quick Automatic Hotspot Discovery preview right on Choice screen if rooms already open! */}
                {availableRooms.length > 0 && (
                  <div className="rounded-2xl border border-emerald-500/40 bg-[#131C17] p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                      <span>Salons détectés sur ce Point d’Accès :</span>
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          onDiscoverRooms();
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-200 hover:text-white"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Actualiser
                      </button>
                    </div>
                    {availableRooms.map((item) => (
                      <div
                        key={item.code}
                        className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#19251E] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-[#FAF5EE] truncate">
                            Salon de {item.hostName}
                          </div>
                          <div className="text-[11px] font-mono text-[#B8ABA0]">
                            Code {item.code} · {item.playerCount}/{item.maxPlayers} joueurs · Niv.{' '}
                            {item.level}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAutoJoin(item.code)}
                          className="shrink-0 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-black text-[#081C12] hover:bg-emerald-400 transition-colors"
                        >
                          REJOINDRE
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-white/10 bg-[#14100E] px-3.5 py-2.5 text-[11px] text-[#B8ABA0] leading-relaxed">
                  <strong className="text-amber-300">100% Hors Ligne (Sans méga) :</strong>{' '}
                  L’Hôte allume son <strong>Point d’Accès WiFi</strong>, les potes s’y connectent
                  puis ouvrent Cavale Ouaga.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* METHOD A: AUTOMATIC DISCOVERY */}
                <div className="rounded-2xl border border-emerald-500/40 bg-[#131B16] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-emerald-300">
                      A) Automatique (Même Point d’Accès)
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onDiscoverRooms();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/20"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Actualiser
                    </button>
                  </div>

                  {availableRooms.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 bg-[#101512] px-3 py-3 text-center text-xs text-[#B8ABA0]">
                      Aucun salon détecté pour l’instant. Demandez à l’Hôte de cliquer sur{' '}
                      <strong className="text-[#FAF5EE]">CRÉER UNE PARTIE</strong> ou utilisez le
                      code ci-dessous.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableRooms.map((item) => (
                        <div
                          key={item.code}
                          className="flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-[#1B2620] px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-[#FAF5EE] truncate">
                              Salon de {item.hostName}
                            </div>
                            <div className="text-[11px] font-mono text-[#B8ABA0]">
                              Code {item.code} · {item.playerCount}/{item.maxPlayers} joueurs · Niv.{' '}
                              {item.level}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAutoJoin(item.code)}
                            className="shrink-0 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-black text-[#081C12] hover:bg-emerald-400 transition-colors"
                          >
                            REJOINDRE
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* METHOD B: 4-DIGIT CODE */}
                <form
                  onSubmit={handleJoinByCode}
                  className="rounded-2xl border border-orange-500/35 bg-[#16110F] p-3.5 space-y-2.5"
                >
                  <label
                    htmlFor="mp-room-code"
                    className="block text-xs font-extrabold uppercase tracking-wide text-amber-300"
                  >
                    B) Ou entrer le Code à 4 chiffres
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="mp-room-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      value={codeInput}
                      onChange={(e) => {
                        onClearError();
                        setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                      }}
                      placeholder="2431"
                      className="w-full rounded-xl border-2 border-orange-500/45 bg-[#110D0B] px-3 py-2.5 text-center font-mono text-2xl font-black tracking-[0.35em] text-amber-400 placeholder-[#574D46] focus:border-amber-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={connecting || codeInput.replace(/\D/g, '').length !== 4}
                      className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 text-sm font-extrabold text-[#161210] hover:bg-amber-400 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>REJOINDRE</span>
                    </button>
                  </div>
                </form>

                {/* Direct P2P Hotspot Pairing (Zero-Server Offline Phones) */}
                {transportMode === 'hotspot_p2p' && (
                  <div className="rounded-2xl border border-sky-500/35 bg-[#10161B] p-3.5 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => setShowDirectBox((v) => !v)}
                      className="flex w-full items-center justify-between text-left text-xs font-bold text-sky-300"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Link2 className="h-3.5 w-3.5" />
                        Connexion directe 2 téléphones (Sans serveur local)
                      </span>
                      <span>{showDirectBox ? '▲' : '▼'}</span>
                    </button>

                    {showDirectBox && (
                      <div className="space-y-2.5 pt-1 text-xs">
                        <p className="text-[11px] text-[#B8ABA0]">
                          Collez ici l’invitation <span className="font-mono text-sky-300">CO1:...</span>{' '}
                          générée par l’Hôte sur le même Point d’Accès :
                        </p>
                        <textarea
                          rows={2}
                          value={pasteOfferInput}
                          onChange={(e) => setPasteOfferInput(e.target.value)}
                          placeholder="Collez le code CO1:... de l'Hôte"
                          className="w-full rounded-xl border border-white/15 bg-[#0C1014] p-2 font-mono text-[11px] text-[#FAF5EE] focus:border-sky-400 focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={directBusy || !pasteOfferInput.trim()}
                          onClick={() => void onAcceptDirectInvite(pasteOfferInput, trimmedName)}
                          className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-3 text-xs font-extrabold text-[#071520] hover:bg-sky-400 disabled:opacity-45"
                        >
                          {directBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Link2 className="h-3.5 w-3.5" />
                          )}
                          <span>Générer ma réponse P2P</span>
                        </button>

                        {directAnswerCode && (
                          <div className="space-y-1.5 rounded-xl border border-emerald-400/40 bg-[#0D1914] p-2.5">
                            <div className="text-[11px] font-bold text-emerald-300">
                              Envoyez ce code réponse à l’Hôte :
                            </div>
                            <div className="max-h-14 overflow-y-auto break-all rounded bg-black/40 p-1.5 font-mono text-[10px] text-[#D6CBC0]">
                              {directAnswerCode}
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleCopyText(directAnswerCode, setCopiedDirect)}
                                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500 py-1.5 text-[11px] font-extrabold text-[#071910]"
                              >
                                <Copy className="h-3 w-3" />
                                {copiedDirect ? 'Copié !' : 'Copier réponse'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleShareText('Réponse Cavale Ouaga', directAnswerCode)
                                }
                                className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/15 bg-[#1B2A22] px-3 py-1.5 text-[11px] font-bold text-[#FAF5EE]"
                              >
                                <Share2 className="h-3 w-3" />
                                Partager
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onClearError();
                    onResetDirectCodes();
                    setView('choice');
                  }}
                  className="inline-flex min-h-[42px] w-full items-center justify-center rounded-xl border border-white/15 bg-[#261E1A] px-4 text-xs font-semibold text-[#D6CBC0] hover:bg-[#342924] transition-colors"
                >
                  Retour
                </button>
              </div>
            )}
          </div>
        )}

        {/* STATE 2: ROOM LOBBY (Waiting for 2..4 players) */}
        {room && room.status === 'LOBBY' && (
          <div className="mt-4 space-y-4">
            {/* 4-Digit Room Code Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/45 bg-[#120E0C] px-4 py-3.5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#B8ABA0]">
                  Code du salon (et visible automatiquement)
                </div>
                <div className="font-mono text-3xl sm:text-4xl font-black tracking-[0.28em] text-amber-400 tabular-nums">
                  {room.code}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCopyText(room.code, setCopiedCode)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#261E1A] px-3 py-1.5 text-xs font-bold text-[#FAF5EE] hover:bg-[#342924] transition-colors"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-amber-400" />
                      <span>Copier le code</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] font-semibold text-emerald-300">
                  {p2pCount > 0
                    ? `WebRTC P2P direct (${p2pCount} pair${p2pCount > 1 ? 's' : ''})`
                    : transportMode === 'lan_ws'
                      ? 'Point d’Accès WiFi connecté'
                      : 'Hors ligne · Hotspot local prêt'}
                </span>
              </div>
            </div>

            {/* Player Count & Editable Name */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-extrabold text-amber-300">
                Attends tes potes... {room.players.length}/4 joueurs
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  maxLength={14}
                  value={playerName}
                  aria-label="Modifier ton nom"
                  onChange={(e) => {
                    const rawVal = e.target.value;
                    persistName(rawVal);
                    const nextTrimmed =
                      rawVal.trim().slice(0, 14) || getCharacterById(characterId).name;
                    onUpdateName(nextTrimmed);
                  }}
                  className="w-32 rounded-lg border border-white/15 bg-[#120E0C] px-2.5 py-1 text-xs font-bold text-[#FAF5EE] focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            {/* 4 Colored Slots */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PLAYER_COLORS.map((colorSlot) => {
                const occupant = room.players.find((p) => p.slot === colorSlot.slot);
                const isMe = occupant?.id === playerId;
                return (
                  <div
                    key={colorSlot.slot}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                      occupant
                        ? 'border-white/20 bg-[#251D19]'
                        : 'border-dashed border-white/10 bg-[#15100E] opacity-65'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="inline-block h-4 w-4 shrink-0 rounded-full border border-white/30"
                        style={{ backgroundColor: colorSlot.hex }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-bold text-[#FAF5EE] truncate">
                          <span className="truncate">
                            {occupant ? occupant.name : 'Place libre…'}
                          </span>
                          {isMe && (
                            <span className="text-[10px] font-bold text-amber-400">(Moi)</span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#B8ABA0]">
                          {occupant
                            ? `${colorSlot.label} · ${getCharacterById(occupant.characterId).name}`
                            : colorSlot.label}
                        </div>
                      </div>
                    </div>

                    {occupant?.isHost && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 shrink-0">
                        <Crown className="h-3 w-3" />
                        Hôte
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Direct Offline WebRTC P2P Host Invite Box when running pure offline without a local WS server */}
            {isHost && transportMode === 'hotspot_p2p' && room.players.length < 4 && (
              <div className="rounded-xl border border-sky-500/35 bg-[#10161B] p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sky-300 inline-flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    Connecter un autre téléphone sans serveur
                  </span>
                  <button
                    type="button"
                    disabled={directBusy}
                    onClick={() => void onCreateDirectInvite()}
                    className="rounded-lg bg-sky-500 px-2.5 py-1 text-[11px] font-extrabold text-[#071520] hover:bg-sky-400 disabled:opacity-50"
                  >
                    {directOfferCode ? 'Nouvelle invit.' : '+ Inviter un pote'}
                  </button>
                </div>

                {directOfferCode && (
                  <div className="space-y-2 pt-1">
                    <div className="max-h-14 overflow-y-auto break-all rounded bg-black/45 p-1.5 font-mono text-[10px] text-[#D6CBC0]">
                      {directOfferCode}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyText(directOfferCode, setCopiedDirect)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-500 py-1.5 text-[11px] font-extrabold text-[#161210]"
                      >
                        <Copy className="h-3 w-3" />
                        {copiedDirect ? 'Copié !' : 'Copier l’invitation'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleShareText(`Salon Cavale Ouaga (${room.code})`, directOfferCode)
                        }
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/15 bg-[#1B262F] px-3 py-1.5 text-[11px] font-bold text-[#FAF5EE]"
                      >
                        <Share2 className="h-3 w-3" />
                        Partager
                      </button>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={pasteAnswerInput}
                        onChange={(e) => setPasteAnswerInput(e.target.value)}
                        placeholder="Collez le code réponse CA1:... du pote"
                        className="flex-1 rounded-lg border border-white/15 bg-[#0C1014] px-2.5 py-1.5 font-mono text-[11px] text-[#FAF5EE] focus:border-emerald-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={directBusy || !pasteAnswerInput.trim()}
                        onClick={async () => {
                          const ok = await onCompleteDirectInvite(pasteAnswerInput);
                          if (ok) setPasteAnswerInput('');
                        }}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-extrabold text-[#071910] hover:bg-emerald-400 disabled:opacity-45"
                      >
                        Valider
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Track / Quartier Selection (Host) */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#14100E] px-3.5 py-2.5 text-xs">
              <div>
                <span className="text-[#B8ABA0]">Circuit : </span>
                <span className="font-bold text-[#FAF5EE]">
                  Niv. {room.level} · {getLevelConfig(room.level).displayName}
                </span>
              </div>
              {isHost && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={room.level <= 1}
                    onClick={() => {
                      soundEngine.playClick();
                      onSetLevel(Math.max(1, room.level - 1));
                    }}
                    className="rounded-lg border border-white/15 bg-[#261E1A] px-2.5 py-1 font-bold text-[#FAF5EE] hover:bg-[#342924] disabled:opacity-35"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    disabled={room.level >= Math.max(bestLevel, 5)}
                    onClick={() => {
                      soundEngine.playClick();
                      onSetLevel(room.level + 1);
                    }}
                    className="rounded-lg border border-white/15 bg-[#261E1A] px-2.5 py-1 font-bold text-[#FAF5EE] hover:bg-[#342924] disabled:opacity-35"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            {lanUrls.length > 0 && transportMode === 'lan_ws' && (
              <div className="rounded-xl border border-white/10 bg-[#14100E] px-3 py-2 text-[11px] text-[#B8ABA0]">
                Adresse Point d’Accès WiFi à ouvrir sur les autres téléphones :{' '}
                <span className="font-mono font-bold text-amber-300">{lanUrls[0]}</span>
              </div>
            )}

            {/* Lobby Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onLeaveRoom();
                }}
                className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-white/15 bg-[#261E1A] px-4 text-xs sm:text-sm font-semibold text-[#D6CBC0] hover:bg-[#342924] transition-colors"
              >
                Quitter le salon
              </button>

              {isHost ? (
                <button
                  type="button"
                  disabled={!canStart}
                  onClick={() => {
                    soundEngine.playClick();
                    onStartRace();
                  }}
                  className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-extrabold text-[#161210] hover:bg-amber-400 disabled:bg-[#2E2520] disabled:text-[#8E8178] disabled:cursor-not-allowed transition-colors"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>
                    {canStart
                      ? 'LANCER LA COURSE'
                      : 'Attends au moins 1 pote (2 min.)'}
                  </span>
                </button>
              ) : (
                <div className="flex-1 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center text-xs font-semibold text-amber-300">
                  En attente que l’Hôte lance la course…
                </div>
              )}
            </div>
          </div>
        )}

        {/* STATE 3: FINAL RANKING PODIUM (1er, 2e, 3e, 4e) */}
        {room && room.status === 'FINISHED' && (
          <div className="mt-4 space-y-4">
            {room.rankings[0] && (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-400/50 bg-amber-500/12 px-4 py-3">
                <Trophy className="h-7 w-7 shrink-0 text-amber-400" />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Vainqueur à Rood-Woko
                  </div>
                  <div className="font-display text-lg font-black text-[#FAF5EE]">
                    {room.rankings[0].name} ({room.rankings[0].distanceMeters} m)
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {room.rankings.map((entry, idx) => {
                const isMe = entry.playerId === playerId;
                const rankLabel = RANK_LABELS[idx] ?? `${entry.rank}e`;
                return (
                  <div
                    key={entry.playerId}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 ${
                      idx === 0
                        ? 'border-amber-400/60 bg-[#2A1F14]'
                        : isMe
                          ? 'border-orange-400/45 bg-[#241B17]'
                          : 'border-white/10 bg-[#15100E]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`inline-flex h-8 w-10 shrink-0 items-center justify-center rounded-lg font-display text-sm font-black ${
                          idx === 0
                            ? 'bg-amber-400 text-[#161210]'
                            : idx === 1
                              ? 'bg-slate-300 text-[#161210]'
                              : idx === 2
                                ? 'bg-orange-400 text-[#161210]'
                                : 'bg-[#2A211D] text-[#D6CBC0]'
                        }`}
                      >
                        {rankLabel}
                      </span>
                      <span
                        className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/30"
                        style={{ backgroundColor: entry.colorHex }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#FAF5EE] truncate">
                          <span className="truncate">{entry.name}</span>
                          {isMe && (
                            <span className="text-[10px] font-bold text-amber-400">(Moi)</span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#B8ABA0]">
                          {entry.colorLabel} · {entry.coinsCollected} pièces · Score{' '}
                          {entry.score.toLocaleString('fr-FR')}
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div className="text-base font-black text-amber-300">
                        {entry.distanceMeters.toLocaleString('fr-FR')} m
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onLeaveRoom();
                  onClose();
                }}
                className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-white/15 bg-[#261E1A] px-4 text-xs sm:text-sm font-semibold text-[#D6CBC0] hover:bg-[#342924] transition-colors"
              >
                Retour Mode Solo
              </button>

              {isHost ? (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onPlayAgain();
                  }}
                  className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-extrabold text-[#161210] hover:bg-amber-400 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Rejouer ensemble</span>
                </button>
              ) : (
                <div className="flex-1 rounded-xl border border-white/10 bg-[#14100E] px-4 py-3 text-center text-xs text-[#B8ABA0]">
                  L’Hôte peut relancer une nouvelle course…
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
