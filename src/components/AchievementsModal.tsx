import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Compass,
  Crown,
  Flame,
  Footprints,
  Lock,
  MapPin,
  Star,
  Timer,
  Trophy,
  Wallet,
  X,
} from 'lucide-react';
import {
  AchievementCategory,
  AchievementIconKind,
  evaluateAchievements,
} from '../game/achievements';
import { SavedProgress } from '../game/types';

interface AchievementsModalProps {
  isOpen: boolean;
  progress: SavedProgress;
  onClose: () => void;
}

type CategoryFilter = 'all' | AchievementCategory;

const CATEGORY_TABS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'distance', label: 'Distance' },
  { id: 'butin', label: 'Butin' },
  { id: 'quartiers', label: 'Quartiers' },
  { id: 'exploits', label: 'Exploits' },
];

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  distance: 'Distance',
  butin: 'Butin',
  quartiers: 'Quartiers',
  exploits: 'Exploits',
};

function renderAchievementIcon(kind: AchievementIconKind, unlocked: boolean): React.ReactNode {
  const cls = `h-5 w-5 ${unlocked ? 'text-amber-400' : 'text-[#8F8379]'}`;
  switch (kind) {
    case 'footprints':
      return <Footprints className={cls} />;
    case 'timer':
      return <Timer className={cls} />;
    case 'trophy':
      return <Trophy className={cls} />;
    case 'coins':
      return <Coins className={cls} />;
    case 'wallet':
      return <Wallet className={cls} />;
    case 'crown':
      return <Crown className={cls} />;
    case 'mappin':
      return <MapPin className={cls} />;
    case 'compass':
      return <Compass className={cls} />;
    case 'flame':
      return <Flame className={cls} />;
    case 'star':
      return <Star className={cls} />;
  }
}

function formatMetric(value: number, unit: string): string {
  return `${value.toLocaleString('fr-FR')} ${unit}`;
}

export const AchievementsModal: React.FC<AchievementsModalProps> = React.memo(
  ({ isOpen, progress, onClose }) => {
    const [filter, setFilter] = useState<CategoryFilter>('all');

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

    const statuses = useMemo(() => evaluateAchievements(progress), [progress]);

    const unlockedCount = useMemo(
      () => statuses.filter((s) => s.unlocked).length,
      [statuses]
    );

    const filteredStatuses = useMemo(() => {
      const list =
        filter === 'all'
          ? statuses
          : statuses.filter((s) => s.definition.category === filter);
      return [...list].sort((a, b) => {
        if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
        return b.ratio - a.ratio;
      });
    }, [statuses, filter]);

    if (!isOpen) return null;

    const totalRatio = statuses.length > 0 ? unlockedCount / statuses.length : 0;
    const totalKm = (Math.max(progress.totalDistanceMeters, progress.bestDistance) / 1000).toFixed(
      2
    );

    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="succes-modal-title"
        onClick={onClose}
      >
        <div
          className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#1C1613] text-[#FAF5EE] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
            <div>
              <h2
                id="succes-modal-title"
                className="font-display text-2xl font-extrabold tracking-tight text-[#FAF5EE]"
              >
                Succès de la Cavale
              </h2>
              <p className="mt-1 text-sm text-[#B8ABA0]">
                Débloquez tous les trophées grâce à vos courses dans les rues de Ouagadougou.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la fenêtre des succès"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#261E1A] text-[#D6CBC0] hover:bg-[#342924] hover:text-[#FAF5EE] transition-colors focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Lifetime Stats Summary + Overall Progress */}
          <div className="border-b border-white/10 bg-[#221B18] px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Trophy className="h-5 w-5 text-amber-400 shrink-0" />
                <span className="font-display text-base font-bold text-[#FAF5EE] tabular-nums">
                  {unlockedCount} / {statuses.length} succès débloqués
                </span>
              </div>
              <span className="font-mono text-xs font-semibold text-amber-400 tabular-nums">
                {Math.round(totalRatio * 100)} % complété
              </span>
            </div>

            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-black/40">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${Math.round(totalRatio * 100)}%` }}
              />
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs text-[#9E9187]">Distance cumulée</dt>
                <dd className="mt-0.5 font-mono text-sm font-bold text-[#FAF5EE] tabular-nums">
                  {totalKm} km
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#9E9187]">Cagnotte cumulée</dt>
                <dd className="mt-0.5 font-mono text-sm font-bold text-amber-400 tabular-nums">
                  {Math.max(progress.totalLootCfa, progress.lifetimeLootCfa ?? 0).toLocaleString('fr-FR')} F
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#9E9187]">Meilleur niveau</dt>
                <dd className="mt-0.5 font-mono text-sm font-bold text-[#FAF5EE] tabular-nums">
                  Niveau {progress.bestLevel}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[#9E9187]">Courses terminées</dt>
                <dd className="mt-0.5 font-mono text-sm font-bold text-[#FAF5EE] tabular-nums">
                  {progress.runsCount.toLocaleString('fr-FR')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Interactive Category Filter Bar */}
          <div className="border-b border-white/10 px-6 py-3">
            <div
              role="tablist"
              aria-label="Filtrer les succès par catégorie"
              className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#14100E] p-1"
            >
              {CATEGORY_TABS.map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(tab.id)}
                    className={`min-h-[36px] rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-amber-500 text-[#161210]'
                        : 'text-[#B8ABA0] hover:bg-[#241C18] hover:text-[#FAF5EE]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Achievement List */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredStatuses.map(({ definition, currentValue, targetValue, percent, unlocked }) => (
                <article
                  key={definition.id}
                  className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
                    unlocked
                      ? 'border-amber-500/50 bg-[#261F1A]'
                      : 'border-white/10 bg-[#171210]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                            unlocked ? 'bg-amber-500/15' : 'bg-white/5'
                          }`}
                        >
                          {renderAchievementIcon(definition.icon, unlocked)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display text-sm font-bold text-[#FAF5EE] truncate">
                            {definition.title}
                          </h3>
                          <div className="mt-0.5 text-xs text-[#9E9187]">
                            <span>{CATEGORY_LABELS[definition.category]}</span>
                            <span aria-hidden="true"> · </span>
                            <span
                              className={
                                unlocked ? 'font-semibold text-emerald-400' : 'text-[#9E9187]'
                              }
                            >
                              {unlocked ? 'Débloqué' : 'Verrouillé'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 pt-0.5" aria-hidden="true">
                        {unlocked ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Lock className="h-4 w-4 text-[#6B6058]" />
                        )}
                      </div>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-[#C7BBB0]">
                      {definition.description}
                    </p>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-2 font-mono text-[11px] tabular-nums">
                      <span className={unlocked ? 'text-amber-300 font-semibold' : 'text-[#B8ABA0]'}>
                        {formatMetric(currentValue, definition.unit)} /{' '}
                        {formatMetric(targetValue, definition.unit)}
                      </span>
                      <span className={unlocked ? 'text-emerald-400 font-bold' : 'text-[#8F8379]'}>
                        {percent} %
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/50">
                      <div
                        className={`h-full transition-all duration-300 ${
                          unlocked ? 'bg-emerald-400' : 'bg-amber-500/70'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end border-t border-white/10 px-6 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-amber-500 px-5 py-2 text-sm font-bold text-[#161210] hover:bg-amber-400 transition-colors whitespace-nowrap"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }
);

AchievementsModal.displayName = 'AchievementsModal';
