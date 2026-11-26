export type OutfitId =
  | 'base'
  | 'pdg_didi'
  | 'rood_woko'
  | 'police'
  | 'etalons'
  | 'tokbook_or';

export type CharacterId =
  | 'didi'
  | 'awa'
  | 'policier'
  | 'taximan'
  | 'boss'
  | 'taoruto_binks'
  | 'rikmaro'
  | 'naruto_odg'
  | 'fils_korogho'
  | 'bill_late'
  | 'tomsi';

export interface ShopOutfit {
  id: OutfitId;
  name: string;
  description: string;
  price: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  badgeText?: string;
}

export interface ShopCharacter {
  id: CharacterId;
  name: string;
  description: string;
  price: number;
  speedMultiplier: number;
  speedLabel: string;
  speedStars: number; // 1..5
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export const SHOP_OUTFITS: ShopOutfit[] = [
  {
    id: 'base',
    name: 'Tenue de base',
    description: 'Style classique de la rue à Ouagadougou.',
    price: 0,
    primaryColor: '#F59E0B',
    secondaryColor: '#1E293B',
    accentColor: '#DC2626',
  },
  {
    id: 'pdg_didi',
    name: 'Tenue PDG DIDI',
    description: 'Casquette rouge, chaîne en or, hoodie blanc et pantalon rouge.',
    price: 2500,
    primaryColor: '#F8FAFC',
    secondaryColor: '#DC2626',
    accentColor: '#FBBF24',
  },
  {
    id: 'rood_woko',
    name: 'Tenue Rood-Woko',
    description: 'Boubou coloré traditionnel brodé du Grand Marché de Ouaga.',
    price: 4000,
    primaryColor: '#EA580C',
    secondaryColor: '#0D9488',
    accentColor: '#FACC15',
  },
  {
    id: 'police',
    name: 'Tenue Police',
    description: 'Uniforme bleu de la brigade rapide avec ceinturon blanc.',
    price: 6000,
    primaryColor: '#1D4ED8',
    secondaryColor: '#172554',
    accentColor: '#F8FAFC',
  },
  {
    id: 'etalons',
    name: 'Tenue Footballeur Étalons',
    description: 'Maillot vert officiel des Étalons du Burkina Faso.',
    price: 8000,
    primaryColor: '#15803D',
    secondaryColor: '#DC2626',
    accentColor: '#FACC15',
  },
  {
    id: 'tokbook_or',
    name: 'Tenue Or TokBook',
    description: 'Tenue dorée brillante de légende pour briller dans toute la ville.',
    price: 15000,
    primaryColor: '#FBBF24',
    secondaryColor: '#B45309',
    accentColor: '#FEF08A',
  },
];

export const SHOP_CHARACTERS: ShopCharacter[] = [
  {
    id: 'didi',
    name: 'DIDI',
    description: 'Jeune garçon de Ouaga avec casquette rouge et sac à dos.',
    price: 0,
    speedMultiplier: 1.0,
    speedLabel: 'Vitesse normale',
    speedStars: 2,
    primaryColor: '#F59E0B',
    secondaryColor: '#0284C7',
    accentColor: '#DC2626',
  },
  {
    id: 'awa',
    name: 'Awa la Marchande',
    description: 'Fille dynamique avec pagne coloré, agile entre les étals.',
    price: 5000,
    speedMultiplier: 1.08,
    speedLabel: 'Rapide (+8%)',
    speedStars: 3,
    primaryColor: '#0D9488',
    secondaryColor: '#EA580C',
    accentColor: '#FACC15',
  },
  {
    id: 'policier',
    name: 'Le Policier Moto',
    description: 'Agent d’élite habitué aux poursuites qui court très vite.',
    price: 9000,
    speedMultiplier: 1.15,
    speedLabel: 'Très rapide (+15%)',
    speedStars: 4,
    primaryColor: '#1D4ED8',
    secondaryColor: '#172554',
    accentColor: '#F8FAFC',
  },
  {
    id: 'taximan',
    name: 'Le Taximan',
    description: 'As des carrefours avec casquette taxi verte, réflexes éclair.',
    price: 10000,
    speedMultiplier: 1.15,
    speedLabel: 'Très rapide (+15%)',
    speedStars: 4,
    primaryColor: '#16A34A',
    secondaryColor: '#1E293B',
    accentColor: '#FACC15',
  },
  {
    id: 'boss',
    name: 'Le Boss de Ouaga 2000',
    description: 'Costume noir, lunettes noires et allure de patron : le plus rapide.',
    price: 25000,
    speedMultiplier: 1.24,
    speedLabel: 'Ultra rapide (+24%)',
    speedStars: 5,
    primaryColor: '#18181B',
    secondaryColor: '#27272A',
    accentColor: '#FBBF24',
  },
  {
    id: 'taoruto_binks',
    name: 'Taoruto Binks',
    description: 'Coureur au bandeau ninja orange vif et baskets légères de quartier.',
    price: 6500,
    speedMultiplier: 1.12,
    speedLabel: 'Rapide (+12%)',
    speedStars: 3,
    primaryColor: '#EA580C',
    secondaryColor: '#1E293B',
    accentColor: '#38BDF8',
  },
  {
    id: 'rikmaro',
    name: 'Rikmaro',
    description: 'Ombre agile en tenue bleu nuit avec écharpe rouge flamboyante.',
    price: 8500,
    speedMultiplier: 1.14,
    speedLabel: 'Très rapide (+14%)',
    speedStars: 4,
    primaryColor: '#1E3A8A',
    secondaryColor: '#0F172A',
    accentColor: '#EF4444',
  },
  {
    id: 'naruto_odg',
    name: 'Naruto odg',
    description: 'Sprinteur légendaire de Ouagadougou au bandeau doré et veste orange.',
    price: 12000,
    speedMultiplier: 1.18,
    speedLabel: 'Très rapide (+18%)',
    speedStars: 4,
    primaryColor: '#F97316',
    secondaryColor: '#18181B',
    accentColor: '#FACC15',
  },
  {
    id: 'fils_korogho',
    name: 'Fils korogho',
    description: 'Jeune prodige stylé en veste bordeaux et chaîne dorée brillante.',
    price: 14000,
    speedMultiplier: 1.2,
    speedLabel: 'Très rapide (+20%)',
    speedStars: 4,
    primaryColor: '#991B1B',
    secondaryColor: '#1C1917',
    accentColor: '#FBBF24',
  },
  {
    id: 'bill_late',
    name: 'Bill late',
    description: 'Génie ultra-rapide en blazer bleu roi avec lunettes high-tech.',
    price: 18000,
    speedMultiplier: 1.22,
    speedLabel: 'Ultra rapide (+22%)',
    speedStars: 5,
    primaryColor: '#1D4ED8',
    secondaryColor: '#111827',
    accentColor: '#38BDF8',
  },
  {
    id: 'tomsi',
    name: 'Tomsi',
    description: 'Champion royal en veste pourpre et or, foulée supersonique.',
    price: 22000,
    speedMultiplier: 1.25,
    speedLabel: 'Ultra rapide (+25%)',
    speedStars: 5,
    primaryColor: '#7C3AED',
    secondaryColor: '#1E1B4B',
    accentColor: '#FACC15',
  },
];

export type JuiceId = 'gingembre' | 'bissap' | 'zoom_koom';

export type ProtectionId = 'grigri' | 'double_amulette' | 'gilet_blinde';

export interface ShopJuice {
  id: JuiceId;
  name: string;
  subtitle: string;
  description: string;
  priceCoins: number;
  durationSec: number;
  speedBonus: number;
  policePushback: number;
  primaryColor: string;
  accentColor: string;
}

export interface ShopProtection {
  id: ProtectionId;
  name: string;
  subtitle: string;
  description: string;
  priceCfa: number;
  shieldCharges: number;
  invincibleBonusSec: number;
  primaryColor: string;
  accentColor: string;
}

export const SHOP_JUICES: ShopJuice[] = [
  {
    id: 'gingembre',
    name: 'Jus de Gingembre',
    subtitle: 'Turbo +6 s',
    description: 'Gnamakoudji frais : boost de vitesse immédiat et percée d’obstacles pendant 6 s.',
    priceCoins: 400,
    durationSec: 6,
    speedBonus: 11,
    policePushback: 20,
    primaryColor: '#F59E0B',
    accentColor: '#FEF08A',
  },
  {
    id: 'bissap',
    name: 'Jus de Bissap Glacé',
    subtitle: 'Turbo +10 s',
    description: 'Bissap rouge ultra-frais : sprint rapide, percée d’obstacles et police distancée (10 s).',
    priceCoins: 800,
    durationSec: 10,
    speedBonus: 13,
    policePushback: 28,
    primaryColor: '#E11D48',
    accentColor: '#FDA4AF',
  },
  {
    id: 'zoom_koom',
    name: 'Zoom-Koom Turbo',
    subtitle: 'Méga-Turbo +14 s',
    description: 'Boisson énergétique légendaire de Ouaga : vitesse maximale pendant 14 s.',
    priceCoins: 1500,
    durationSec: 14,
    speedBonus: 15.5,
    policePushback: 38,
    primaryColor: '#EA580C',
    accentColor: '#FBBF24',
  },
];

export const SHOP_PROTECTIONS: ShopProtection[] = [
  {
    id: 'grigri',
    name: 'Grigri Protecteur',
    subtitle: '1 bouclier anti-choc',
    description: 'Absorbe 1 collision contre un taxi, bus ou barrière sans vous faire arrêter.',
    priceCfa: 1000,
    shieldCharges: 1,
    invincibleBonusSec: 1.5,
    primaryColor: '#0284C7',
    accentColor: '#7DD3FC',
  },
  {
    id: 'double_amulette',
    name: 'Double Amulette',
    subtitle: '2 boucliers anti-choc',
    description: 'Protège contre 2 chocs dans la même course avec récupération rapide.',
    priceCfa: 2000,
    shieldCharges: 2,
    invincibleBonusSec: 1.8,
    primaryColor: '#0D9488',
    accentColor: '#5EEAD4',
  },
  {
    id: 'gilet_blinde',
    name: 'Gilet Blindé de Ouaga',
    subtitle: '3 boucliers anti-choc',
    description: 'Armure complète : encaisse jusqu’à 3 chocs avec longue invincibilité après impact.',
    priceCfa: 3500,
    shieldCharges: 3,
    invincibleBonusSec: 2.4,
    primaryColor: '#10B981',
    accentColor: '#A7F3D0',
  },
];

export function getOutfitById(id: OutfitId): ShopOutfit {
  return SHOP_OUTFITS.find((o) => o.id === id) ?? SHOP_OUTFITS[0];
}

export function getCharacterById(id: CharacterId): ShopCharacter {
  return SHOP_CHARACTERS.find((c) => c.id === id) ?? SHOP_CHARACTERS[0];
}

export function getJuiceById(id: JuiceId): ShopJuice {
  return SHOP_JUICES.find((j) => j.id === id) ?? SHOP_JUICES[0];
}

export function getProtectionById(id: ProtectionId): ShopProtection {
  return SHOP_PROTECTIONS.find((p) => p.id === id) ?? SHOP_PROTECTIONS[0];
}
