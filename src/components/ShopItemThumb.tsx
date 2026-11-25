import React from 'react';
import { CharacterId, OutfitId, SHOP_CHARACTERS, SHOP_OUTFITS } from '../game/shop';

interface ShopItemThumbProps {
  kind: 'outfit' | 'character';
  id: OutfitId | CharacterId;
}

export const ShopItemThumb: React.FC<ShopItemThumbProps> = React.memo(({ kind, id }) => {
  const item =
    kind === 'outfit'
      ? SHOP_OUTFITS.find((o) => o.id === id) ?? SHOP_OUTFITS[0]
      : SHOP_CHARACTERS.find((c) => c.id === id) ?? SHOP_CHARACTERS[0];

  const isGold = id === 'tokbook_or';
  const isBoss = id === 'boss';
  const isPolice = id === 'police' || id === 'policier';
  const isAwa = id === 'awa';
  const isTaximan = id === 'taximan';
  const isPdg = id === 'pdg_didi';
  const isEtalons = id === 'etalons';
  const isBoubou = id === 'rood_woko';
  const isTaoruto = id === 'taoruto_binks';
  const isRikmaro = id === 'rikmaro';
  const isNarutoOdg = id === 'naruto_odg';
  const isFilsKorogho = id === 'fils_korogho';
  const isBillLate = id === 'bill_late';
  const isTomsi = id === 'tomsi';
  const hasLongSleeves =
    isPdg ||
    isBoubou ||
    isGold ||
    isBoss ||
    isTaoruto ||
    isRikmaro ||
    isNarutoOdg ||
    isFilsKorogho ||
    isBillLate ||
    isTomsi;

  return (
    <div
      className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border border-white/10"
      style={{
        background: isGold
          ? 'radial-gradient(circle at 50% 35%, #451A03 0%, #17110E 78%)'
          : 'radial-gradient(circle at 50% 35%, #2D1C12 0%, #130E0C 80%)',
      }}
    >
      <svg
        viewBox="0 0 140 120"
        className="h-28 w-32 drop-shadow-[0_6px_12px_rgba(0,0,0,0.55)]"
        aria-hidden="true"
      >
        {/* Subtle Ouaga ground ring */}
        <ellipse cx="70" cy="108" rx="34" ry="7" fill="#000000" fillOpacity="0.45" />
        <ellipse
          cx="70"
          cy="107"
          rx="28"
          ry="4.5"
          fill="none"
          stroke={item.accentColor}
          strokeOpacity="0.45"
          strokeWidth="1.5"
        />

        {/* Legs / Pants */}
        <rect
          x="52"
          y="74"
          width="14"
          height="26"
          rx="4"
          fill={item.secondaryColor}
        />
        <rect
          x="74"
          y="74"
          width="14"
          height="26"
          rx="4"
          fill={item.secondaryColor}
        />

        {/* Pagne skirt for Awa */}
        {isAwa && (
          <>
            <rect x="48" y="66" width="44" height="20" rx="5" fill="#0D9488" />
            <rect x="48" y="80" width="44" height="5" fill="#FACC15" />
          </>
        )}

        {/* Shoes */}
        <rect
          x="49"
          y="97"
          width="18"
          height="8"
          rx="3"
          fill={isGold ? '#FBBF24' : isBoss ? '#18181B' : '#FAF5EE'}
        />
        <rect
          x="73"
          y="97"
          width="18"
          height="8"
          rx="3"
          fill={isGold ? '#FBBF24' : isBoss ? '#18181B' : '#FAF5EE'}
        />

        {/* Arms */}
        <rect
          x="36"
          y="44"
          width="11"
          height="28"
          rx="5"
          fill={hasLongSleeves ? item.primaryColor : '#6B3E26'}
        />
        <rect
          x="93"
          y="44"
          width="11"
          height="28"
          rx="5"
          fill={hasLongSleeves ? item.primaryColor : '#6B3E26'}
        />
        {!hasLongSleeves && (
          <>
            <rect x="36" y="44" width="11" height="12" rx="4" fill={item.primaryColor} />
            <rect x="93" y="44" width="11" height="12" rx="4" fill={item.primaryColor} />
          </>
        )}

        {/* Torso */}
        <rect
          x="48"
          y="42"
          width="44"
          height="36"
          rx="7"
          fill={item.primaryColor}
        />

        {/* Outfit Details */}
        {isPdg && (
          <>
            {/* Gold chain */}
            <path
              d="M58 43 Q70 57 82 43"
              fill="none"
              stroke="#FBBF24"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle cx="70" cy="54" r="3.5" fill="#FBBF24" />
          </>
        )}

        {isBoubou && (
          <>
            <rect x="46" y="64" width="48" height="18" rx="4" fill="#EA580C" />
            <rect x="64" y="42" width="12" height="32" rx="2" fill="#FACC15" />
          </>
        )}

        {isPolice && (
          <>
            <rect x="48" y="67" width="44" height="5" fill="#F8FAFC" />
            <rect x="75" y="49" width="7" height="7" rx="1.5" fill="#FBBF24" />
          </>
        )}

        {isEtalons && (
          <>
            <rect x="48" y="53" width="44" height="9" fill="#DC2626" />
            <polygon points="70,53 72,58 77,58 73,61 74,66 70,63 66,66 67,61 63,58 68,58" fill="#FACC15" />
          </>
        )}

        {(isBoss || isBillLate) && (
          <>
            <polygon
              points="65,42 75,42 72,62 68,62"
              fill={isBillLate ? '#38BDF8' : '#FBBF24'}
            />
          </>
        )}

        {isRikmaro && (
          <rect x="52" y="40" width="36" height="7" rx="3" fill="#EF4444" />
        )}

        {(isFilsKorogho || isTomsi) && (
          <>
            <path
              d="M58 43 Q70 57 82 43"
              fill="none"
              stroke="#FBBF24"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="70" cy="54" r="3" fill="#FBBF24" />
          </>
        )}

        {isGold && (
          <>
            <path
              d="M58 43 Q70 57 82 43"
              fill="none"
              stroke="#FEF08A"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <rect x="52" y="47" width="10" height="24" rx="3" fill="#FEF08A" fillOpacity="0.35" />
          </>
        )}

        {/* Head */}
        <rect x="56" y="18" width="28" height="24" rx="7" fill="#633922" />

        {/* Headwear & Face */}
        {isAwa ? (
          <>
            <rect x="54" y="12" width="32" height="12" rx="5" fill="#EA580C" />
            <circle cx="77" cy="12" r="5" fill="#FACC15" />
          </>
        ) : isPolice ? (
          <>
            <rect x="53" y="12" width="34" height="10" rx="4" fill="#1D4ED8" />
            <rect x="53" y="19" width="34" height="3" fill="#F8FAFC" />
            <rect x="55" y="22" width="30" height="3" rx="1" fill="#0F172A" />
          </>
        ) : isTaximan ? (
          <>
            <rect x="54" y="13" width="32" height="9" rx="4" fill="#16A34A" />
            <rect x="64" y="14" width="12" height="5" rx="1" fill="#FACC15" />
            <rect x="56" y="21" width="32" height="3" rx="1" fill="#16A34A" />
          </>
        ) : isBoss || isBillLate ? (
          <>
            <rect x="55" y="14" width="30" height="7" rx="3" fill="#111827" />
            {/* Dark or Tech Sunglasses */}
            <rect
              x="58"
              y="25"
              width="10"
              height="6"
              rx="2"
              fill={isBillLate ? '#0C4A6E' : '#09090B'}
              stroke={isBillLate ? '#38BDF8' : '#FBBF24'}
              strokeWidth="1"
            />
            <rect
              x="72"
              y="25"
              width="10"
              height="6"
              rx="2"
              fill={isBillLate ? '#0C4A6E' : '#09090B'}
              stroke={isBillLate ? '#38BDF8' : '#FBBF24'}
              strokeWidth="1"
            />
            <line
              x1="68"
              y1="27"
              x2="72"
              y2="27"
              stroke={isBillLate ? '#38BDF8' : '#FBBF24'}
              strokeWidth="1.2"
            />
          </>
        ) : isTaoruto || isNarutoOdg ? (
          <>
            {/* Spiky hair + Ninja headband */}
            <polygon points="55,18 63,8 70,15 77,8 85,18" fill="#FACC15" />
            <rect
              x="54"
              y="15"
              width="32"
              height="6"
              rx="2"
              fill={isNarutoOdg ? '#18181B' : '#0284C7'}
            />
            <rect
              x="64"
              y="16"
              width="12"
              height="4"
              rx="1"
              fill={isNarutoOdg ? '#FACC15' : '#E2E8F0'}
            />
          </>
        ) : isRikmaro ? (
          <>
            <rect x="55" y="13" width="30" height="7" rx="3" fill="#0F172A" />
            <rect x="54" y="17" width="32" height="5" rx="2" fill="#EF4444" />
          </>
        ) : isTomsi ? (
          <>
            <rect x="55" y="12" width="30" height="7" rx="2" fill="#FACC15" />
            <polygon points="70,8 73,14 67,14" fill="#7C3AED" />
          </>
        ) : isFilsKorogho ? (
          <>
            <rect x="54" y="12" width="32" height="10" rx="4" fill="#991B1B" />
            <rect x="58" y="20" width="32" height="3.5" rx="1.5" fill="#FBBF24" />
          </>
        ) : (
          <>
            {/* Signature Red Cap (or Gold Cap on TokBook Or) */}
            <rect
              x="54"
              y="12"
              width="32"
              height="10"
              rx="4"
              fill={isGold ? '#FBBF24' : '#DC2626'}
            />
            <rect
              x="58"
              y="20"
              width="32"
              height="3.5"
              rx="1.5"
              fill={isGold ? '#FDE047' : '#DC2626'}
            />
          </>
        )}
      </svg>
    </div>
  );
});

ShopItemThumb.displayName = 'ShopItemThumb';
