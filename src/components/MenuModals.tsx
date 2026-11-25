import React, { useEffect, useMemo, useState } from 'react';
import {
  CloudRain,
  Lock,
  Maximize2,
  Minimize2,
  Music,
  Play,
  RotateCw,
  Search,
  Sun,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import { CustomSongMeta, resolveEffectiveSongInfo } from '../game/musicStorage';
import { soundEngine } from '../game/sound';
import { getWeatherMeta, MapSector, OUAGA_QUARTIERS } from '../game/types';
import { OuagaMap } from './OuagaMap';
import { PWAInstallButton } from './PWAInstallButton';

interface ModalShellProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  onClose: () => void;
  children: React.ReactNode;
}

const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  title,
  subtitle,
  maxWidthClass = 'max-w-4xl',
  onClose,
  children,
}) => {
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`relative flex max-h-[90dvh] w-full ${maxWidthClass} flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#1C1613] text-[#FAF5EE] shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-[#FAF5EE] truncate">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs sm:text-sm text-[#B8ABA0]">{subtitle}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#261E1A] text-[#D6CBC0] hover:bg-[#342924] hover:text-[#FAF5EE] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">{children}</div>

        <div className="flex items-center justify-end border-t border-white/10 px-5 py-3 sm:px-6">
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
};

interface MapModalProps {
  isOpen: boolean;
  selectedLevel: number;
  currentPlayingLevel: number;
  bestLevel: number;
  isPlaying: boolean;
  onSelectLevel: (level: number) => void;
  onStartAtLevel: (level: number) => void;
  onClose: () => void;
}

export const MapModal: React.FC<MapModalProps> = React.memo(
  ({
    isOpen,
    selectedLevel,
    currentPlayingLevel,
    bestLevel,
    isPlaying,
    onSelectLevel,
    onStartAtLevel,
    onClose,
  }) => {
    return (
      <ModalShell
        isOpen={isOpen}
        title="Carte de Ouagadougou"
        subtitle="60 quartiers · 12 arrondissements · Niveaux 1 → ∞"
        maxWidthClass="max-w-5xl"
        onClose={onClose}
      >
        <OuagaMap
          selectedLevel={selectedLevel}
          currentPlayingLevel={currentPlayingLevel}
          bestLevel={bestLevel}
          isPlaying={isPlaying}
          onSelectLevel={onSelectLevel}
          onStartAtLevel={(lvl) => {
            onClose();
            onStartAtLevel(lvl);
          }}
        />
      </ModalShell>
    );
  }
);

MapModal.displayName = 'MapModal';

interface QuartiersModalProps {
  isOpen: boolean;
  startLevel: number;
  activeLevel: number;
  isPlaying: boolean;
  bestLevel: number;
  levelSongMap: Record<number, string>;
  customSongs: CustomSongMeta[];
  onStartAtLevel: (level: number) => void;
  onOpenMusicForLevel: (level: number) => void;
  onClose: () => void;
}

const SECTOR_TABS: { id: 'ALL' | MapSector; label: string }[] = [
  { id: 'ALL', label: 'Tous (60)' },
  { id: 'CENTRE', label: 'Centre' },
  { id: 'OUEST', label: 'Ouest' },
  { id: 'SUD', label: 'Sud' },
  { id: 'EST', label: 'Est' },
  { id: 'NORD', label: 'Nord' },
];

export const QuartiersModal: React.FC<QuartiersModalProps> = React.memo(
  ({
    isOpen,
    startLevel,
    activeLevel,
    isPlaying,
    bestLevel,
    levelSongMap,
    customSongs,
    onStartAtLevel,
    onOpenMusicForLevel,
    onClose,
  }) => {
    const [sector, setSector] = useState<'ALL' | MapSector>('ALL');
    const [query, setQuery] = useState<string>('');

    const filtered = useMemo(() => {
      const normalized = query.trim().toLowerCase();
      return OUAGA_QUARTIERS.filter((q) => {
        if (sector !== 'ALL' && q.sector !== sector) return false;
        if (!normalized) return true;
        return (
          q.name.toLowerCase().includes(normalized) ||
          q.arrondissement.toLowerCase().includes(normalized) ||
          q.zone.toLowerCase().includes(normalized)
        );
      });
    }, [sector, query]);

    return (
      <ModalShell
        isOpen={isOpen}
        title="Tous les quartiers de Ouagadougou"
        subtitle={`Meilleur niveau atteint : Niveau ${bestLevel} · Passé le niveau 60 (Yagma), la cavale continue à l'infini`}
        maxWidthClass="max-w-5xl"
        onClose={onClose}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-[#14100E] p-1">
            {SECTOR_TABS.map((tab) => {
              const active = sector === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setSector(tab.id);
                  }}
                  className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-amber-500 text-[#161210]'
                      : 'text-[#B8ABA0] hover:bg-white/5 hover:text-[#FAF5EE]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8F8379]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un quartier..."
              aria-label="Rechercher un quartier"
              className="h-10 w-full rounded-xl border border-white/10 bg-[#14100E] pl-9 pr-3 text-sm text-[#FAF5EE] placeholder:text-[#7D7168] focus:border-amber-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((q) => {
            const isSelected = startLevel === q.index;
            const isCurrent = activeLevel === q.index && isPlaying;
            const reached = q.index <= bestLevel;
            const songInfo = resolveEffectiveSongInfo(q.index, levelSongMap, customSongs);

            return (
              <div
                key={q.index}
                className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 transition-colors ${
                  isCurrent || isSelected
                    ? 'border-amber-500/70 bg-[#2A201A]'
                    : 'border-white/10 bg-[#171210]'
                }`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <span
                    className={`font-mono text-sm font-bold tabular-nums pt-0.5 ${
                      reached ? 'text-amber-400' : 'text-[#8F8379]'
                    }`}
                  >
                    {String(q.index).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-sm font-bold text-[#FAF5EE] truncate">
                        {q.name}
                      </span>
                      <span className="text-[11px] text-[#8F8379] shrink-0">
                        {q.arrondissement}
                      </span>
                    </div>
                    <div className="text-xs text-[#A89B90] truncate">
                      {q.zone} ·{' '}
                      <span className={songInfo.isOverridden ? 'text-emerald-300 font-semibold' : ''}>
                        ♪ {songInfo.label}
                      </span>
                    </div>
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium">
                      {q.weather === 'PLUIE' ? (
                        <span className="inline-flex items-center gap-1 text-sky-300">
                          <CloudRain className="h-3 w-3 shrink-0" />
                          <span>{getWeatherMeta(q.weather).label}</span>
                        </span>
                      ) : q.weather === 'HARMATTAN' ? (
                        <span className="inline-flex items-center gap-1 text-orange-300">
                          <Wind className="h-3 w-3 shrink-0" />
                          <span>{getWeatherMeta(q.weather).label}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-yellow-300">
                          <Sun className="h-3 w-3 shrink-0" />
                          <span>{getWeatherMeta(q.weather).label}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => soundEngine.previewLevelSound(q.index)}
                    aria-label={`Écouter le son de ${q.name}`}
                    title={`Écouter : ${songInfo.label}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#241C18] text-amber-400 hover:bg-[#322722] transition-colors"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      onClose();
                      onOpenMusicForLevel(q.index);
                    }}
                    aria-label={`Choisir la chanson de ${q.name}`}
                    title={`Changer la chanson du niveau ${q.index}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#241C18] text-emerald-300 hover:bg-[#322722] transition-colors"
                  >
                    <Music className="h-4 w-4" />
                  </button>
                  {reached ? (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onStartAtLevel(q.index);
                      }}
                      aria-label={`Jouer à ${q.name}`}
                      className="inline-flex h-9 items-center gap-1 rounded-lg bg-amber-500 px-3 text-xs font-bold text-[#161210] hover:bg-amber-400 transition-colors whitespace-nowrap"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Jouer</span>
                    </button>
                  ) : (
                    <span
                      title={`Terminez le niveau ${q.index - 1} pour débloquer`}
                      className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#241E1B] px-2.5 text-xs font-semibold text-[#7E7269] whitespace-nowrap"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>Verrouillé</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-[#9E9187]">
            Aucun quartier ne correspond à votre recherche.
          </p>
        )}
      </ModalShell>
    );
  }
);

QuartiersModal.displayName = 'QuartiersModal';

interface OptionsModalProps {
  isOpen: boolean;
  muted: boolean;
  isNativeFullscreen: boolean;
  startLevel: number;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onOpenMusicSelector: (level: number) => void;
  onClose: () => void;
}

export const OptionsModal: React.FC<OptionsModalProps> = React.memo(
  ({
    isOpen,
    muted,
    isNativeFullscreen,
    startLevel,
    onToggleMute,
    onToggleFullscreen,
    onOpenMusicSelector,
    onClose,
  }) => {
    return (
      <ModalShell
        isOpen={isOpen}
        title="Options & Commandes"
        subtitle="Réglages audio, plein écran 3D et règles des 3 voies à Ouagadougou"
        maxWidthClass="max-w-3xl"
        onClose={onClose}
      >
        <div className="space-y-6">
          {/* Interactive Audio & Fullscreen Options */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#171210] p-4">
              <div>
                <div className="font-display text-sm font-bold text-[#FAF5EE]">
                  Audio et musique
                </div>
                <div className="mt-0.5 text-xs text-[#B8ABA0]">
                  {muted ? 'Son coupé actuellement' : 'Effets et thème unique par niveau'}
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleMute}
                className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  muted
                    ? 'border border-white/15 bg-[#2A211D] text-[#D6CBC0] hover:bg-[#382D28]'
                    : 'bg-amber-500 text-[#161210] hover:bg-amber-400'
                }`}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                <span>{muted ? 'Muet' : 'Activé'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#171210] p-4">
              <div>
                <div className="font-display text-sm font-bold text-[#FAF5EE]">
                  Plein écran navigateur
                </div>
                <div className="mt-0.5 text-xs text-[#B8ABA0]">
                  {isNativeFullscreen
                    ? 'Mode plein écran actif'
                    : 'Masquer les barres du navigateur et pivoter'}
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-white/15 bg-[#2A211D] px-3.5 py-2 text-xs font-bold text-[#FAF5EE] hover:bg-[#382D28] transition-colors whitespace-nowrap shrink-0"
              >
                {isNativeFullscreen ? (
                  <>
                    <Minimize2 className="h-4 w-4 text-amber-400" />
                    <span>Quitter</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-4 w-4 text-amber-400" />
                    <span>Activer</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#171210] px-4 py-3">
            <div className="flex items-center gap-2.5 text-xs text-[#D6CBC0]">
              <RotateCw className="h-4 w-4 text-amber-400 shrink-0" />
              <span>
                Glissez le doigt (gauche, droite, haut, bas) ou utilisez les boutons tactiles à
                l&apos;écran.
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => soundEngine.previewLevelSound(startLevel)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/15 bg-[#261E1A] px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-[#342924] whitespace-nowrap"
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>Tester le son (Niv. {startLevel})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onClose();
                  onOpenMusicSelector(startLevel);
                }}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-[#161210] hover:bg-amber-400 whitespace-nowrap"
              >
                <Music className="h-3.5 w-3.5" />
                <span>Chansons par niveau</span>
              </button>
              <PWAInstallButton />
            </div>
          </div>

          {/* Controls, Power-ups & Obstacles */}
          <div className="grid gap-6 border-t border-white/10 pt-5 md:grid-cols-3">
            <div>
              <h3 className="font-display text-sm font-bold text-[#FAF5EE]">01. Commandes 3D</h3>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex items-baseline justify-between gap-2 border-b border-white/5 pb-1.5">
                  <dt className="text-[#B8ABA0]">Changer de voie</dt>
                  <dd className="font-mono font-semibold text-[#FAF5EE]">← / → · Glisser ↔</dd>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-b border-white/5 pb-1.5">
                  <dt className="text-[#B8ABA0]">Grand saut</dt>
                  <dd className="font-mono font-semibold text-[#FAF5EE]">↑ · Espace · Glisser ↑</dd>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-b border-white/5 pb-1.5">
                  <dt className="text-[#B8ABA0]">Rouler / Glisser</dt>
                  <dd className="font-mono font-semibold text-[#FAF5EE]">↓ · S · Glisser ↓</dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-[#B8ABA0]">Pause / Muet</dt>
                  <dd className="font-mono font-semibold text-[#FAF5EE]">P / M</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="font-display text-sm font-bold text-[#FAF5EE]">02. Bonus de rue</h3>
              <ul className="mt-3 space-y-2 text-xs text-[#D6CBC0]">
                <li className="border-b border-white/5 pb-1.5">
                  <span className="font-semibold text-violet-300">Aimant à Pièces</span> — Attire
                  les pièces d&apos;or sur les 3 voies.
                </li>
                <li className="border-b border-white/5 pb-1.5">
                  <span className="font-semibold text-sky-300">Grigri Protecteur</span> — Absorbe
                  un choc direct.
                </li>
                <li>
                  <span className="font-semibold text-orange-300">Jus de Gingembre</span> — Sprint
                  turbo qui détruit les obstacles.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-display text-sm font-bold text-[#FAF5EE]">03. Obstacles</h3>
              <ul className="mt-3 space-y-2 text-xs text-[#D6CBC0]">
                <li className="border-b border-white/5 pb-1.5">
                  <span className="font-semibold text-[#FAF5EE]">Trains, Bus &amp; Marchandes</span>{' '}
                  — Changez de voie (gauche / droite).
                </li>
                <li className="border-b border-white/5 pb-1.5">
                  <span className="font-semibold text-[#FAF5EE]">Taxis verts, Motos &amp; Bas</span>{' '}
                  — Sautez par-dessus ou esquivez.
                </li>
                <li>
                  <span className="font-semibold text-[#FAF5EE]">Barrières hautes</span> — Roulez /
                  glissez dessous !
                </li>
              </ul>
            </div>
          </div>
        </div>
      </ModalShell>
    );
  }
);

OptionsModal.displayName = 'OptionsModal';
