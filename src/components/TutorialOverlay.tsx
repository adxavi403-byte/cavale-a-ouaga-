import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Play,
  X,
} from 'lucide-react';
import { soundEngine } from '../game/sound';

export type TutorialActionType = 'left' | 'right' | 'jump' | 'slide';

interface TutorialOverlayProps {
  isOpen: boolean;
  lastAction: { type: TutorialActionType; seq: number } | null;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onJump: () => void;
  onSlide: () => void;
  onPlayNow: () => void;
  onClose: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  isOpen,
  lastAction,
  onMoveLeft,
  onMoveRight,
  onJump,
  onSlide,
  onPlayNow,
  onClose,
}) => {
  const [step, setStep] = useState<number>(0);
  const [didLeft, setDidLeft] = useState<boolean>(false);
  const [didRight, setDidRight] = useState<boolean>(false);
  const [didJump, setDidJump] = useState<boolean>(false);
  const [didSlide, setDidSlide] = useState<boolean>(false);
  const autoNextTimerRef = useRef<number | null>(null);

  // Reset progress each time the tutorial opens
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setDidLeft(false);
      setDidRight(false);
      setDidJump(false);
      setDidSlide(false);
    }
    return () => {
      if (autoNextTimerRef.current !== null) {
        window.clearTimeout(autoNextTimerRef.current);
        autoNextTimerRef.current = null;
      }
    };
  }, [isOpen]);

  // Escape closes tutorial cleanly
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        soundEngine.playClick();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [isOpen, onClose]);

  // Track actions triggered via buttons, keyboard, or touch swipes
  useEffect(() => {
    if (!isOpen || !lastAction) return;

    let nextLeft = didLeft;
    let nextRight = didRight;
    let nextJump = didJump;
    let nextSlide = didSlide;

    if (step === 0) {
      if (lastAction.type === 'left' && !didLeft) {
        nextLeft = true;
        setDidLeft(true);
        soundEngine.playCoin(false);
      } else if (lastAction.type === 'right' && !didRight) {
        nextRight = true;
        setDidRight(true);
        soundEngine.playCoin(false);
      }
      if (nextLeft && nextRight && autoNextTimerRef.current === null) {
        autoNextTimerRef.current = window.setTimeout(() => {
          autoNextTimerRef.current = null;
          setStep(1);
        }, 850);
      }
    } else if (step === 1 && lastAction.type === 'jump' && !didJump) {
      nextJump = true;
      setDidJump(true);
      soundEngine.playCoin(false);
      if (autoNextTimerRef.current === null) {
        autoNextTimerRef.current = window.setTimeout(() => {
          autoNextTimerRef.current = null;
          setStep(2);
        }, 850);
      }
    } else if (step === 2 && lastAction.type === 'slide' && !didSlide) {
      nextSlide = true;
      setDidSlide(true);
      soundEngine.playCoin(true);
      if (autoNextTimerRef.current === null) {
        autoNextTimerRef.current = window.setTimeout(() => {
          autoNextTimerRef.current = null;
          setStep(3);
        }, 850);
      }
    }
  }, [isOpen, lastAction, step, didLeft, didRight, didJump, didSlide]);

  if (!isOpen) return null;

  const goToStep = (target: number) => {
    if (autoNextTimerRef.current !== null) {
      window.clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    soundEngine.playClick();
    setStep(Math.max(0, Math.min(3, target)));
  };

  const stepMeta = [
    {
      title: '1. Changer de voie',
      desc: 'Esquivez les taxis verts, bus et barrières sur les 3 voies de Rood-Woko.',
      hint: 'Touchez Gauche / Droite ci-dessous, glissez horizontalement ou utilisez les flèches ← →.',
    },
    {
      title: '2. Sauter par-dessus les obstacles',
      desc: 'Franchissez les barrières basses, cônes orange et véhicules en plein élan.',
      hint: 'Appuyez sur Sauter, glissez vers le haut ↑ ou tapez sur l’écran (clavier : Espace / ↑).',
    },
    {
      title: '3. Glisser sous les barrières',
      desc: 'Effectuez une roulade rapide pour passer sous les panneaux et barrages hauts.',
      hint: 'Appuyez sur Glisser, glissez vers le bas ↓ ou utilisez la flèche bas ↓.',
    },
    {
      title: '4. Prêt pour la cavale !',
      desc: 'Ramassez les pièces d’or et billets de 500 F CFA, activez vos Jus de vitesse et Protections, et défiez vos potes en Solo ou WiFi Local.',
      hint: 'Vous maîtrisez toutes les commandes. Lancez votre première course maintenant !',
    },
  ][step];

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Tutoriel interactif Cavale à Ouaga"
      className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between px-3 pt-16 pb-3 sm:px-6 sm:pt-20 sm:pb-5"
    >
      {/* Top Instruction Card (leaves center 3D runner unobstructed) */}
      <div className="pointer-events-auto mx-auto w-full max-w-xl rounded-2xl border border-amber-400/45 bg-[#16110E]/92 p-3.5 sm:p-4 text-[#FAF5EE] shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <GraduationCap className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  Tutoriel interactif · {step + 1}/4
                </span>
              </div>
              <h2 className="font-display text-base sm:text-lg font-extrabold text-[#FAF5EE] leading-snug">
                {stepMeta.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            aria-label="Fermer le tutoriel"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-white/15 bg-[#261E1A] px-2.5 text-xs font-semibold text-[#D6CBC0] hover:bg-[#342924] transition-colors"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Fermer</span>
          </button>
        </div>

        <p className="mt-2 text-xs sm:text-sm text-[#E5DBD0] leading-relaxed">{stepMeta.desc}</p>
        <p className="mt-1 text-[11px] text-amber-300/90">{stepMeta.hint}</p>

        {/* Live objective checklist */}
        {step < 3 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {step === 0 && (
              <>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    didLeft
                      ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                      : 'border-white/15 bg-[#221A17] text-[#B8ABA0]'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Voie gauche</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    didRight
                      ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                      : 'border-white/15 bg-[#221A17] text-[#B8ABA0]'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Voie droite</span>
                </span>
              </>
            )}
            {step === 1 && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  didJump
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                    : 'border-white/15 bg-[#221A17] text-[#B8ABA0]'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Effectuer un saut</span>
              </span>
            )}
            {step === 2 && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  didSlide
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                    : 'border-white/15 bg-[#221A17] text-[#B8ABA0]'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Effectuer une glissade</span>
              </span>
            )}
          </div>
        )}

        {/* Step Navigation & Final CTA */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3].map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goToStep(idx)}
                aria-label={`Étape ${idx + 1}`}
                className={`h-2 rounded-full transition-all ${
                  idx === step
                    ? 'w-6 bg-amber-400'
                    : idx < step
                      ? 'w-2.5 bg-emerald-400'
                      : 'w-2.5 bg-white/25'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => goToStep(step - 1)}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/15 bg-[#241C18] px-3 text-xs font-semibold text-[#FAF5EE] hover:bg-[#332722] transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Précédent</span>
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => goToStep(step + 1)}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-amber-500 px-3.5 text-xs font-extrabold text-[#161210] hover:bg-amber-400 transition-colors"
              >
                <span>Suivant</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onPlayNow();
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-amber-500 px-4 text-xs sm:text-sm font-extrabold text-[#161210] hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Jouer maintenant</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Interactive On-Screen Controls */}
      <div className="pointer-events-auto mx-auto w-full max-w-xl">
        <div className="mb-1.5 text-center text-[11px] font-medium text-[#E5DBD0]/90">
          Essayez les commandes directement sur votre coureur à l’écran :
        </div>
        <div className="flex items-end justify-between gap-3">
          {/* Left: Lane Switch Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onMoveLeft}
              aria-label="Voie de gauche"
              className={`inline-flex h-14 min-w-[74px] sm:h-16 sm:min-w-[92px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-3 text-xs font-bold transition-all active:scale-95 ${
                step === 0
                  ? 'border-amber-400 bg-amber-500/25 text-amber-200 shadow-lg shadow-amber-500/20'
                  : 'border-white/20 bg-[#17110E]/90 text-[#FAF5EE] hover:bg-[#261D19]'
              }`}
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Gauche</span>
            </button>

            <button
              type="button"
              onClick={onMoveRight}
              aria-label="Voie de droite"
              className={`inline-flex h-14 min-w-[74px] sm:h-16 sm:min-w-[92px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-3 text-xs font-bold transition-all active:scale-95 ${
                step === 0
                  ? 'border-amber-400 bg-amber-500/25 text-amber-200 shadow-lg shadow-amber-500/20'
                  : 'border-white/20 bg-[#17110E]/90 text-[#FAF5EE] hover:bg-[#261D19]'
              }`}
            >
              <ArrowRight className="h-5 w-5" />
              <span>Droite</span>
            </button>
          </div>

          {/* Right: Slide & Jump Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onSlide}
              aria-label="Glisser / Rouler"
              className={`inline-flex h-14 min-w-[74px] sm:h-16 sm:min-w-[92px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-3 text-xs font-bold transition-all active:scale-95 ${
                step === 2
                  ? 'border-amber-400 bg-amber-500/25 text-amber-200 shadow-lg shadow-amber-500/20'
                  : 'border-white/20 bg-[#17110E]/90 text-[#FAF5EE] hover:bg-[#261D19]'
              }`}
            >
              <ArrowDown className="h-5 w-5" />
              <span>Glisser</span>
            </button>

            <button
              type="button"
              onClick={onJump}
              aria-label="Sauter"
              className={`inline-flex h-14 min-w-[74px] sm:h-16 sm:min-w-[92px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-3 text-xs font-bold transition-all active:scale-95 ${
                step === 1
                  ? 'border-amber-400 bg-amber-500/25 text-amber-200 shadow-lg shadow-amber-500/20'
                  : 'border-white/20 bg-[#17110E]/90 text-[#FAF5EE] hover:bg-[#261D19]'
              }`}
            >
              <ArrowUp className="h-5 w-5" />
              <span>Sauter</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
