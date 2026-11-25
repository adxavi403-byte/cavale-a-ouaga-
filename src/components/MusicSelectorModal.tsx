import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Music,
  RotateCcw,
  Search,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  CustomSongMeta,
  resolveEffectiveSongInfo,
} from '../game/musicStorage';
import { soundEngine } from '../game/sound';
import { getLevelConfig, OUAGA_QUARTIERS } from '../game/types';

interface MusicSelectorModalProps {
  isOpen: boolean;
  initialLevel: number;
  bestLevel: number;
  muted: boolean;
  customSongs: CustomSongMeta[];
  levelSongMap: Record<number, string>;
  onToggleMute: () => void;
  onUploadSongs: (files: FileList, targetLevel: number) => Promise<number[]>;
  onDeleteCustomSong: (songId: string) => Promise<void>;
  onAssignSong: (level: number, assignment: string | null) => void;
  onAssignSongToAll: (assignment: string) => void;
  onClearAllAssignments: () => void;
  onClose: () => void;
}

type MusicTab = 'CUSTOM' | 'BUILTIN';

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return 'Audio';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

export const MusicSelectorModal: React.FC<MusicSelectorModalProps> = React.memo(
  ({
    isOpen,
    initialLevel,
    bestLevel,
    muted,
    customSongs,
    levelSongMap,
    onToggleMute,
    onUploadSongs,
    onDeleteCustomSong,
    onAssignSong,
    onAssignSongToAll,
    onClearAllAssignments,
    onClose,
  }) => {
    const [targetLevel, setTargetLevel] = useState<number>(Math.max(1, initialLevel));
    const [tab, setTab] = useState<MusicTab>('CUSTOM');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [previewKey, setPreviewKey] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [uploadStatus, setUploadStatus] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (isOpen) {
        setTargetLevel(Math.max(1, initialLevel));
        setUploadStatus('');
      } else {
        soundEngine.stopPreview();
        setPreviewKey(null);
      }
    }, [isOpen, initialLevel]);

    useEffect(() => {
      if (!isOpen) return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          soundEngine.stopPreview();
          setPreviewKey(null);
          onClose();
        }
      };
      window.addEventListener('keydown', onKeyDown, true);
      return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [isOpen, onClose]);

    const filteredQuartiers = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return OUAGA_QUARTIERS;
      return OUAGA_QUARTIERS.filter(
        (item) =>
          item.soundTitle.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.zone.toLowerCase().includes(q)
      );
    }, [searchQuery]);

    if (!isOpen) return null;

    const targetCfg = getLevelConfig(targetLevel);
    const effective = resolveEffectiveSongInfo(targetLevel, levelSongMap, customSongs);
    const quickLevelMax = Math.max(8, bestLevel + 2);
    const quickLevels = Array.from({ length: Math.min(20, quickLevelMax) }, (_, idx) => idx + 1);
    const assignedEntries = Object.entries(levelSongMap)
      .map(([k, v]) => ({ level: Number(k), assignment: v }))
      .filter((item) => item.level >= 1)
      .sort((a, b) => a.level - b.level);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setIsUploading(true);
      setUploadStatus('');
      try {
        const assignedLevels = await onUploadSongs(files, targetLevel);
        if (assignedLevels.length === 1) {
          setUploadStatus(
            `Chanson ajoutée et activée sur le Niveau ${assignedLevels[0]} !`
          );
        } else if (assignedLevels.length > 1) {
          setUploadStatus(
            `${files.length} chansons ajoutées et activées sur les Niveaux ${assignedLevels.join(', ')} !`
          );
        } else {
          setUploadStatus(
            files.length === 1
              ? 'Chanson ajoutée ! Cliquez sur « Mettre sur Niv. » pour l’activer.'
              : `${files.length} chansons ajoutées !`
          );
        }
      } catch {
        setUploadStatus("Impossible d'importer ce fichier audio.");
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
    };

    const handleTogglePreview = (key: string, startFn: () => void) => {
      if (previewKey === key) {
        soundEngine.stopPreview();
        setPreviewKey(null);
      } else {
        setPreviewKey(key);
        startFn();
      }
    };

    return (
      <div
        className="fixed inset-0 z-[65] flex items-center justify-center bg-black/82 p-3 sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-label="Sélection des chansons par niveau"
        onClick={() => {
          soundEngine.stopPreview();
          setPreviewKey(null);
          onClose();
        }}
      >
        <div
          className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-[#1C1613] text-[#FAF5EE] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Music className="h-5 w-5 text-amber-400 shrink-0" />
                <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-[#FAF5EE] truncate">
                  Chansons par niveau
                </h2>
              </div>
              <p className="mt-0.5 text-xs sm:text-sm text-[#B8ABA0]">
                Choisissez une chanson de votre appareil (MP3, M4A, WAV) ou un rythme de Ouaga pour chaque niveau.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.stopPreview();
                setPreviewKey(null);
                onClose();
              }}
              aria-label="Fermer"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#261E1A] text-[#D6CBC0] hover:bg-[#342924] hover:text-[#FAF5EE] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 space-y-4">
            {muted && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200">
                <div className="flex items-center gap-2">
                  <VolumeX className="h-4 w-4 text-red-400 shrink-0" />
                  <span>Le son du jeu est coupé (Muet). Activez-le pour entendre vos chansons.</span>
                </div>
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-xs font-bold text-[#161210] hover:bg-amber-400 transition-colors whitespace-nowrap"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>Activer le son</span>
                </button>
              </div>
            )}

            {/* Target Level Card */}
            <div className="rounded-xl border border-amber-500/30 bg-[#14100E] p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setTargetLevel((lvl) => Math.max(1, lvl - 1));
                    }}
                    disabled={targetLevel <= 1}
                    aria-label="Niveau précédent"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#241C18] text-[#FAF5EE] hover:bg-[#322722] disabled:opacity-35 transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="min-w-[180px] sm:min-w-[230px]">
                    <div className="font-display text-sm sm:text-base font-extrabold text-amber-400">
                      Niveau {targetLevel} · {targetCfg.displayName}
                    </div>
                    <div className="text-xs text-[#B8ABA0] truncate">
                      Son actif :{' '}
                      <span className={effective.isOverridden ? 'font-semibold text-emerald-300' : 'text-[#FAF5EE]'}>
                        ♪ {effective.label}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setTargetLevel((lvl) => lvl + 1);
                    }}
                    aria-label="Niveau suivant"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#241C18] text-[#FAF5EE] hover:bg-[#322722] transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleTogglePreview(`active_${targetLevel}`, () =>
                        soundEngine.previewLevelSound(targetLevel, () => setPreviewKey(null))
                      )
                    }
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/15 bg-[#241C18] px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-[#322722] transition-colors whitespace-nowrap"
                  >
                    {previewKey === `active_${targetLevel}` ? (
                      <>
                        <Square className="h-3.5 w-3.5 fill-current" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>Écouter</span>
                      </>
                    )}
                  </button>

                  {effective.isOverridden && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onAssignSong(targetLevel, null);
                      }}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/15 bg-[#241C18] px-3 py-1.5 text-xs font-semibold text-[#D6CBC0] hover:bg-[#322722] transition-colors whitespace-nowrap"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Son d’origine</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Level Strip */}
              <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
                {quickLevels.map((lvl) => {
                  const selected = lvl === targetLevel;
                  const hasCustom = Boolean(levelSongMap[lvl]);
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setTargetLevel(lvl);
                      }}
                      className={`inline-flex h-8 min-w-[44px] shrink-0 items-center justify-center gap-1 rounded-lg px-2 font-mono text-xs font-bold tabular-nums transition-colors ${
                        selected
                          ? 'bg-amber-500 text-[#161210]'
                          : hasCustom
                            ? 'border border-emerald-500/45 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                            : 'border border-white/10 bg-[#1F1815] text-[#D6CBC0] hover:bg-[#2B221D]'
                      }`}
                    >
                      <span>N{lvl}</span>
                      {hasCustom && !selected && <span aria-hidden="true">♪</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Source Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#14100E] p-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTab('CUSTOM');
                  }}
                  className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
                    tab === 'CUSTOM'
                      ? 'bg-amber-500 text-[#161210]'
                      : 'text-[#B8ABA0] hover:text-[#FAF5EE]'
                  }`}
                >
                  Mes chansons ({customSongs.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setTab('BUILTIN');
                  }}
                  className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
                    tab === 'BUILTIN'
                      ? 'bg-amber-500 text-[#161210]'
                      : 'text-[#B8ABA0] hover:text-[#FAF5EE]'
                  }`}
                >
                  Rythmes de Ouaga (60)
                </button>
              </div>

              {tab === 'BUILTIN' && (
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8F8379]" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un rythme..."
                    aria-label="Rechercher un rythme"
                    className="h-10 w-full rounded-xl border border-white/10 bg-[#14100E] pl-9 pr-3 text-sm text-[#FAF5EE] placeholder:text-[#7D7168] focus:border-amber-400 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Tab 1: Device Audio Upload + Custom Songs */}
            {tab === 'CUSTOM' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-dashed border-amber-500/45 bg-[#171210] p-4">
                  <div>
                    <div className="font-display text-sm font-bold text-[#FAF5EE]">
                      Importer une chanson depuis votre téléphone ou PC
                    </div>
                    <p className="mt-0.5 text-xs text-[#B8ABA0]">
                      Formats supportés : MP3, M4A, AAC, WAV, OGG. Vos fichiers restent sauvegardés sur votre appareil.
                    </p>
                    {uploadStatus && (
                      <p className="mt-1.5 text-xs font-semibold text-emerald-400">{uploadStatus}</p>
                    )}
                  </div>

                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-extrabold text-[#161210] hover:bg-amber-400 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      <Upload className="h-4 w-4 shrink-0" />
                      <span>{isUploading ? 'Ajout en cours...' : 'Ajouter une chanson'}</span>
                    </button>
                  </div>
                </div>

                {customSongs.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-[#171210] px-4 py-7 text-center">
                    <p className="text-sm font-semibold text-[#D6CBC0]">
                      Aucune chanson importée pour le moment.
                    </p>
                    <p className="mt-1 text-xs text-[#9E9187]">
                      Cliquez sur « Ajouter une chanson » ci-dessus, ou choisissez un rythme dans l’onglet « Rythmes de Ouaga ».
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customSongs.map((song) => {
                      const assignmentKey = `custom:${song.id}`;
                      const isActiveOnTarget = levelSongMap[targetLevel] === assignmentKey;
                      const isPreviewing = previewKey === assignmentKey;
                      return (
                        <div
                          key={song.id}
                          className={`flex flex-wrap items-center justify-between gap-2.5 rounded-xl border px-3.5 py-2.5 transition-colors ${
                            isActiveOnTarget
                              ? 'border-emerald-500/60 bg-[#19241D]'
                              : 'border-white/10 bg-[#171210]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-display text-sm font-bold text-[#FAF5EE] truncate">
                              {song.name}
                            </div>
                            <div className="text-[11px] font-mono text-[#A89B90]">
                              {formatBytes(song.sizeBytes)}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                handleTogglePreview(assignmentKey, () =>
                                  soundEngine.previewCustomSong(song.id, () => setPreviewKey(null))
                                )
                              }
                              aria-label={`Écouter ${song.name}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#241C18] text-amber-400 hover:bg-[#322722] transition-colors"
                            >
                              {isPreviewing ? (
                                <Square className="h-3.5 w-3.5 fill-current" />
                              ) : (
                                <Volume2 className="h-4 w-4" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playPowerUp();
                                onAssignSong(targetLevel, assignmentKey);
                              }}
                              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors whitespace-nowrap ${
                                isActiveOnTarget
                                  ? 'bg-emerald-500 text-[#0F1712]'
                                  : 'bg-amber-500 text-[#161210] hover:bg-amber-400'
                              }`}
                            >
                              {isActiveOnTarget && <Check className="h-3.5 w-3.5" />}
                              <span>
                                {isActiveOnTarget
                                  ? `Sur Niv. ${targetLevel}`
                                  : `Mettre sur Niv. ${targetLevel}`}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playPowerUp();
                                onAssignSongToAll(assignmentKey);
                                setUploadStatus(`« ${song.name} » activée sur tous les niveaux !`);
                              }}
                              title="Mettre cette chanson sur tous les niveaux (1 à 60)"
                              className="inline-flex h-9 items-center rounded-lg border border-white/15 bg-[#241C18] px-2.5 text-xs font-semibold text-[#E5DBD0] hover:bg-[#322722] transition-colors whitespace-nowrap"
                            >
                              Tous niv.
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playClick();
                                void onDeleteCustomSong(song.id);
                              }}
                              aria-label={`Supprimer ${song.name}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Built-in 60 Ouaga Beats */}
            {tab === 'BUILTIN' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filteredQuartiers.map((q) => {
                  const assignmentKey = `builtin:${q.index}`;
                  const defaultEffective =
                    !levelSongMap[targetLevel] &&
                    ((targetLevel - 1) % OUAGA_QUARTIERS.length) + 1 === q.index;
                  const isActiveOnTarget =
                    levelSongMap[targetLevel] === assignmentKey || defaultEffective;
                  const isPreviewing = previewKey === assignmentKey;

                  return (
                    <div
                      key={q.index}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 transition-colors ${
                        isActiveOnTarget
                          ? 'border-emerald-500/60 bg-[#19241D]'
                          : 'border-white/10 bg-[#171210]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-sm font-bold text-[#FAF5EE] truncate">
                          ♪ {q.soundTitle}
                        </div>
                        <div className="text-xs text-[#A89B90] truncate">
                          {q.name} · {q.arrondissement}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleTogglePreview(assignmentKey, () =>
                              soundEngine.previewBuiltinSong(q.index, () => setPreviewKey(null))
                            )
                          }
                          aria-label={`Écouter ${q.soundTitle}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#241C18] text-amber-400 hover:bg-[#322722] transition-colors"
                        >
                          {isPreviewing ? (
                            <Square className="h-3.5 w-3.5 fill-current" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playClick();
                            onAssignSong(targetLevel, assignmentKey);
                          }}
                          className={`inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
                            isActiveOnTarget
                              ? 'bg-emerald-500 text-[#0F1712]'
                              : 'bg-amber-500 text-[#161210] hover:bg-amber-400'
                          }`}
                        >
                          {isActiveOnTarget && <Check className="h-3.5 w-3.5" />}
                          <span>{isActiveOnTarget ? 'Actif' : `Niv. ${targetLevel}`}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Customized Levels Summary */}
            {assignedEntries.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-[#14100E] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#D6CBC0]">
                    Niveaux personnalisés ({assignedEntries.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onClearAllAssignments();
                    }}
                    className="text-xs font-semibold text-red-300 hover:text-red-200 transition-colors"
                  >
                    Tout réinitialiser
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {assignedEntries.map((item) => {
                    const info = resolveEffectiveSongInfo(item.level, levelSongMap, customSongs);
                    return (
                      <button
                        key={item.level}
                        type="button"
                        onClick={() => setTargetLevel(item.level)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-[#231B17] px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-[#2F241F] transition-colors"
                      >
                        <span className="font-mono font-bold">Niv. {item.level}</span>
                        <span className="text-[#FAF5EE] truncate max-w-[140px]">{info.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end border-t border-white/10 px-5 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => {
                soundEngine.stopPreview();
                setPreviewKey(null);
                onClose();
              }}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-[#161210] hover:bg-amber-400 transition-colors whitespace-nowrap"
            >
              Terminer
            </button>
          </div>
        </div>
      </div>
    );
  }
);

MusicSelectorModal.displayName = 'MusicSelectorModal';
