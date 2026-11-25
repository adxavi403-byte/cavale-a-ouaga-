import React, { useMemo, useState } from 'react';
import { CloudRain, Lock, MapPin, Play, Sun, Volume2, Wind } from 'lucide-react';
import { soundEngine } from '../game/sound';
import { getWeatherMeta, MapSector, OUAGA_QUARTIERS, OuagaQuartier } from '../game/types';

interface OuagaMapProps {
  selectedLevel: number;
  currentPlayingLevel: number;
  bestLevel: number;
  isPlaying: boolean;
  onSelectLevel: (level: number) => void;
  onStartAtLevel: (level: number) => void;
}

const SECTOR_FILTERS: { id: 'ALL' | MapSector; label: string }[] = [
  { id: 'ALL', label: 'Tous (60)' },
  { id: 'CENTRE', label: 'Centre' },
  { id: 'OUEST', label: 'Ouest' },
  { id: 'SUD', label: 'Sud' },
  { id: 'EST', label: 'Est' },
  { id: 'NORD', label: 'Nord' },
];

export const OuagaMap: React.FC<OuagaMapProps> = React.memo(({
  selectedLevel,
  currentPlayingLevel,
  bestLevel,
  isPlaying,
  onSelectLevel,
  onStartAtLevel,
}) => {
  const [sectorFilter, setSectorFilter] = useState<'ALL' | MapSector>('ALL');
  const [inspectedIndex, setInspectedIndex] = useState<number>(
    ((selectedLevel - 1) % OUAGA_QUARTIERS.length) + 1
  );

  const inspectedQuartier: OuagaQuartier = useMemo(() => {
    return (
      OUAGA_QUARTIERS.find((q) => q.index === inspectedIndex) ?? OUAGA_QUARTIERS[0]
    );
  }, [inspectedIndex]);

  const visibleQuartiers = useMemo(() => {
    if (sectorFilter === 'ALL') return OUAGA_QUARTIERS;
    return OUAGA_QUARTIERS.filter((q) => q.sector === sectorFilter);
  }, [sectorFilter]);

  const routePath = useMemo(() => {
    return OUAGA_QUARTIERS.map((q, i) => `${i === 0 ? 'M' : 'L'} ${q.mapX} ${q.mapY}`).join(' ');
  }, []);

  const activeMapIndex = isPlaying
    ? ((currentPlayingLevel - 1) % OUAGA_QUARTIERS.length) + 1
    : ((selectedLevel - 1) % OUAGA_QUARTIERS.length) + 1;

  const handleInspect = (q: OuagaQuartier) => {
    soundEngine.playClick();
    setInspectedIndex(q.index);
    if (q.index <= bestLevel) {
      onSelectLevel(q.index);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#B8ABA0]">
            Explorez les 12 arrondissements, écoutez le thème musical de chaque niveau et démarrez
            votre cavale depuis le quartier de votre choix.
          </p>
        </div>

        {/* Sector Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-[#14100E] p-1">
          {SECTOR_FILTERS.map((f) => {
            const active = sectorFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setSectorFilter(f.id);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-amber-500 text-[#161210]'
                    : 'text-[#D6CBC0] hover:bg-white/5 hover:text-[#FAF5EE]'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive SVG Map of Ouagadougou */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/15 bg-[#1B1614]">
        <div className="relative w-full aspect-[1000/580]">
          <svg
            viewBox="0 0 1000 620"
            className="h-full w-full select-none"
            role="img"
            aria-label="Carte interactive des 60 quartiers de Ouagadougou"
          >
            {/* Base laterite & terrain */}
            <rect width="1000" height="620" fill="#1B1614" />

            {/* Subtle Urban Grid Rings */}
            <circle cx="485" cy="310" r="110" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1.5" />
            <circle cx="485" cy="310" r="225" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1.5" strokeDasharray="6 6" />
            <circle cx="485" cy="310" r="350" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1.5" />

            {/* Parc Urbain Bangr-Weoogo (Green urban reserve) */}
            <path
              d="M 548 250 Q 605 232 630 264 Q 618 298 564 294 Q 538 282 548 250 Z"
              fill="rgba(22, 163, 74, 0.24)"
              stroke="rgba(34, 197, 94, 0.45)"
              strokeWidth="1.5"
            />
            <text x="586" y="274" textAnchor="middle" fill="#86EFAC" fontSize="9.5" fontWeight="600">
              Parc Bangr-Weoogo
            </text>

            {/* Les 3 Barrages de Ouagadougou */}
            <path
              d="M 380 236 Q 435 230 468 238 Q 515 245 552 246"
              fill="none"
              stroke="#0284C7"
              strokeWidth="11"
              strokeLinecap="round"
              opacity="0.55"
            />
            <text x="468" y="227" textAnchor="middle" fill="#7DD3FC" fontSize="9.5" fontWeight="600">
              Barrages 1 · 2 · 3
            </text>

            {/* Major Ouagadougou Highways */}
            {/* N1 Route de Bobo (Ouest) -> Centre -> N4 Route de Fada (Est) */}
            <path
              d="M 90 432 L 268 368 L 495 315 L 706 324 L 945 318"
              fill="none"
              stroke="rgba(245, 158, 11, 0.2)"
              strokeWidth="4"
            />
            {/* N2 Route de Ouahigouya (NO) -> Centre -> Ouaga 2000 (Sud) */}
            <path
              d="M 195 135 L 342 205 L 495 315 L 455 432 L 525 545"
              fill="none"
              stroke="rgba(245, 158, 11, 0.2)"
              strokeWidth="4"
            />
            {/* N3 Route de Kaya (NE) */}
            <path
              d="M 495 315 L 564 192 L 734 178 L 840 120"
              fill="none"
              stroke="rgba(245, 158, 11, 0.16)"
              strokeWidth="3"
            />

            {/* Highway Direction Labels */}
            <text x="112" y="452" fill="#9E9187" fontSize="10" fontWeight="600">
              ← Route de Bobo (N1)
            </text>
            <text x="898" y="298" textAnchor="end" fill="#9E9187" fontSize="10" fontWeight="600">
              Route de Fada (N4) →
            </text>
            <text x="195" y="120" fill="#9E9187" fontSize="10" fontWeight="600">
              ↖ Route de Ouahigouya (N2)
            </text>
            <text x="795" y="128" fill="#9E9187" fontSize="10" fontWeight="600">
              Route de Kaya (N3) ↗
            </text>

            {/* Full Progression Route Line (Level 1 -> 60) */}
            <path
              d={routePath}
              fill="none"
              stroke="rgba(250, 245, 238, 0.14)"
              strokeWidth="1.4"
              strokeDasharray="4 4"
            />

            {/* Quartier Nodes */}
            {OUAGA_QUARTIERS.map((q) => {
              const inFilter = visibleQuartiers.some((vq) => vq.index === q.index);
              const isSelected = q.index === inspectedQuartier.index;
              const isActive = q.index === activeMapIndex;
              const unlocked = q.index <= bestLevel;
              const opacity = inFilter ? 1 : 0.18;

              return (
                <g
                  key={q.index}
                  transform={`translate(${q.mapX}, ${q.mapY})`}
                  style={{ opacity, cursor: 'pointer' }}
                  onClick={() => handleInspect(q)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Niveau ${q.index} : ${q.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleInspect(q);
                    }
                  }}
                >
                  {(isSelected || isActive) && (
                    <circle
                      r="14"
                      fill="rgba(245, 158, 11, 0.22)"
                      stroke="#F59E0B"
                      strokeWidth="1.5"
                    />
                  )}
                  <circle
                    r={isSelected || isActive ? 7.5 : 5.2}
                    fill={
                      isActive
                        ? '#F59E0B'
                        : isSelected
                          ? '#FBBF24'
                          : unlocked
                            ? '#10B981'
                            : '#64748B'
                    }
                    stroke="#161210"
                    strokeWidth="1.8"
                  />
                  {(inFilter || isSelected || isActive) && (
                    <text
                      y={-10}
                      textAnchor="middle"
                      fill={isSelected || isActive ? '#FDE68A' : '#E5DBD0'}
                      fontSize={isSelected || isActive ? '11.5' : '9.5'}
                      fontWeight={isSelected || isActive ? '700' : '500'}
                      stroke="#161210"
                      strokeWidth="3"
                      paintOrder="stroke"
                    >
                      {q.index}. {q.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Quartier Inspector Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-[#221B18] px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-amber-400 font-semibold">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                Niveau {inspectedQuartier.index}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[#D6CBC0]">{inspectedQuartier.arrondissement}</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#B8ABA0]">Son : {inspectedQuartier.soundTitle}</span>
              <span aria-hidden="true">·</span>
              <span
                className={`inline-flex items-center gap-1 ${
                  inspectedQuartier.weather === 'PLUIE'
                    ? 'text-sky-300'
                    : inspectedQuartier.weather === 'HARMATTAN'
                      ? 'text-orange-300'
                      : 'text-yellow-300'
                }`}
              >
                {inspectedQuartier.weather === 'PLUIE' ? (
                  <CloudRain className="h-3.5 w-3.5 shrink-0" />
                ) : inspectedQuartier.weather === 'HARMATTAN' ? (
                  <Wind className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Sun className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>{getWeatherMeta(inspectedQuartier.weather).label}</span>
              </span>
            </div>
            <div className="mt-0.5 font-display text-lg font-bold text-[#FAF5EE]">
              {inspectedQuartier.name}
              <span className="ml-2 text-sm font-normal text-[#B8ABA0]">
                — {inspectedQuartier.zone}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => soundEngine.previewLevelSound(inspectedQuartier.index)}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#2C231F] px-3.5 py-2 text-xs font-semibold text-[#FAF5EE] hover:bg-[#382D28] transition-colors whitespace-nowrap"
            >
              <Volume2 className="h-4 w-4 text-amber-400" />
              <span>Écouter le son</span>
            </button>
            <button
              type="button"
              disabled={inspectedQuartier.index > bestLevel}
              onClick={() => onStartAtLevel(inspectedQuartier.index)}
              className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                inspectedQuartier.index <= bestLevel
                  ? 'bg-amber-500 text-[#161210] hover:bg-amber-400'
                  : 'bg-[#2C2522] text-[#8E8178] cursor-not-allowed'
              }`}
            >
              {inspectedQuartier.index <= bestLevel ? (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  <span>Jouer · Niv. {inspectedQuartier.index}</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Verrouillé · Finir Niv. {inspectedQuartier.index - 1}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Compact Legend */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#A89B90]">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
          Quartier sélectionné / en cours
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Quartier débloqué
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-500" />
          Quartier verrouillé (terminez les niveaux 1, 2, 3… dans l&apos;ordre)
        </span>
      </div>
    </div>
  );
});

OuagaMap.displayName = 'OuagaMap';
