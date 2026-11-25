import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Coins,
  Crown,
  Flag,
  MapPin,
  Medal,
  Play,
  Siren,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import {
  formatLeaderboardDateFr,
  MAX_LOCAL_LEADERBOARD_ENTRIES,
  sanitizeLeaderboardEntries,
} from '../game/leaderboard';
import { getCharacterById, getOutfitById } from '../game/shop';
import { LeaderboardEntry, SavedProgress } from '../game/types';

interface LeaderboardModalProps {
  isOpen: boolean;
  progress: SavedProgress;
  highlightEntryId?: string | null;
  canStartRun: boolean;
  onPlayNow: () => void;
  onResetLeaderboard: () => void;
  onClose: () => void;
}

function getRankStyle(rank: number): {
  cardClass: string;
  badgeClass: string;
  icon: React.ReactNode;
} {
  if (rank === 1) {
    return {
      cardClass: 'border-amber-400/60 bg-[#271E15]',
      badgeClass: 'bg-amber-400 text-[#161210]',
      icon: <Crown className="h-4 w-4 text-amber-400 shrink-0" />,
    };
  }
  if (rank === 2) {
    return {
      cardClass: 'border-slate-300/35 bg-[#1E1A18]',
      badgeClass: 'bg-slate-300 text-[#161210]',
      icon: <Medal className="h-4 w-4 text-slate-300 shrink-0" />,
    };
  }
  if (rank === 3) {
    return {
      cardClass: 'border-orange-400/40 bg-[#211914]',
      badgeClass: 'bg-orange-500 text-[#161210]',
      icon: <Award className="h-4 w-4 text-orange-400 shrink-0" />,
    };
  }
  return {
    cardClass: 'border-white/10 bg-[#171210]',
    badgeClass: 'bg-[#2A211D] text-[#D6CBC0] border border-white/10',
    icon: null,
  };
}

function getOutcomeLabel(outcome: LeaderboardEntry['outcome']): {
  label: string;
  colorClass: string;
  icon: React.ReactNode;
} {
  if (outcome === 'VICTORY') {
    return {
      label: 'Quartier traversé',
      colorClass: 'text-emerald-400',
      icon: <Flag className="h-3 w-3 shrink-0" />,
    };
  }
  if (outcome === 'QUIT') {
    return {
      label: 'Course quittée',
      colorClass: 'text-[#B8ABA0]',
      icon: null,
    };
  }
  return {
    label: 'Attrapé',
    colorClass: 'text-red-300',
    icon: <Siren className="h-3 w-3 shrink-0" />,
  };
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = React.memo(
  ({
    isOpen,
    progress,
    highlightEntryId = null,
    canStartRun,
    onPlayNow,
    onResetLeaderboard,
    onClose,
  }) => {
    const [confirmReset, setConfirmReset] = useState(false);

    useEffect(() => {
      if (!isOpen) {
        setConfirmReset(false);
        return;
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      };
      window.addEventListener('keydown', onKeyDown, true);
      return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [isOpen, onClose]);

    const entries = useMemo(
      () => sanitizeLeaderboardEntries(progress.localLeaderboard),
      [progress.localLeaderboard]
    );

    if (!isOpen) return null;

    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/82 p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-modal-title"
        onClick={onClose}
      >
        <div
          className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-[#1C1613] text-[#FAF5EE] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#221915] px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-400 shrink-0" />
                <h2
                  id="leaderboard-modal-title"
                  className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-[#FAF5EE]"
                >
                  Classement Local
                </h2>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#B8ABA0]">
                Vos {MAX_LOCAL_LEADERBOARD_ENTRIES} meilleurs scores enregistrés sur cet appareil.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer le classement local"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-[#2B201B] text-[#D6CBC0] hover:bg-[#3A2B24] hover:text-[#FAF5EE] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Personal Summary Strip */}
          <dl className="grid grid-cols-2 gap-3 border-b border-white/10 bg-[#171210] px-5 py-3.5 sm:grid-cols-4 sm:px-6 font-mono tabular-nums">
            <div>
              <dt className="text-[11px] font-sans text-[#9E9187]">Record score</dt>
              <dd className="mt-0.5 text-sm font-extrabold text-amber-400">
                {progress.bestScore.toLocaleString('fr-FR')}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-sans text-[#9E9187]">Max distance</dt>
              <dd className="mt-0.5 text-sm font-bold text-[#FAF5EE]">
                {progress.bestDistance.toLocaleString('fr-FR')} m
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-sans text-[#9E9187]">Niveau max</dt>
              <dd className="mt-0.5 text-sm font-bold text-[#FAF5EE]">Niv. {progress.bestLevel}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-sans text-[#9E9187]">Courses</dt>
              <dd className="mt-0.5 text-sm font-bold text-[#FAF5EE]">
                {progress.runsCount.toLocaleString('fr-FR')}
              </dd>
            </div>
          </dl>

          {/* Top 5 Ranked List */}
          <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-[#16110F] px-5 py-10 text-center">
                <Trophy className="h-10 w-10 text-amber-400/50" />
                <h3 className="mt-3 font-display text-base font-bold text-[#FAF5EE]">
                  Aucun score enregistré pour le moment
                </h3>
                <p className="mt-1 max-w-sm text-xs sm:text-sm text-[#B8ABA0]">
                  Lancez une course dans les rues de Ouagadougou pour inscrire votre premier record
                  dans le Top 5 local.
                </p>
                {canStartRun && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onPlayNow();
                    }}
                    className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-extrabold text-[#161210] hover:bg-amber-400 transition-colors whitespace-nowrap"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Lancer une course</span>
                  </button>
                )}
              </div>
            ) : (
              <ol className="space-y-2.5" aria-label="Top 5 des meilleurs scores locaux">
                {entries.map((entry, idx) => {
                  const rank = idx + 1;
                  const style = getRankStyle(rank);
                  const outcome = getOutcomeLabel(entry.outcome);
                  const charName = getCharacterById(entry.characterId).name;
                  const outfitName = getOutfitById(entry.outfitId).name;
                  const isHighlighted = Boolean(highlightEntryId && entry.id === highlightEntryId);

                  return (
                    <li
                      key={entry.id}
                      className={`rounded-xl border px-3.5 py-3 sm:px-4 transition-colors ${
                        isHighlighted ? 'ring-2 ring-amber-400/70 ' : ''
                      }${style.cardClass}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Left: Rank + Runner + Quartier */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-extrabold tabular-nums ${style.badgeClass}`}
                          >
                            #{rank}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {style.icon}
                              <span className="font-display text-sm sm:text-base font-bold text-[#FAF5EE] truncate">
                                {charName}
                              </span>
                              <span className="text-xs text-[#A89B90] truncate">
                                · {outfitName}
                              </span>
                              {isHighlighted && (
                                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                                  Nouveau
                                </span>
                              )}
                            </div>

                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#B8ABA0]">
                              <span className="inline-flex items-center gap-1 text-[#E5DBD0]">
                                <MapPin className="h-3 w-3 text-amber-400 shrink-0" />
                                Niv. {entry.level} · {entry.quartierName}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className={`inline-flex items-center gap-1 font-medium ${outcome.colorClass}`}>
                                {outcome.icon}
                                <span>{outcome.label}</span>
                              </span>
                              <span aria-hidden="true" className="hidden sm:inline">
                                ·
                              </span>
                              <span className="text-[11px] text-[#8F8379]">
                                {formatLeaderboardDateFr(entry.achievedAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Score + Distance + Coins */}
                        <div className="text-right font-mono tabular-nums shrink-0">
                          <div
                            className={`text-base sm:text-lg font-extrabold leading-tight ${
                              rank === 1 ? 'text-amber-400' : 'text-[#FAF5EE]'
                            }`}
                          >
                            {entry.score.toLocaleString('fr-FR')}
                          </div>
                          <div className="text-xs font-semibold text-[#D6CBC0]">
                            {entry.distanceMeters.toLocaleString('fr-FR')} m
                          </div>
                          {(entry.coinsCollected > 0 || entry.lootCfa > 0) && (
                            <div className="mt-0.5 inline-flex items-center justify-end gap-1.5 text-[11px] text-amber-300">
                              {entry.coinsCollected > 0 && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Coins className="h-2.5 w-2.5 text-amber-400" />
                                  +{entry.coinsCollected}
                                </span>
                              )}
                              {entry.lootCfa > 0 && (
                                <span className="text-emerald-400">
                                  +{entry.lootCfa.toLocaleString('fr-FR')} F
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#171210] px-5 py-3.5 sm:px-6">
            <div>
              {entries.length > 0 &&
                (!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/10 bg-[#241C18] px-3.5 py-2 text-xs font-semibold text-[#B8ABA0] hover:border-red-500/40 hover:text-red-300 transition-colors whitespace-nowrap"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Réinitialiser</span>
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onResetLeaderboard();
                        setConfirmReset(false);
                      }}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-500 transition-colors whitespace-nowrap"
                    >
                      Confirmer la suppression
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="inline-flex min-h-[40px] items-center rounded-xl border border-white/15 bg-[#261E1A] px-3 py-2 text-xs font-semibold text-[#D6CBC0] hover:bg-[#342924] transition-colors whitespace-nowrap"
                    >
                      Annuler
                    </button>
                  </div>
                ))}
            </div>

            <div className="flex items-center gap-2">
              {canStartRun && entries.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onPlayNow();
                  }}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-white/15 bg-[#261E1A] px-4 py-2 text-xs sm:text-sm font-bold text-[#FAF5EE] hover:bg-[#332722] transition-colors whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5 fill-current text-amber-400" />
                  <span>Courir</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-[#161210] hover:bg-amber-400 transition-colors whitespace-nowrap"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

LeaderboardModal.displayName = 'LeaderboardModal';
