import React, { useState } from 'react';
import { Download, MoreVertical, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
  variant?: 'toolbar' | 'menu';
  alwaysShowOnMenu?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  variant = 'toolbar',
  alwaysShowOnMenu = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const canRender = isInstallable || isIOS || alwaysShowOnMenu;
  if (!canRender) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        return;
      }
      return;
    }
    setShowGuide(true);
  };

  const buttonClassName =
    variant === 'menu'
      ? 'col-span-2 sm:col-span-1 inline-flex min-h-[44px] sm:min-w-[190px] items-center justify-center gap-2 rounded-xl border border-orange-400/60 bg-[#FF6B00] px-4 py-2.5 text-xs sm:text-sm font-extrabold text-[#161210] hover:bg-orange-400 active:scale-[0.98] transition-all whitespace-nowrap shadow-lg shadow-orange-500/20'
      : 'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-orange-400/60 bg-[#FF6B00] px-3 text-xs font-extrabold text-[#161210] hover:bg-orange-400 transition-colors whitespace-nowrap shadow-md shadow-orange-500/20';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void handleClick();
        }}
        title="Installer Cavale Ouaga comme application sur votre téléphone"
        className={buttonClassName}
      >
        <Download className="h-4 w-4 shrink-0" />
        <span className={compact ? 'hidden sm:inline' : ''}>
          Installer l&apos;application
        </span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 text-left"
          role="dialog"
          aria-modal="true"
          aria-label="Installer Cavale Ouaga"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-orange-500/35 bg-[#1C1613] p-5 text-[#FAF5EE] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-extrabold text-[#FAF5EE]">
                Installer Cavale Ouaga
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Fermer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#261E1A] text-[#D6CBC0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-3 space-y-2 text-xs sm:text-sm text-[#D6CBC0] list-decimal list-inside">
                <li>
                  Touchez le bouton{' '}
                  <strong className="text-amber-300 inline-flex items-center gap-1">
                    <Share className="h-3.5 w-3.5 inline" /> Partager
                  </strong>{' '}
                  dans Safari.
                </li>
                <li>
                  Faites défiler puis touchez{' '}
                  <strong className="text-[#FAF5EE]">Sur l&apos;écran d&apos;accueil</strong>.
                </li>
                <li>
                  Touchez <strong className="text-orange-400">Ajouter</strong> pour jouer hors
                  ligne.
                </li>
              </ol>
            ) : (
              <ol className="mt-3 space-y-2 text-xs sm:text-sm text-[#D6CBC0] list-decimal list-inside">
                <li>
                  Ouvrez le jeu directement dans{' '}
                  <strong className="text-orange-400">Google Chrome</strong> (hors aperçu intégré).
                </li>
                <li>
                  Appuyez sur le menu{' '}
                  <strong className="text-amber-300 inline-flex items-center">
                    <MoreVertical className="h-3.5 w-3.5 inline" />
                  </strong>{' '}
                  en haut à droite de Chrome puis touchez{' '}
                  <strong className="text-[#FAF5EE]">Installer l&apos;application</strong>.
                </li>
                <li>
                  Le jeu apparaîtra sur votre téléphone et fonctionnera même{' '}
                  <strong className="text-emerald-300">hors ligne</strong>.
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 inline-flex min-h-[40px] w-full items-center justify-center rounded-xl bg-[#FF6B00] px-4 py-2 text-xs font-extrabold text-[#161210] hover:bg-orange-400 transition-colors"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};
