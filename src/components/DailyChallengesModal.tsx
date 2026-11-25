import React, { useEffect, useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  CheckCircle2,
  Coins,
  Flag,
  Flame,
  Footprints,
  Play,
  Shirt,
  ShoppingBag,
  Wallet,
  X,
} from 'lucide-react';
import {
  DailyChallengeIconKind,
  evaluateDailyChallenges,
  formatTodayLabelFr,
} from '../game/dailyChallenges';
import { SavedProgress } from '../game/types';

interface DailyChallengesModalProps {
  isOpen: boolean;
  progress: SavedProgress;
  canQuickAction: boolean;
  onClaimReward: (challengeId: string) => void;
  onOpenShop: () => void;
  onPlayNow: () => void;
  onClose: () => void;
}

function renderChallengeIcon(
  kind: DailyChallengeIconKind,
  completed: boolean,
  claimed: boolean
): React.ReactNode {
  const cls = `h-5 w-5 ${
    claimed ? 'text-emerald-400' : completed ? 'text-amber-400' : 'text-[#B8ABA0]'
  }`;
  switch (kind) {
    case 'coins':
      return <Coins className={cls} />;
    case 'footprints':
      return <Footprints className={cls} />;
    case 'shirt':
      return <Shirt className={cls} />;
    case 'flag':
      return <Flag className={cls} />;
    case 'arrowUp':
      return <ArrowUp className={cls} />;
    case 'arrowDown':
      return <ArrowDown className={cls} />;
    case 'wallet':
      return <Wallet className={cls} />;
    case 'flame':
      return <Flame className={cls} />;
  }
}

export const DailyChallengesModal: React.FC<DailyChallengesModalProps> = React.memo(
  ({ isOpen, progress, canQuickAction, onClaimReward, onOpenShop, onPlayNow, onClose }) => {
    useEffect(() => {
      if (!isOpen) return;
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

    const { daily, items, completedCount, claimableCount } = useMemo(
      () => evaluateDailyChallenges(progress),
      [progress]
    );

    if (!isOpen) return null;

    const totalPossibleReward = items.reduce(
      (sum, item) => sum + item.definition.rewardCoins,
      0
    );
    const todayLabel = formatTodayLabelFr(daily.dateKey);
    const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/82 p-3 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="defis-modal-title"
        onClick={onClose}
      >
        <div
          className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-orange-500/30 bg-[#1C1613] text-[#FAF5EE] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#221915] px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-amber-400 shrink-0" />
                <h2
                  id="defis-modal-title"
                  className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-[#FAF5EE]"
                >
                  Défis quotidiens
                </h2>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#B8ABA0]">
                Réalisez 3 objectifs simples chaque jour pour gagner des pièces d’or bonus.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer les défis quotidiens"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-[#2B201B] text-[#D6CBC0] hover:bg-[#3A2B24] hover:text-[#FAF5EE] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Daily Summary Strip */}
          <div className="border-b border-white/10 bg-[#171210] px-5 py-3.5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
              <div className="flex flex-wrap items-center gap-2 text-[#D6CBC0]">
                <span className="font-semibold capitalize text-[#FAF5EE]">{todayLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-amber-400 font-bold">
                  {completedCount} / {items.length} accomplis
                </span>
                {claimableCount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-emerald-400">
                      {claimableCount} récompense{claimableCount > 1 ? 's' : ''} à récupérer
                    </span>
                  </>
                )}
              </div>

              <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold tabular-nums text-amber-300">
                <Coins className="h-3.5 w-3.5 text-amber-400" />
                <span>Total du jour : +{totalPossibleReward} pièces</span>
              </div>
            </div>

            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-black/50">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* 3 Daily Challenge Cards */}
          <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 space-y-3">
            {items.map(({ definition, currentValue, targetValue, percent, completed, claimed }) => (
              <article
                key={definition.id}
                className={`rounded-xl border p-4 transition-colors ${
                  claimed
                    ? 'border-emerald-500/35 bg-[#19211C]'
                    : completed
                      ? 'border-amber-400/60 bg-[#271E17]'
                      : 'border-white/12 bg-[#16110F]'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        claimed
                          ? 'bg-emerald-500/15'
                          : completed
                            ? 'bg-amber-500/15'
                            : 'bg-white/5'
                      }`}
                    >
                      {renderChallengeIcon(definition.icon, completed, claimed)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-base font-bold text-[#FAF5EE] leading-snug">
                        {definition.title}
                      </h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#A99C91]">
                        <span className="font-mono font-semibold text-amber-400 tabular-nums">
                          +{definition.rewardCoins} pièces d’or
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            claimed
                              ? 'font-semibold text-emerald-400'
                              : completed
                                ? 'font-semibold text-amber-300'
                                : 'text-[#A99C91]'
                          }
                        >
                          {claimed
                            ? 'Récompense récupérée'
                            : completed
                              ? 'Objectif atteint'
                              : 'En cours'}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-[#C7BBB0] leading-relaxed">
                        {definition.description}
                      </p>
                    </div>
                  </div>

                  {/* Right Action Slot */}
                  <div className="shrink-0 flex items-center justify-end">
                    {claimed ? (
                      <div className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-950/40 px-4 py-2 text-xs font-bold text-emerald-300 whitespace-nowrap">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Réclamé</span>
                      </div>
                    ) : completed ? (
                      <button
                        type="button"
                        onClick={() => onClaimReward(definition.id)}
                        className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2 text-xs sm:text-sm font-extrabold text-[#161210] hover:bg-amber-300 active:scale-[0.98] transition-all whitespace-nowrap shadow-md shadow-amber-500/20"
                      >
                        <Coins className="h-4 w-4 shrink-0" />
                        <span>Réclamer +{definition.rewardCoins}</span>
                      </button>
                    ) : canQuickAction ? (
                      definition.actionHint === 'shop' ? (
                        <button
                          type="button"
                          onClick={onOpenShop}
                          className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-orange-500/40 bg-[#281A14] px-4 py-2 text-xs font-bold text-orange-300 hover:bg-[#352219] transition-colors whitespace-nowrap"
                        >
                          <ShoppingBag className="h-4 w-4 shrink-0" />
                          <span>Boutique</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onPlayNow}
                          className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#261E1A] px-4 py-2 text-xs font-bold text-[#FAF5EE] hover:bg-[#332722] transition-colors whitespace-nowrap"
                        >
                          <Play className="h-3.5 w-3.5 fill-current text-amber-400 shrink-0" />
                          <span>Courir</span>
                        </button>
                      )
                    ) : (
                      <span className="font-mono text-xs font-semibold text-[#9E9187] tabular-nums">
                        {percent} %
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums">
                    <span className={completed ? 'text-amber-300 font-semibold' : 'text-[#B8ABA0]'}>
                      {currentValue.toLocaleString('fr-FR')} /{' '}
                      {targetValue.toLocaleString('fr-FR')} {definition.unit}
                    </span>
                    <span className={claimed ? 'text-emerald-400 font-bold' : 'text-[#9E9187]'}>
                      {percent} %
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/50">
                    <div
                      className={`h-full transition-all duration-300 ${
                        claimed
                          ? 'bg-emerald-400'
                          : completed
                            ? 'bg-amber-400'
                            : 'bg-orange-500/80'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#171210] px-5 py-3.5 sm:px-6">
            <span className="text-xs text-[#9E9187]">
              Solde actuel :{' '}
              <strong className="font-mono tabular-nums text-amber-400">
                {progress.shopCoins.toLocaleString('fr-FR')} pièces d’or
              </strong>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-[#161210] hover:bg-amber-400 transition-colors whitespace-nowrap"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }
);

DailyChallengesModal.displayName = 'DailyChallengesModal';
