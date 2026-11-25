import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Check,
  Coins,
  CupSoda,
  Eye,
  Gauge,
  Shield,
  Shirt,
  ShoppingBag,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  CharacterId,
  getCharacterById,
  getOutfitById,
  JuiceId,
  OutfitId,
  ProtectionId,
  SHOP_CHARACTERS,
  SHOP_JUICES,
  SHOP_OUTFITS,
  SHOP_PROTECTIONS,
} from '../game/shop';
import { soundEngine } from '../game/sound';
import { SavedProgress } from '../game/types';
import { ShopItemThumb } from './ShopItemThumb';
import { ShopPreview3D } from './ShopPreview3D';

interface ShopModalProps {
  isOpen: boolean;
  progress: SavedProgress;
  onBuyOutfit: (id: OutfitId) => void;
  onEquipOutfit: (id: OutfitId) => void;
  onBuyCharacter: (id: CharacterId) => void;
  onEquipCharacter: (id: CharacterId) => void;
  onBuyJuice: (id: JuiceId) => void;
  onSelectJuice: (id: JuiceId) => void;
  onBuyProtection: (id: ProtectionId) => void;
  onSelectProtection: (id: ProtectionId) => void;
  onToggleAutoUseJuice: () => void;
  onToggleAutoUseProtection: () => void;
  onConvertCfaToCoins: (coinsToAdd?: number) => void;
  onTryItem?: () => void;
  onClose: () => void;
}

type ShopTab = 'outfits' | 'characters' | 'boosts';

interface PreviewTarget {
  kind: 'outfit' | 'character';
  id: OutfitId | CharacterId;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  isOpen,
  progress,
  onBuyOutfit,
  onEquipOutfit,
  onBuyCharacter,
  onEquipCharacter,
  onBuyJuice,
  onSelectJuice,
  onBuyProtection,
  onSelectProtection,
  onToggleAutoUseJuice,
  onToggleAutoUseProtection,
  onConvertCfaToCoins,
  onTryItem,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<ShopTab>('outfits');
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!isOpen) {
      setPreviewTarget(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTryOn = (kind: 'outfit' | 'character', id: OutfitId | CharacterId) => {
    soundEngine.playClick();
    setPreviewTarget({ kind, id });
    onTryItem?.();
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const previewCharacterId: CharacterId =
    previewTarget?.kind === 'character'
      ? (previewTarget.id as CharacterId)
      : progress.equippedCharacter;
  const previewOutfitId: OutfitId =
    previewTarget?.kind === 'outfit'
      ? (previewTarget.id as OutfitId)
      : previewTarget?.kind === 'character'
        ? 'base'
        : progress.equippedOutfit;

  const previewOutfit =
    previewTarget?.kind === 'outfit' ? getOutfitById(previewTarget.id as OutfitId) : null;
  const previewCharacter =
    previewTarget?.kind === 'character' ? getCharacterById(previewTarget.id as CharacterId) : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-2.5 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Boutique Rood-Woko"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-orange-500/30 bg-[#140E0C] text-[#FAF5EE] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Shop Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-500/20 bg-[#1B120E] px-4 py-3.5 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-orange-400 shrink-0" />
              <h2 className="font-display text-lg sm:text-2xl font-extrabold tracking-tight text-[#FAF5EE] truncate">
                Boutique Rood-Woko
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-[#B8ABA0]">
              1 pièce d’or ramassée sur la route = 1 pièce en boutique
            </p>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-4 font-mono tabular-nums text-xs sm:text-sm">
              <div className="text-right">
                <div className="text-[10px] text-[#B8ABA0] inline-flex items-center gap-1">
                  <Coins className="h-3 w-3 text-amber-400" />
                  <span>Pièces d’or</span>
                </div>
                <div className="font-extrabold text-amber-400">
                  {progress.shopCoins.toLocaleString('fr-FR')}
                </div>
              </div>

              <div className="h-7 w-px bg-white/10" aria-hidden="true" />

              <div className="text-right">
                <div className="text-[10px] text-[#B8ABA0] inline-flex items-center gap-1">
                  <Wallet className="h-3 w-3 text-orange-400" />
                  <span>Cagnotte</span>
                </div>
                <div className="font-bold text-[#FAF5EE]">
                  {progress.totalLootCfa.toLocaleString('fr-FR')} F
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la boutique"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-[#261A14] text-[#D6CBC0] hover:bg-[#36241B] hover:text-[#FAF5EE] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Section Switcher Tabs */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#17100D] px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-[#0F0A08] p-1 border border-white/10">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('outfits');
              }}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
                activeTab === 'outfits'
                  ? 'bg-orange-500 text-[#140E0C]'
                  : 'text-[#C8BCB1] hover:text-[#FAF5EE]'
              }`}
            >
              <Shirt className="h-4 w-4 shrink-0" />
              <span>Habits ({SHOP_OUTFITS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('characters');
              }}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
                activeTab === 'characters'
                  ? 'bg-orange-500 text-[#140E0C]'
                  : 'text-[#C8BCB1] hover:text-[#FAF5EE]'
              }`}
            >
              <User className="h-4 w-4 shrink-0" />
              <span>Persos ({SHOP_CHARACTERS.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setActiveTab('boosts');
                setPreviewTarget(null);
              }}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
                activeTab === 'boosts'
                  ? 'bg-orange-500 text-[#140E0C]'
                  : 'text-[#C8BCB1] hover:text-[#FAF5EE]'
              }`}
            >
              <Zap className="h-4 w-4 shrink-0" />
              <span>Jus & Protections</span>
            </button>
          </div>

          {activeTab !== 'boosts' && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                if (previewTarget) {
                  setPreviewTarget(null);
                } else {
                  setPreviewTarget({
                    kind: activeTab === 'outfits' ? 'outfit' : 'character',
                    id:
                      activeTab === 'outfits'
                        ? progress.equippedOutfit
                        : progress.equippedCharacter,
                  });
                }
              }}
              className="hidden sm:inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-amber-400/35 bg-[#241812] px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-[#322118] transition-colors whitespace-nowrap"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>{previewTarget ? 'Masquer aperçu 3D' : 'Cabine 3D'}</span>
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div ref={scrollBodyRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Cagnotte F CFA -> Pièces d'or Converter Bar */}
          {(() => {
            const maxConvertibleCoins = Math.floor(progress.totalLootCfa / 2);
            return (
              <section
                aria-label="Convertir la cagnotte en pièces d'or"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-[#1B130F] px-3.5 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#FAF5EE]">
                    <ArrowRightLeft className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>Transformer la cagnotte en pièces d’or</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#B8ABA0] font-mono tabular-nums">
                    2 F CFA = 1 pièce (100 F = 50) · Disponible :{' '}
                    <span className="text-orange-300 font-bold">
                      {progress.totalLootCfa.toLocaleString('fr-FR')} F CFA
                    </span>{' '}
                    ({maxConvertibleCoins.toLocaleString('fr-FR')}{' '}
                    {maxConvertibleCoins > 1 ? 'pièces possibles' : 'pièce possible'})
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={maxConvertibleCoins < 50}
                    onClick={() => onConvertCfaToCoins(50)}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-white/15 bg-[#261A14] px-3 py-1.5 text-xs font-bold text-[#FAF5EE] hover:bg-[#34231B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    100 F → +50
                  </button>
                  <button
                    type="button"
                    disabled={maxConvertibleCoins < 250}
                    onClick={() => onConvertCfaToCoins(250)}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-white/15 bg-[#261A14] px-3 py-1.5 text-xs font-bold text-[#FAF5EE] hover:bg-[#34231B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    500 F → +250
                  </button>
                  <button
                    type="button"
                    disabled={maxConvertibleCoins < 1}
                    onClick={() => onConvertCfaToCoins()}
                    className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-extrabold text-[#140E0C] hover:bg-amber-300 disabled:bg-[#2C2522] disabled:text-[#8E8178] disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    <Coins className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {maxConvertibleCoins > 0
                        ? `Tout convertir (+${maxConvertibleCoins.toLocaleString('fr-FR')})`
                        : 'Cagnotte < 2 F'}
                    </span>
                  </button>
                </div>
              </section>
            );
          })()}

          {/* Interactive 3D Try-On Panel ("ESSAYER") */}
          {previewTarget && (
            <section
              aria-label="Aperçu 3D"
              className="rounded-2xl border border-orange-500/35 bg-[#1C130F] p-3.5 sm:p-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-center">
                <div className="sm:col-span-6">
                  <ShopPreview3D characterId={previewCharacterId} outfitId={previewOutfitId} />
                </div>

                <div className="sm:col-span-6 flex flex-col justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-orange-400">
                      Cabine d’essayage 3D ·{' '}
                      {previewOutfit
                        ? getCharacterById(progress.equippedCharacter).name
                        : 'Tenue de base'}
                    </div>
                    <h3 className="mt-0.5 font-display text-xl font-extrabold text-[#FAF5EE]">
                      {previewOutfit ? previewOutfit.name : previewCharacter?.name}
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-[#D6CBC0] leading-relaxed">
                      {previewOutfit ? previewOutfit.description : previewCharacter?.description}
                    </p>
                    {previewCharacter && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                        <Gauge className="h-3.5 w-3.5" />
                        <span>{previewCharacter.speedLabel}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {previewOutfit && (() => {
                      const owned = progress.unlockedOutfits.includes(previewOutfit.id);
                      const equipped = progress.equippedOutfit === previewOutfit.id;
                      const canBuy = progress.shopCoins >= previewOutfit.price;

                      if (equipped) {
                        return (
                          <span className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-4 py-2 text-xs font-bold text-emerald-300">
                            <Check className="h-4 w-4" />
                            <span>Tenue portée</span>
                          </span>
                        );
                      }
                      if (owned) {
                        return (
                          <button
                            type="button"
                            onClick={() => onEquipOutfit(previewOutfit.id)}
                            className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-orange-500 px-5 py-2 text-xs sm:text-sm font-extrabold text-[#140E0C] hover:bg-orange-400 transition-colors whitespace-nowrap"
                          >
                            PORTER
                          </button>
                        );
                      }
                      return (
                        <button
                          type="button"
                          disabled={!canBuy}
                          onClick={() => onBuyOutfit(previewOutfit.id)}
                          className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-5 py-2 text-xs sm:text-sm font-extrabold transition-colors whitespace-nowrap ${
                            canBuy
                              ? 'bg-amber-400 text-[#140E0C] hover:bg-amber-300'
                              : 'bg-[#2E2622] text-[#8E8178] cursor-not-allowed'
                          }`}
                        >
                          <Coins className="h-4 w-4" />
                          <span>
                            {canBuy
                              ? `ACHETER (${previewOutfit.price})`
                              : `PAS ASSEZ (${previewOutfit.price})`}
                          </span>
                        </button>
                      );
                    })()}

                    {previewCharacter && (() => {
                      const owned = progress.unlockedCharacters.includes(previewCharacter.id);
                      const equipped = progress.equippedCharacter === previewCharacter.id;
                      const canBuy = progress.shopCoins >= previewCharacter.price;

                      if (equipped) {
                        return (
                          <span className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-4 py-2 text-xs font-bold text-emerald-300">
                            <Check className="h-4 w-4" />
                            <span>Personnage choisi</span>
                          </span>
                        );
                      }
                      if (owned) {
                        return (
                          <button
                            type="button"
                            onClick={() => onEquipCharacter(previewCharacter.id)}
                            className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-orange-500 px-5 py-2 text-xs sm:text-sm font-extrabold text-[#140E0C] hover:bg-orange-400 transition-colors whitespace-nowrap"
                          >
                            CHOISIR
                          </button>
                        );
                      }
                      return (
                        <button
                          type="button"
                          disabled={!canBuy}
                          onClick={() => onBuyCharacter(previewCharacter.id)}
                          className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-5 py-2 text-xs sm:text-sm font-extrabold transition-colors whitespace-nowrap ${
                            canBuy
                              ? 'bg-amber-400 text-[#140E0C] hover:bg-amber-300'
                              : 'bg-[#2E2622] text-[#8E8178] cursor-not-allowed'
                          }`}
                        >
                          <Coins className="h-4 w-4" />
                          <span>
                            {canBuy
                              ? `ACHETER (${previewCharacter.price})`
                              : `PAS ASSEZ (${previewCharacter.price})`}
                          </span>
                        </button>
                      );
                    })()}

                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setPreviewTarget(null);
                      }}
                      className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-white/15 bg-[#261B16] px-4 py-2 text-xs font-semibold text-[#D6CBC0] hover:bg-[#33241D] transition-colors whitespace-nowrap"
                    >
                      Fermer 3D
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* OUTFITS GRID (HABITS) */}
          {activeTab === 'outfits' && (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {SHOP_OUTFITS.map((outfit) => {
                const owned = progress.unlockedOutfits.includes(outfit.id);
                const equipped = progress.equippedOutfit === outfit.id;
                const canAfford = progress.shopCoins >= outfit.price;
                const isPreviewing =
                  previewTarget?.kind === 'outfit' && previewTarget.id === outfit.id;

                return (
                  <article
                    key={outfit.id}
                    className={`flex flex-col justify-between rounded-2xl border p-3.5 transition-colors ${
                      equipped
                        ? 'border-orange-500 bg-[#241610]'
                        : isPreviewing
                          ? 'border-amber-400/70 bg-[#1D1410]'
                          : 'border-white/12 bg-[#1B130F]'
                    }`}
                  >
                    <div>
                      <ShopItemThumb kind="outfit" id={outfit.id} />

                      <div className="mt-3 flex items-start justify-between gap-2">
                        <h3 className="font-display text-base font-bold text-[#FAF5EE] leading-snug">
                          {outfit.name}
                        </h3>
                        <span className="shrink-0 font-mono text-xs font-extrabold tabular-nums text-amber-400">
                          {outfit.price === 0
                            ? 'Gratuit'
                            : `${outfit.price.toLocaleString('fr-FR')} pièces`}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-[#B8ABA0] leading-relaxed">
                        {outfit.description}
                      </p>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleTryOn('outfit', outfit.id)}
                          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-orange-500/35 bg-[#281A14] px-3 py-2 text-xs font-bold text-orange-300 hover:bg-[#362219] transition-colors whitespace-nowrap"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>ESSAYER</span>
                        </button>

                        {equipped ? (
                          <span className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-xs font-bold text-emerald-300 whitespace-nowrap">
                            <Check className="h-4 w-4" />
                            <span>PORTÉE</span>
                          </span>
                        ) : owned ? (
                          <button
                            type="button"
                            onClick={() => onEquipOutfit(outfit.id)}
                            className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-xl bg-orange-500 px-3 py-2 text-xs font-extrabold text-[#140E0C] hover:bg-orange-400 transition-colors whitespace-nowrap"
                          >
                            PORTER
                          </button>
                        ) : canAfford ? (
                          <button
                            type="button"
                            onClick={() => onBuyOutfit(outfit.id)}
                            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-extrabold text-[#140E0C] hover:bg-amber-300 transition-colors whitespace-nowrap"
                          >
                            <Coins className="h-3.5 w-3.5" />
                            <span>ACHETER</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title={`Il manque ${(outfit.price - progress.shopCoins).toLocaleString('fr-FR')} pièces`}
                            className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-xl bg-[#2C2522] px-3 py-2 text-xs font-bold text-[#8E8178] cursor-not-allowed whitespace-nowrap"
                          >
                            PAS ASSEZ
                          </button>
                        )}
                      </div>

                      {!owned && !canAfford && (
                        <p className="mt-1.5 text-[11px] text-[#8E8178] text-center tabular-nums">
                          Manque {(outfit.price - progress.shopCoins).toLocaleString('fr-FR')}{' '}
                          pièces — jouez pour gagner !
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* CHARACTERS GRID (PERSONNAGES) */}
          {activeTab === 'characters' && (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {SHOP_CHARACTERS.map((char) => {
                const owned = progress.unlockedCharacters.includes(char.id);
                const equipped = progress.equippedCharacter === char.id;
                const canAfford = progress.shopCoins >= char.price;
                const isPreviewing =
                  previewTarget?.kind === 'character' && previewTarget.id === char.id;

                return (
                  <article
                    key={char.id}
                    className={`flex flex-col justify-between rounded-2xl border p-3.5 transition-colors ${
                      equipped
                        ? 'border-orange-500 bg-[#241610]'
                        : isPreviewing
                          ? 'border-amber-400/70 bg-[#1D1410]'
                          : 'border-white/12 bg-[#1B130F]'
                    }`}
                  >
                    <div>
                      <ShopItemThumb kind="character" id={char.id} />

                      <div className="mt-3 flex items-start justify-between gap-2">
                        <h3 className="font-display text-base font-bold text-[#FAF5EE] leading-snug">
                          {char.name}
                        </h3>
                        <span className="shrink-0 font-mono text-xs font-extrabold tabular-nums text-amber-400">
                          {char.price === 0
                            ? 'Gratuit'
                            : `${char.price.toLocaleString('fr-FR')} pièces`}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-[#B8ABA0] leading-relaxed">
                        {char.description}
                      </p>

                      {/* Speed Bar */}
                      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 font-semibold text-orange-300">
                          <Gauge className="h-3.5 w-3.5" />
                          <span>{char.speedLabel}</span>
                        </span>
                        <div className="flex items-center gap-1" aria-hidden="true">
                          {[1, 2, 3, 4, 5].map((bar) => (
                            <span
                              key={bar}
                              className={`h-1.5 w-3 rounded-xs ${
                                bar <= char.speedStars ? 'bg-amber-400' : 'bg-white/15'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-3 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleTryOn('character', char.id)}
                          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-orange-500/35 bg-[#281A14] px-3 py-2 text-xs font-bold text-orange-300 hover:bg-[#362219] transition-colors whitespace-nowrap"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>ESSAYER</span>
                        </button>

                        {equipped ? (
                          <span className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-xs font-bold text-emerald-300 whitespace-nowrap">
                            <Check className="h-4 w-4" />
                            <span>CHOISI</span>
                          </span>
                        ) : owned ? (
                          <button
                            type="button"
                            onClick={() => onEquipCharacter(char.id)}
                            className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-xl bg-orange-500 px-3 py-2 text-xs font-extrabold text-[#140E0C] hover:bg-orange-400 transition-colors whitespace-nowrap"
                          >
                            CHOISIR
                          </button>
                        ) : canAfford ? (
                          <button
                            type="button"
                            onClick={() => onBuyCharacter(char.id)}
                            className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-extrabold text-[#140E0C] hover:bg-amber-300 transition-colors whitespace-nowrap"
                          >
                            <Coins className="h-3.5 w-3.5" />
                            <span>ACHETER</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title={`Il manque ${(char.price - progress.shopCoins).toLocaleString('fr-FR')} pièces`}
                            className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-xl bg-[#2C2522] px-3 py-2 text-xs font-bold text-[#8E8178] cursor-not-allowed whitespace-nowrap"
                          >
                            PAS ASSEZ
                          </button>
                        )}
                      </div>

                      {!owned && !canAfford && (
                        <p className="mt-1.5 text-[11px] text-[#8E8178] text-center tabular-nums">
                          Manque {(char.price - progress.shopCoins).toLocaleString('fr-FR')} pièces
                          — jouez pour gagner !
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* JUICES (PIÈCES D'OR) & PROTECTIONS (CAGNOTTE F CFA) */}
          {activeTab === 'boosts' && (
            <div className="space-y-6">
              {/* Section 1: Jus de vitesse (payables en Pièces d'or) */}
              <section aria-label="Jus de vitesse" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-base sm:text-lg font-extrabold text-amber-300">
                      <CupSoda className="h-5 w-5 text-amber-400 shrink-0" />
                      <span>Jus de vitesse (Pièces d’or)</span>
                    </h3>
                    <p className="text-xs text-[#B8ABA0]">
                      Achetez avec vos pièces d’or et buvez-les en pleine course pour foncer à toute vitesse.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onToggleAutoUseJuice}
                    className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                      progress.autoUseJuiceOnStart
                        ? 'border-amber-400/60 bg-amber-500/20 text-amber-300'
                        : 'border-white/15 bg-[#221914] text-[#C8BCB1] hover:text-[#FAF5EE]'
                    }`}
                  >
                    <Check
                      className={`h-3.5 w-3.5 ${
                        progress.autoUseJuiceOnStart ? 'opacity-100' : 'opacity-25'
                      }`}
                    />
                    <span>Boire auto au départ</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  {SHOP_JUICES.map((juice) => {
                    const count = Math.max(0, Math.floor(progress.juiceInventory?.[juice.id] ?? 0));
                    const canAfford = progress.shopCoins >= juice.priceCoins;
                    const isSelected = progress.selectedJuice === juice.id && count > 0;

                    return (
                      <article
                        key={juice.id}
                        className={`flex flex-col justify-between rounded-2xl border p-3.5 transition-colors ${
                          isSelected
                            ? 'border-amber-400 bg-[#251911]'
                            : 'border-white/12 bg-[#1B130F]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div
                              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15"
                              style={{ backgroundColor: `${juice.primaryColor}26` }}
                            >
                              <CupSoda className="h-6 w-6" style={{ color: juice.accentColor }} />
                            </div>
                            <span
                              className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold tabular-nums ${
                                count > 0
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                                  : 'bg-white/5 text-[#8E8178]'
                              }`}
                            >
                              En stock : {count}
                            </span>
                          </div>

                          <div className="mt-3 flex items-start justify-between gap-2">
                            <h4 className="font-display text-base font-bold text-[#FAF5EE] leading-snug">
                              {juice.name}
                            </h4>
                            <span className="shrink-0 font-mono text-xs font-extrabold tabular-nums text-amber-400">
                              {juice.priceCoins.toLocaleString('fr-FR')} pièces
                            </span>
                          </div>

                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-orange-300">
                            <Zap className="h-3.5 w-3.5" />
                            <span>{juice.subtitle}</span>
                          </div>

                          <p className="mt-1.5 text-xs text-[#B8ABA0] leading-relaxed">
                            {juice.description}
                          </p>
                        </div>

                        <div className="mt-3.5 pt-3 border-t border-white/10 space-y-2">
                          <div className="flex items-center gap-2">
                            {count > 0 && (
                              <button
                                type="button"
                                onClick={() => onSelectJuice(juice.id)}
                                className={`inline-flex min-h-[40px] items-center justify-center rounded-xl border px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                                  isSelected
                                    ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                                    : 'border-white/15 bg-[#261B16] text-[#D6CBC0] hover:bg-[#33241D]'
                                }`}
                              >
                                {isSelected ? 'Sélectionné' : 'Choisir'}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={!canAfford}
                              onClick={() => onBuyJuice(juice.id)}
                              className={`inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition-colors whitespace-nowrap ${
                                canAfford
                                  ? 'bg-amber-400 text-[#140E0C] hover:bg-amber-300'
                                  : 'bg-[#2C2522] text-[#8E8178] cursor-not-allowed'
                              }`}
                            >
                              <Coins className="h-3.5 w-3.5 shrink-0" />
                              <span>{canAfford ? 'ACHETER (+1)' : 'PAS ASSEZ'}</span>
                            </button>
                          </div>

                          {!canAfford && (
                            <p className="text-[11px] text-[#8E8178] text-center tabular-nums">
                              Manque {(juice.priceCoins - progress.shopCoins).toLocaleString('fr-FR')} pièces
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <div className="h-px bg-white/10" aria-hidden="true" />

              {/* Section 2: Protections anti-choc (payables avec la Cagnotte F CFA) */}
              <section aria-label="Protections anti-choc" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-base sm:text-lg font-extrabold text-sky-300">
                      <Shield className="h-5 w-5 text-sky-400 shrink-0" />
                      <span>Protections (Cagnotte F CFA)</span>
                    </h3>
                    <p className="text-xs text-[#B8ABA0]">
                      Payez directement avec votre Cagnotte en F CFA pour encaisser les collisions.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onToggleAutoUseProtection}
                    className={`inline-flex min-h-[36px] items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                      Boolean(progress.autoUseProtectionOnStart)
                        ? 'border-sky-400/60 bg-sky-500/20 text-sky-300'
                        : 'border-white/15 bg-[#221914] text-[#C8BCB1] hover:text-[#FAF5EE]'
                    }`}
                  >
                    <Check
                      className={`h-3.5 w-3.5 ${
                        Boolean(progress.autoUseProtectionOnStart) ? 'opacity-100' : 'opacity-25'
                      }`}
                    />
                    <span>Activer auto au départ</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  {SHOP_PROTECTIONS.map((prot) => {
                    const count = Math.max(
                      0,
                      Math.floor(progress.protectionInventory?.[prot.id] ?? 0)
                    );
                    const canAfford = progress.totalLootCfa >= prot.priceCfa;
                    const isSelected = progress.selectedProtection === prot.id && count > 0;

                    return (
                      <article
                        key={prot.id}
                        className={`flex flex-col justify-between rounded-2xl border p-3.5 transition-colors ${
                          isSelected
                            ? 'border-sky-400 bg-[#131D22]'
                            : 'border-white/12 bg-[#1B130F]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div
                              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15"
                              style={{ backgroundColor: `${prot.primaryColor}26` }}
                            >
                              <Shield className="h-6 w-6" style={{ color: prot.accentColor }} />
                            </div>
                            <span
                              className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold tabular-nums ${
                                count > 0
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                                  : 'bg-white/5 text-[#8E8178]'
                              }`}
                            >
                              En stock : {count}
                            </span>
                          </div>

                          <div className="mt-3 flex items-start justify-between gap-2">
                            <h4 className="font-display text-base font-bold text-[#FAF5EE] leading-snug">
                              {prot.name}
                            </h4>
                            <span className="shrink-0 font-mono text-xs font-extrabold tabular-nums text-emerald-400">
                              {prot.priceCfa.toLocaleString('fr-FR')} F
                            </span>
                          </div>

                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300">
                            <Shield className="h-3.5 w-3.5" />
                            <span>{prot.subtitle}</span>
                          </div>

                          <p className="mt-1.5 text-xs text-[#B8ABA0] leading-relaxed">
                            {prot.description}
                          </p>
                        </div>

                        <div className="mt-3.5 pt-3 border-t border-white/10 space-y-2">
                          <div className="flex items-center gap-2">
                            {count > 0 && (
                              <button
                                type="button"
                                onClick={() => onSelectProtection(prot.id)}
                                className={`inline-flex min-h-[40px] items-center justify-center rounded-xl border px-3 py-2 text-xs font-bold transition-colors whitespace-nowrap ${
                                  isSelected
                                    ? 'border-sky-400 bg-sky-500/20 text-sky-300'
                                    : 'border-white/15 bg-[#261B16] text-[#D6CBC0] hover:bg-[#33241D]'
                                }`}
                              >
                                {isSelected ? 'Sélectionné' : 'Choisir'}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={!canAfford}
                              onClick={() => onBuyProtection(prot.id)}
                              className={`inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition-colors whitespace-nowrap ${
                                canAfford
                                  ? 'bg-emerald-500 text-[#0B1712] hover:bg-emerald-400'
                                  : 'bg-[#2C2522] text-[#8E8178] cursor-not-allowed'
                              }`}
                            >
                              <Wallet className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                {canAfford
                                  ? `PAYER (${prot.priceCfa.toLocaleString('fr-FR')} F)`
                                  : 'CAGNOTTE BASSE'}
                              </span>
                            </button>
                          </div>

                          {!canAfford && (
                            <p className="text-[11px] text-[#8E8178] text-center tabular-nums">
                              Manque {(prot.priceCfa - progress.totalLootCfa).toLocaleString('fr-FR')} F CFA
                            </p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#1B120E] px-4 py-3 sm:px-6">
          <span className="text-xs text-[#B8ABA0]">
            Tenue : <strong className="text-[#FAF5EE]">{getOutfitById(progress.equippedOutfit).name}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-orange-500 px-5 py-2 text-sm font-extrabold text-[#140E0C] hover:bg-orange-400 transition-colors whitespace-nowrap"
          >
            Retour au jeu
          </button>
        </div>
      </div>
    </div>
  );
};
