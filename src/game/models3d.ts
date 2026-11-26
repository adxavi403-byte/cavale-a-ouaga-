import * as THREE from 'three';
import { LANE_WIDTH } from './engine3d';
import { CharacterId, OutfitId } from './shop';
import { CollectibleKind, ObstacleKind } from './types';

export interface ThiefRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  shieldBubble: THREE.Mesh;
  turboFlame: THREE.Mesh;
  shadow: THREE.Mesh;
  disposeUnique?: () => void;
}

export interface PoliceRig {
  root: THREE.Group;
  frontWheel: THREE.Mesh;
  rearWheel: THREE.Mesh;
  redBeaconMat: THREE.MeshStandardMaterial;
  blueBeaconMat: THREE.MeshStandardMaterial;
  sirenGlowMat: THREE.MeshBasicMaterial;
  shadow: THREE.Mesh;
}

export interface SceneryChunk {
  group: THREE.Group;
  z: number;
}

function createRoadCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm sun-baked Sahelian asphalt
  ctx.fillStyle = '#36322F';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle worn wheel-track darkening per lane
  for (const cx of [108, 256, 404]) {
    ctx.fillStyle = 'rgba(20, 18, 16, 0.22)';
    ctx.fillRect(cx - 32, 0, 16, 512);
    ctx.fillRect(cx + 16, 0, 16, 512);
  }

  // Natural asphalt aggregate speckles
  for (let i = 0; i < 480; i++) {
    const rx = (i * 73 + 17) % 512;
    const ry = (i * 139 + 31) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(rx, ry, 2 + (i % 2), 3 + (i % 3));
  }

  // Laterite dusty shoulders on left & right edges
  ctx.fillStyle = '#9E4728';
  ctx.fillRect(0, 0, 32, 512);
  ctx.fillRect(480, 0, 32, 512);
  ctx.fillStyle = 'rgba(120, 48, 22, 0.38)';
  for (let i = 0; i < 90; i++) {
    const ry = (i * 59) % 512;
    ctx.fillRect((i * 13) % 28, ry, 4, 6);
    ctx.fillRect(480 + ((i * 17) % 28), ry, 4, 6);
  }

  // Jointed concrete curb stones + storm drain grates
  ctx.fillStyle = '#DCD2C6';
  ctx.fillRect(32, 0, 10, 512);
  ctx.fillRect(470, 0, 10, 512);
  ctx.fillStyle = 'rgba(60, 48, 40, 0.35)';
  for (let y = 0; y < 512; y += 32) {
    ctx.fillRect(32, y, 10, 2);
    ctx.fillRect(470, y, 10, 2);
  }
  // White reflective road edge stripe
  ctx.fillStyle = 'rgba(250, 245, 238, 0.72)';
  ctx.fillRect(46, 0, 4, 512);
  ctx.fillRect(462, 0, 4, 512);

  // Subtle embedded tram/rail bed for the 3 lanes
  const laneCenters = [108, 256, 404];
  for (const cx of laneCenters) {
    // Crushed gravel ballast tint
    ctx.fillStyle = 'rgba(42, 36, 33, 0.35)';
    ctx.fillRect(cx - 26, 0, 52, 512);
    // Weathered timber/concrete sleepers
    ctx.fillStyle = 'rgba(26, 20, 17, 0.42)';
    for (let y = 0; y < 512; y += 32) {
      ctx.fillRect(cx - 28, y + 8, 56, 7);
    }
    // Steel rails with sun highlight
    ctx.fillStyle = 'rgba(185, 194, 204, 0.28)';
    ctx.fillRect(cx - 22, 0, 3, 512);
    ctx.fillRect(cx + 19, 0, 3, 512);
  }

  // Crisp weathered yellow lane dashes
  ctx.fillStyle = '#FACC15';
  for (let y = 12; y < 512; y += 64) {
    ctx.fillRect(178, y, 7, 34);
    ctx.fillRect(327, y, 7, 34);
  }

  // Subtle asphalt patch / micro-crack & roadside storm drains
  ctx.fillStyle = 'rgba(22, 19, 17, 0.34)';
  ctx.fillRect(88, 120, 42, 68);
  ctx.fillRect(368, 310, 46, 56);
  ctx.fillStyle = '#1C1917';
  for (const dy of [96, 352]) {
    ctx.fillRect(42, dy, 10, 26);
    ctx.fillRect(460, dy, 10, 26);
    ctx.fillStyle = '#57534E';
    for (let bar = 3; bar < 24; bar += 6) {
      ctx.fillRect(43, dy + bar, 8, 2);
      ctx.fillRect(461, dy + bar, 8, 2);
    }
    ctx.fillStyle = '#1C1917';
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  return tex;
}

function createAsphaltBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  // Coarse tarmac grain & aggregate micro-relief (linear data map)
  for (let i = 0; i < 1600; i++) {
    const x = (i * 79 + 13) % 256;
    const y = (i * 151 + 29) % 256;
    const shade = 92 + ((i * 37) % 80);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Raised concrete curbs + recessed railway sleepers
  ctx.fillStyle = '#B8B8B8';
  ctx.fillRect(16, 0, 6, 256);
  ctx.fillRect(234, 0, 6, 256);
  ctx.fillStyle = '#5A5A5A';
  for (const cx of [54, 128, 202]) {
    for (let y = 0; y < 256; y += 16) {
      ctx.fillRect(cx - 14, y + 4, 28, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  // Keep linear NoColorSpace for bump/roughness data map
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  return tex;
}

function createCoinFaceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FBBF24';
  ctx.fillRect(0, 0, 128, 128);

  // Concentric milled coin rim
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#FEF08A';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(64, 64, 44, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#78350F';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('100', 64, 54);
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('CFA', 64, 80);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBanknoteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#10B981';
  ctx.fillRect(0, 0, 128, 64);

  ctx.strokeStyle = '#ECFDF5';
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, 118, 54);

  // Gold metallic security foil strip
  ctx.fillStyle = '#FDE047';
  ctx.fillRect(88, 6, 12, 52);

  ctx.fillStyle = '#064E3B';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('500 F', 48, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createLateriteCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#9E4B2B';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 420; i++) {
    const x = (i * 53 + 11) % 256;
    const y = (i * 97 + 23) % 256;
    const sz = 2 + (i % 5);
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(194, 108, 62, 0.28)'
        : i % 3 === 1
          ? 'rgba(105, 42, 20, 0.28)'
          : 'rgba(222, 165, 118, 0.14)';
    ctx.fillRect(x, y, sz, sz);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 4);
  return tex;
}

function createSidewalkCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#C9BEB0';
  ctx.fillRect(0, 0, 256, 256);

  // Concrete paver joints
  ctx.strokeStyle = 'rgba(92, 80, 68, 0.35)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  for (let x = 0; x < 256; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }

  // Red dust drift along edge
  ctx.fillStyle = 'rgba(158, 75, 43, 0.16)';
  for (let i = 0; i < 120; i++) {
    ctx.fillRect((i * 47) % 256, (i * 83) % 256, 4, 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  return tex;
}

function createZincRoofCanvasTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#7C3219';
  ctx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 8) {
    ctx.fillStyle = 'rgba(255, 235, 215, 0.14)';
    ctx.fillRect(x, 0, 3, 128);
    ctx.fillStyle = 'rgba(20, 8, 4, 0.28)';
    ctx.fillRect(x + 4, 0, 3, 128);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 3);
  return tex;
}

function createBuildingFacadeTexture(
  variant: 'commercial' | 'residential' | 'market' | 'modern',
  wallHex: string,
  trimHex: string,
  shopLabel: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base plastered wall
  ctx.fillStyle = wallHex;
  ctx.fillRect(0, 0, 256, 512);

  // Subtle Sahelian plaster texture & sun weathering gradient
  const sunGrad = ctx.createLinearGradient(0, 0, 0, 512);
  sunGrad.addColorStop(0, 'rgba(255, 245, 225, 0.14)');
  sunGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0)');
  sunGrad.addColorStop(1, 'rgba(110, 48, 22, 0.25)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(0, 0, 256, 512);

  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect((i * 41) % 256, (i * 89) % 512, 4, 4);
  }

  // Roof cornice line & floor slab bands
  ctx.fillStyle = trimHex;
  ctx.fillRect(0, 0, 256, 16);
  ctx.fillRect(0, 170, 256, 8);
  ctx.fillRect(0, 336, 256, 10);

  // Upper 2 floors: framed windows with shutters / reflections
  const cols = variant === 'modern' ? [22, 92, 162] : [26, 98, 170];
  const rows = [42, 200];
  for (const ry of rows) {
    for (const cx of cols) {
      // Recessed window frame
      ctx.fillStyle = trimHex;
      ctx.fillRect(cx - 5, ry - 5, 62, 94);

      if (variant === 'modern') {
        const glassGrad = ctx.createLinearGradient(cx, ry, cx + 52, ry + 84);
        glassGrad.addColorStop(0, '#38BDF8');
        glassGrad.addColorStop(0.5, '#0F172A');
        glassGrad.addColorStop(1, '#1E293B');
        ctx.fillStyle = glassGrad;
        ctx.fillRect(cx, ry, 52, 84);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(cx + 6, ry + 6, 12, 70);
      } else {
        // Dark interior glass + mullions
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(cx, ry, 52, 84);
        ctx.fillStyle = '#334155';
        ctx.fillRect(cx + 6, ry + 6, 18, 32);
        ctx.fillRect(cx + 28, ry + 6, 18, 32);
        // Wooden / painted shutters on residential
        if (variant === 'residential') {
          ctx.fillStyle = '#7C2D12';
          ctx.fillRect(cx - 10, ry, 10, 84);
          ctx.fillRect(cx + 52, ry, 10, 84);
        }
        // Window sill
        ctx.fillStyle = '#E7DDD0';
        ctx.fillRect(cx - 8, ry + 84, 68, 7);
        // Subtle AC condenser box below select windows on upper floor
        if (ry === 42 && cx > 100 && variant !== 'market') {
          ctx.fillStyle = '#CBD5E1';
          ctx.fillRect(cx + 8, ry + 93, 36, 22);
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(cx + 22, ry + 104, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Vertical exterior rainwater downpipe on right edge
  ctx.fillStyle = '#64748B';
  ctx.fillRect(244, 16, 6, 326);

  // Ground floor (y = 346..512): authentic Ouaga street shopfront
  ctx.fillStyle = 'rgba(24, 18, 14, 0.16)';
  ctx.fillRect(0, 346, 256, 166);

  // Shop signboard band
  ctx.fillStyle = variant === 'market' ? '#B91C1C' : variant === 'commercial' ? '#0F766E' : '#1E3A8A';
  ctx.fillRect(14, 354, 228, 34);
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 356, 224, 30);
  ctx.fillStyle = '#FAF5EE';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(shopLabel, 128, 372);

  // Corrugated metal shop roll-up shutters + open doorway
  for (const sx of [20, 140]) {
    ctx.fillStyle = '#475569';
    ctx.fillRect(sx, 396, 96, 114);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let sy = 402; sy < 508; sy += 8) {
      ctx.fillRect(sx + 2, sy, 92, 2);
    }
  }
  // Open lit shop doorway on left bay
  ctx.fillStyle = '#291D16';
  ctx.fillRect(26, 408, 84, 102);
  ctx.fillStyle = '#FDE68A';
  ctx.fillRect(34, 416, 68, 12);

  // Concrete pillars flanking bays
  ctx.fillStyle = trimHex;
  ctx.fillRect(0, 346, 16, 166);
  ctx.fillRect(120, 346, 16, 166);
  ctx.fillRect(240, 346, 16, 166);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSignCanvasTexture(
  label: string,
  bgHex: string,
  accentHex: string,
  sublabel?: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 112);

  ctx.fillStyle = '#FAF5EE';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(label, 256, sublabel ? 50 : 64);

  if (sublabel) {
    ctx.fillStyle = accentHex;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(sublabel, 256, 95);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(10, 6, 4, 0.55)');
  grad.addColorStop(1, 'rgba(10, 6, 4, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function createHeadlightPoolTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(254, 240, 138, 0.52)');
  grad.addColorStop(0.55, 'rgba(254, 240, 138, 0.2)');
  grad.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(48, 0);
  ctx.lineTo(62, 128);
  ctx.lineTo(2, 128);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHazardSignTexture(direction: 'UP' | 'DOWN'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // High-contrast warning background
  ctx.fillStyle = direction === 'UP' ? '#DC2626' : '#F59E0B';
  ctx.fillRect(0, 0, 256, 128);

  // Diagonal hazard stripes along edges
  ctx.fillStyle = direction === 'UP' ? '#FACC15' : '#18181B';
  for (let x = -128; x < 320; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 18, 0);
    ctx.lineTo(x - 18, 128);
    ctx.lineTo(x - 36, 128);
    ctx.closePath();
    ctx.fill();
  }

  // Center high-contrast badge
  ctx.fillStyle = '#18181B';
  ctx.fillRect(34, 18, 188, 92);
  ctx.strokeStyle = '#FAF5EE';
  ctx.lineWidth = 4;
  ctx.strokeRect(34, 18, 188, 92);

  // Crisp directional chevron + action word
  ctx.fillStyle = direction === 'UP' ? '#FDE047' : '#38BDF8';
  ctx.beginPath();
  if (direction === 'UP') {
    ctx.moveTo(72, 42);
    ctx.lineTo(54, 78);
    ctx.lineTo(90, 78);
  } else {
    ctx.moveTo(72, 84);
    ctx.lineTo(54, 48);
    ctx.lineTo(90, 48);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FAF5EE';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(direction === 'UP' ? 'SAUTER' : 'GLISSER', 98, 65);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class AssetLibrary3D {
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private materialCache = new Map<string, THREE.MeshStandardMaterial>();
  private boxCache = new Map<string, THREE.BoxGeometry>();
  private geoCache = new Map<string, THREE.BufferGeometry>();

  public readonly roadTexture: THREE.CanvasTexture;
  public readonly roadBumpTexture: THREE.CanvasTexture;
  public readonly lateriteTexture: THREE.CanvasTexture;
  public readonly sidewalkTexture: THREE.CanvasTexture;
  public readonly roofTexture: THREE.CanvasTexture;
  public readonly facadeTextures: THREE.CanvasTexture[];
  public readonly shadowTexture: THREE.CanvasTexture;
  public readonly headlightPoolTexture: THREE.CanvasTexture;
  public readonly coinFaceTexture: THREE.CanvasTexture;
  public readonly banknoteTexture: THREE.CanvasTexture;
  public readonly jumpSignTexture: THREE.CanvasTexture;
  public readonly slideSignTexture: THREE.CanvasTexture;
  public readonly roodWokoSignTexture: THREE.CanvasTexture;
  public readonly ouaga2000SignTexture: THREE.CanvasTexture;
  public readonly roadMat: THREE.MeshStandardMaterial;
  public readonly lampBulbMat: THREE.MeshStandardMaterial;

  constructor(maxAnisotropy: number = 4) {
    const aniso = Math.min(6, Math.max(1, maxAnisotropy));

    this.roadTexture = this.trackTexture(createRoadCanvasTexture());
    this.roadTexture.anisotropy = aniso;

    this.roadBumpTexture = this.trackTexture(createAsphaltBumpTexture());
    this.roadBumpTexture.anisotropy = aniso;

    this.lateriteTexture = this.trackTexture(createLateriteCanvasTexture());
    this.lateriteTexture.anisotropy = aniso;

    this.sidewalkTexture = this.trackTexture(createSidewalkCanvasTexture());
    this.sidewalkTexture.anisotropy = aniso;

    this.roofTexture = this.trackTexture(createZincRoofCanvasTexture());
    this.roofTexture.anisotropy = aniso;

    this.facadeTextures = [
      this.trackTexture(createBuildingFacadeTexture('commercial', '#E7B089', '#F5ECE1', 'ALIMENTATION')),
      this.trackTexture(createBuildingFacadeTexture('residential', '#D97B59', '#EFE3D3', 'COIFFURE · OUAGA')),
      this.trackTexture(createBuildingFacadeTexture('market', '#E9C478', '#FAF3E7', 'ROOD-WOKO SHOP')),
      this.trackTexture(createBuildingFacadeTexture('modern', '#CBD5E1', '#64748B', 'OUAGA 2000')),
    ];
    for (const ft of this.facadeTextures) {
      ft.anisotropy = aniso;
    }

    this.shadowTexture = this.trackTexture(createContactShadowTexture());
    this.headlightPoolTexture = this.trackTexture(createHeadlightPoolTexture());
    this.coinFaceTexture = this.trackTexture(createCoinFaceTexture());
    this.banknoteTexture = this.trackTexture(createBanknoteTexture());
    this.jumpSignTexture = this.trackTexture(createHazardSignTexture('UP'));
    this.slideSignTexture = this.trackTexture(createHazardSignTexture('DOWN'));
    this.roodWokoSignTexture = this.trackTexture(
      createSignCanvasTexture('ROOD-WOKO', '#991B1B', '#FBBF24', 'GRAND MARCHÉ · OUAGA')
    );
    this.ouaga2000SignTexture = this.trackTexture(
      createSignCanvasTexture('OUAGA 2000', '#065F46', '#FCD34D', 'BOULEVARD DES MARTYRS')
    );

    this.roadMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.roadTexture,
        bumpMap: this.roadBumpTexture,
        bumpScale: 0.04,
        roughness: 0.85,
        metalness: 0.05,
        envMapIntensity: 0.8,
      })
    );

    this.lampBulbMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        roughness: 0.2,
        metalness: 0.1,
        emissive: 0xfde047,
        emissiveIntensity: 1.4,
      })
    );
  }

  public boxGeo(w: number, h: number, d: number): THREE.BoxGeometry {
    const key = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
    const cached = this.boxCache.get(key);
    if (cached) return cached;
    const g = this.trackGeo(new THREE.BoxGeometry(w, h, d));
    this.boxCache.set(key, g);
    return g;
  }

  public geo<T extends THREE.BufferGeometry>(key: string, factory: () => T): T {
    const cached = this.geoCache.get(key);
    if (cached) return cached as T;
    const g = this.trackGeo(factory());
    this.geoCache.set(key, g);
    return g;
  }

  public trackGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.push(g);
    return g;
  }

  public trackMat<T extends THREE.Material>(m: T): T {
    this.materials.push(m);
    return m;
  }

  public trackTexture<T extends THREE.Texture>(t: T): T {
    this.textures.push(t);
    return t;
  }

  public mat(
    color: number,
    roughness: number = 0.72,
    metalness: number = 0.08,
    emissive: number = 0x000000,
    emissiveIntensity: number = 0
  ): THREE.MeshStandardMaterial {
    const key = `${color}_${roughness}_${metalness}_${emissive}_${emissiveIntensity}`;
    const cached = this.materialCache.get(key);
    if (cached) return cached;

    const m = this.trackMat(
      new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        emissive,
        emissiveIntensity,
      })
    );
    this.materialCache.set(key, m);
    return m;
  }

  public texMat(
    key: string,
    map: THREE.Texture,
    roughness: number = 0.84,
    metalness: number = 0.04,
    color: number = 0xffffff
  ): THREE.MeshStandardMaterial {
    const cacheKey = `tex_${key}_${roughness}_${metalness}_${color}`;
    const cached = this.materialCache.get(cacheKey);
    if (cached) return cached;
    const m = this.trackMat(
      new THREE.MeshStandardMaterial({
        color,
        map,
        roughness,
        metalness,
      })
    );
    this.materialCache.set(cacheKey, m);
    return m;
  }

  public createShadowPlane(w: number, d: number, y: number = 0.02): THREE.Mesh {
    const geo = this.geo(`shadow_${w.toFixed(2)}_${d.toFixed(2)}`, () => new THREE.PlaneGeometry(w, d));
    const mat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: this.shadowTexture,
        transparent: true,
        depthWrite: false,
      })
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    return mesh;
  }

  public createHeadlightPool(w: number, d: number, zFront: number, y: number = 0.03): THREE.Mesh {
    const geo = this.geo(`hl_${w.toFixed(2)}_${d.toFixed(2)}`, () => new THREE.PlaneGeometry(w, d));
    const mat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: this.headlightPoolTexture,
        transparent: true,
        depthWrite: false,
      })
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, y, zFront + d * 0.5);
    return mesh;
  }

  /**
   * Builds a human-proportioned head (neck, sculpted cranium & jaw, ears, nose, expressive eyes & brows).
   * faceDir = -1 for player hero (running toward -Z), +1 for front-facing NPCs (+Z).
   */
  private buildHumanHead(
    skinMat: THREE.Material,
    hairMat: THREE.Material,
    faceDir: -1 | 1 = -1
  ): THREE.Group {
    const headGroup = new THREE.Group();
    const eyeWhiteMat = this.mat(0xfaf5ee, 0.35, 0.05);
    const pupilMat = this.mat(0x0f172a, 0.25, 0.1);
    const lipMat = this.mat(0x4a2417, 0.72, 0.02);

    // Tapered human neck
    const neck = new THREE.Mesh(
      this.geo('h_neck', () => new THREE.CylinderGeometry(0.058, 0.072, 0.14, 8)),
      skinMat
    );
    neck.position.set(0, -0.15, 0);
    headGroup.add(neck);

    // Sculpted cranium (slightly ovoid)
    const cranium = new THREE.Mesh(
      this.geo('h_cranium', () => new THREE.SphereGeometry(0.165, 12, 10)),
      skinMat
    );
    cranium.scale.set(0.92, 1.08, 0.98);
    cranium.castShadow = true;
    headGroup.add(cranium);

    // Lower jaw / chin contour
    const jaw = new THREE.Mesh(
      this.geo('h_jaw', () => new THREE.SphereGeometry(0.115, 10, 8)),
      skinMat
    );
    jaw.scale.set(0.92, 0.85, 0.92);
    jaw.position.set(0, -0.068, faceDir * 0.028);
    headGroup.add(jaw);

    // Ears
    const earGeo = this.geo('h_ear', () => new THREE.SphereGeometry(0.038, 6, 6));
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, skinMat);
      ear.scale.set(0.55, 1.15, 0.8);
      ear.position.set(sx * 0.148, -0.01, -faceDir * 0.01);
      headGroup.add(ear);
    }

    // Subtle nose bridge
    const nose = new THREE.Mesh(
      this.geo('h_nose', () => new THREE.CapsuleGeometry(0.016, 0.028, 3, 6)),
      skinMat
    );
    nose.rotation.x = faceDir * -0.22;
    nose.position.set(0, -0.015, faceDir * 0.156);
    headGroup.add(nose);

    // Expressive eyes + irises + eyebrows
    const scleraGeo = this.geo('h_sclera', () => new THREE.SphereGeometry(0.024, 6, 6));
    const pupilGeo = this.geo('h_pupil', () => new THREE.SphereGeometry(0.014, 6, 6));
    for (const sx of [-1, 1]) {
      const sclera = new THREE.Mesh(scleraGeo, eyeWhiteMat);
      sclera.scale.set(1.15, 0.82, 0.55);
      sclera.position.set(sx * 0.056, 0.022, faceDir * 0.144);
      headGroup.add(sclera);

      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.scale.set(1, 1, 0.65);
      pupil.position.set(sx * 0.056, 0.022, faceDir * 0.152);
      headGroup.add(pupil);

      const brow = new THREE.Mesh(this.boxGeo(0.048, 0.014, 0.018), hairMat);
      brow.rotation.z = sx * -0.08;
      brow.position.set(sx * 0.056, 0.054, faceDir * 0.146);
      headGroup.add(brow);
    }

    // Mouth / lips
    const mouth = new THREE.Mesh(
      this.geo('h_mouth', () => new THREE.CapsuleGeometry(0.01, 0.036, 3, 6)),
      lipMat
    );
    mouth.rotation.z = Math.PI / 2;
    mouth.position.set(0, -0.082, faceDir * 0.142);
    headGroup.add(mouth);

    return headGroup;
  }

  private createRunnerNameSprite(
    name: string,
    colorHex: string,
    textHex: string = '#FFFFFF'
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 72;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 72);
      // Dark outer pill for high contrast on any sky
      ctx.fillStyle = 'rgba(14, 11, 10, 0.86)';
      ctx.beginPath();
      ctx.roundRect(12, 10, 232, 52, 16);
      ctx.fill();

      // Player color border
      ctx.lineWidth = 6;
      ctx.strokeStyle = colorHex;
      ctx.stroke();

      // Colored indicator dot on left
      ctx.fillStyle = colorHex;
      ctx.beginPath();
      ctx.arc(38, 36, 10, 0, Math.PI * 2);
      ctx.fill();

      // Player name
      ctx.fillStyle = '#FAF5EE';
      ctx.font = '800 28px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = name.trim().slice(0, 11).toUpperCase() || 'JOUEUR';
      ctx.fillText(label, 140, 37, 165);
      void textHex;
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(tex);
    const mat = this.trackMat(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false,
      })
    );
    const sprite = new THREE.Sprite(mat);
    sprite.userData.uniqueTex = tex;
    sprite.userData.uniqueMat = mat;
    sprite.scale.set(2.05, 0.58, 1);
    sprite.renderOrder = 20;
    return sprite;
  }

  public createThief(
    characterId: CharacterId = 'didi',
    outfitId: OutfitId = 'base',
    playerBadge?: { name: string; colorHex: string; colorInt: number; textHex?: string }
  ): ThiefRig {
    const root = new THREE.Group();
    const bodyGroup = new THREE.Group();
    bodyGroup.position.y = 0.92;
    root.add(bodyGroup);

    const skinColor =
      characterId === 'awa'
        ? 0x5e341f
        : characterId === 'boss'
          ? 0x522d1a
          : characterId === 'policier'
            ? 0x58311d
            : 0x6b3e26;
    const skinMat = this.mat(skinColor, 0.72, 0.04);
    const goldMat = this.mat(0xfbbf24, 0.18, 0.9, 0x78350f, 0.16);
    const hairMat = this.mat(0x111827, 0.85, 0.05);
    const whiteMat = this.mat(0xfaf5ee, 0.55, 0.06);

    // Base outfit palette per character when outfitId === 'base'
    let shirtMat = this.mat(0xf59e0b, 0.76, 0.05);
    let pantsMat = this.mat(0x1e293b, 0.85, 0.05);
    let bagMat = this.mat(0x0284c7, 0.65, 0.08);
    const bagTrimMat = goldMat;
    let shoeMat = whiteMat;
    let soleMat = this.mat(0xdc2626, 0.75, 0.05);
    let fullLengthPants = false;

    if (outfitId === 'base') {
      if (characterId === 'awa') {
        shirtMat = this.mat(0xea580c, 0.74, 0.05);
        pantsMat = this.mat(0x0d9488, 0.76, 0.05);
        bagMat = this.mat(0xb45309, 0.78, 0.05);
      } else if (characterId === 'policier') {
        shirtMat = this.mat(0x1d4ed8, 0.68, 0.1);
        pantsMat = this.mat(0x172554, 0.75, 0.08);
        bagMat = this.mat(0x0f172a, 0.7, 0.15);
        shoeMat = this.mat(0x111827, 0.5, 0.15);
        soleMat = this.mat(0x334155, 0.8, 0.1);
        fullLengthPants = true;
      } else if (characterId === 'taximan') {
        shirtMat = this.mat(0x16a34a, 0.72, 0.06);
        pantsMat = this.mat(0x1e293b, 0.82, 0.05);
        bagMat = this.mat(0xfacc15, 0.55, 0.1);
        fullLengthPants = true;
      } else if (characterId === 'boss') {
        shirtMat = this.mat(0x18181b, 0.48, 0.14);
        pantsMat = this.mat(0x09090b, 0.52, 0.12);
        bagMat = this.mat(0x27272a, 0.45, 0.25);
        shoeMat = this.mat(0x18181b, 0.28, 0.3);
        soleMat = goldMat;
        fullLengthPants = true;
      } else if (characterId === 'taoruto_binks') {
        shirtMat = this.mat(0xea580c, 0.65, 0.08);
        pantsMat = this.mat(0x1e293b, 0.78, 0.06);
        bagMat = this.mat(0x0284c7, 0.55, 0.12);
        shoeMat = this.mat(0x0f172a, 0.55, 0.12);
        soleMat = this.mat(0x38bdf8, 0.45, 0.2);
        fullLengthPants = true;
      } else if (characterId === 'rikmaro') {
        shirtMat = this.mat(0x1e3a8a, 0.68, 0.1);
        pantsMat = this.mat(0x0f172a, 0.78, 0.08);
        bagMat = this.mat(0xdc2626, 0.6, 0.1);
        shoeMat = this.mat(0x111827, 0.5, 0.15);
        soleMat = this.mat(0xef4444, 0.5, 0.15);
        fullLengthPants = true;
      } else if (characterId === 'naruto_odg') {
        shirtMat = this.mat(0xf97316, 0.62, 0.08);
        pantsMat = this.mat(0x18181b, 0.72, 0.08);
        bagMat = this.mat(0xfacc15, 0.35, 0.5);
        shoeMat = this.mat(0x18181b, 0.5, 0.15);
        soleMat = this.mat(0xf97316, 0.55, 0.1);
        fullLengthPants = true;
      } else if (characterId === 'fils_korogho') {
        shirtMat = this.mat(0x991b1b, 0.58, 0.12);
        pantsMat = this.mat(0x1c1917, 0.7, 0.1);
        bagMat = goldMat;
        shoeMat = whiteMat;
        soleMat = goldMat;
        fullLengthPants = true;
      } else if (characterId === 'bill_late') {
        shirtMat = this.mat(0x1d4ed8, 0.45, 0.16);
        pantsMat = this.mat(0x111827, 0.55, 0.12);
        bagMat = this.mat(0x38bdf8, 0.35, 0.4);
        shoeMat = this.mat(0x0f172a, 0.3, 0.25);
        soleMat = this.mat(0x38bdf8, 0.3, 0.4);
        fullLengthPants = true;
      } else if (characterId === 'tomsi') {
        shirtMat = this.mat(0x7c3aed, 0.48, 0.18);
        pantsMat = this.mat(0x1e1b4b, 0.6, 0.14);
        bagMat = goldMat;
        shoeMat = this.mat(0xfacc15, 0.25, 0.65);
        soleMat = whiteMat;
        fullLengthPants = true;
      }
    } else if (outfitId === 'pdg_didi') {
      shirtMat = this.mat(0xf8fafc, 0.68, 0.05);
      pantsMat = this.mat(0xdc2626, 0.72, 0.06);
      bagMat = this.mat(0x18181b, 0.55, 0.15);
      shoeMat = this.mat(0xf8fafc, 0.45, 0.08);
      soleMat = this.mat(0xdc2626, 0.7, 0.06);
      fullLengthPants = true;
    } else if (outfitId === 'rood_woko') {
      shirtMat = this.mat(0xea580c, 0.76, 0.06);
      pantsMat = this.mat(0x0d9488, 0.78, 0.05);
      bagMat = this.mat(0x9a3412, 0.75, 0.06);
      shoeMat = this.mat(0x78350f, 0.6, 0.1);
      soleMat = goldMat;
      fullLengthPants = true;
    } else if (outfitId === 'police') {
      shirtMat = this.mat(0x1d4ed8, 0.65, 0.1);
      pantsMat = this.mat(0x172554, 0.75, 0.08);
      bagMat = this.mat(0x0f172a, 0.7, 0.12);
      shoeMat = this.mat(0x111827, 0.5, 0.15);
      soleMat = this.mat(0x475569, 0.8, 0.1);
      fullLengthPants = true;
    } else if (outfitId === 'etalons') {
      shirtMat = this.mat(0x15803d, 0.68, 0.06);
      pantsMat = this.mat(0x166534, 0.72, 0.06);
      bagMat = this.mat(0xdc2626, 0.65, 0.08);
      shoeMat = this.mat(0xfacc15, 0.45, 0.12);
      soleMat = this.mat(0x15803d, 0.7, 0.06);
    } else if (outfitId === 'tokbook_or') {
      shirtMat = goldMat;
      pantsMat = this.mat(0xd97706, 0.24, 0.82, 0x78350f, 0.12);
      bagMat = this.mat(0xfde047, 0.2, 0.88);
      shoeMat = goldMat;
      soleMat = whiteMat;
      fullLengthPants = true;
    }

    // Anatomical Human Torso (tapered chest + curved shoulders + waist)
    const isBoubou = outfitId === 'rood_woko';
    const isAwa = characterId === 'awa';
    const torsoScaleX = isBoubou ? 1.24 : isAwa ? 0.96 : characterId === 'boss' ? 1.15 : 1.08;

    const chest = new THREE.Mesh(
      this.geo('h_chest', () => new THREE.CylinderGeometry(0.21, 0.162, 0.48, 10)),
      shirtMat
    );
    chest.scale.set(torsoScaleX, 1, 0.68);
    chest.position.y = 0.08;
    chest.castShadow = true;
    bodyGroup.add(chest);

    const shoulderYoke = new THREE.Mesh(
      this.geo('h_yoke', () => new THREE.CapsuleGeometry(0.112, 0.24, 4, 8)),
      shirtMat
    );
    shoulderYoke.rotation.z = Math.PI / 2;
    shoulderYoke.scale.set(1, torsoScaleX * 0.95, 0.92);
    shoulderYoke.position.y = 0.255;
    shoulderYoke.castShadow = true;
    bodyGroup.add(shoulderYoke);

    // Outfit-specific anatomical torso accents
    if (outfitId === 'pdg_didi' || outfitId === 'tokbook_or') {
      const chain = new THREE.Mesh(
        this.geo('h_chain', () => new THREE.TorusGeometry(0.115, 0.018, 6, 14)),
        goldMat
      );
      chain.rotation.x = Math.PI / 2 + 0.35;
      chain.position.set(0, 0.32, -0.02);
      bodyGroup.add(chain);

      const pendant = new THREE.Mesh(
        this.geo('h_pendant', () => new THREE.OctahedronGeometry(0.048, 0)),
        goldMat
      );
      pendant.scale.set(1, 1.15, 0.45);
      pendant.position.set(0, 0.22, -0.145);
      bodyGroup.add(pendant);

      if (outfitId === 'pdg_didi') {
        const hood = new THREE.Mesh(
          this.geo('h_hood', () => new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.65)),
          shirtMat
        );
        hood.rotation.x = -0.65;
        hood.position.set(0, 0.34, 0.12);
        bodyGroup.add(hood);
      }
    } else if (outfitId === 'rood_woko') {
      const boubouTrim = new THREE.Mesh(
        this.geo('h_boubou_trim', () => new THREE.CylinderGeometry(0.11, 0.08, 0.38, 8)),
        goldMat
      );
      boubouTrim.scale.set(1, 1, 1.38);
      boubouTrim.position.set(0, 0.12, 0);
      bodyGroup.add(boubouTrim);

      const tunicLower = new THREE.Mesh(
        this.geo('h_tunic_skirt', () => new THREE.CylinderGeometry(0.21, 0.26, 0.34, 10)),
        shirtMat
      );
      tunicLower.scale.set(1.12, 1, 0.78);
      tunicLower.position.set(0, -0.21, 0);
      bodyGroup.add(tunicLower);
    } else if (outfitId === 'police' || (outfitId === 'base' && characterId === 'policier')) {
      const belt = new THREE.Mesh(
        this.geo('h_belt', () => new THREE.CylinderGeometry(0.18, 0.18, 0.065, 10)),
        whiteMat
      );
      belt.scale.set(1.12, 1, 0.74);
      belt.position.set(0, -0.14, 0);
      bodyGroup.add(belt);
      const badge = new THREE.Mesh(
        this.geo('h_badge', () => new THREE.CylinderGeometry(0.045, 0.045, 0.02, 6)),
        goldMat
      );
      badge.rotation.x = Math.PI / 2;
      badge.position.set(0.1, 0.2, -0.138);
      bodyGroup.add(badge);
    } else if (outfitId === 'etalons') {
      const redBand = new THREE.Mesh(
        this.geo('h_etalons_band', () => new THREE.CylinderGeometry(0.205, 0.19, 0.13, 10)),
        this.mat(0xdc2626, 0.65, 0.05)
      );
      redBand.scale.set(1.1, 1, 0.72);
      redBand.position.set(0, 0.16, 0);
      bodyGroup.add(redBand);
      const star = new THREE.Mesh(
        this.geo('h_star', () => new THREE.OctahedronGeometry(0.06, 0)),
        goldMat
      );
      star.scale.set(1, 1, 0.5);
      star.position.set(0, 0.16, -0.145);
      bodyGroup.add(star);
    } else if (outfitId === 'base' && (characterId === 'boss' || characterId === 'bill_late')) {
      const shirtV = new THREE.Mesh(
        this.geo('h_shirt_v', () => new THREE.CylinderGeometry(0.08, 0.01, 0.24, 4)),
        whiteMat
      );
      shirtV.position.set(0, 0.2, -0.13);
      bodyGroup.add(shirtV);
      const tie = new THREE.Mesh(
        this.boxGeo(0.055, 0.28, 0.03),
        characterId === 'bill_late' ? this.mat(0x38bdf8, 0.3, 0.5) : goldMat
      );
      tie.position.set(0, 0.14, -0.148);
      bodyGroup.add(tie);
    } else if (outfitId === 'base' && characterId === 'rikmaro') {
      const scarf = new THREE.Mesh(
        this.geo('h_scarf_collar', () => new THREE.TorusGeometry(0.16, 0.045, 6, 14)),
        this.mat(0xef4444, 0.68, 0.05)
      );
      scarf.rotation.x = Math.PI / 2 + 0.15;
      scarf.position.set(0, 0.34, 0);
      bodyGroup.add(scarf);
    } else if (outfitId === 'base' && (characterId === 'fils_korogho' || characterId === 'tomsi')) {
      const chain = new THREE.Mesh(
        this.geo('h_chain', () => new THREE.TorusGeometry(0.115, 0.018, 6, 14)),
        goldMat
      );
      chain.rotation.x = Math.PI / 2 + 0.35;
      chain.position.set(0, 0.32, -0.02);
      bodyGroup.add(chain);
      const pendant = new THREE.Mesh(
        this.geo('h_pendant', () => new THREE.OctahedronGeometry(0.048, 0)),
        goldMat
      );
      pendant.scale.set(1, 1.15, 0.45);
      pendant.position.set(0, 0.22, -0.145);
      bodyGroup.add(pendant);
    }

    // Ergonomic Rounded Backpack + Shoulder Straps (+Z faces chase camera)
    const backpack = new THREE.Mesh(
      this.geo('h_backpack', () => new THREE.CapsuleGeometry(0.145, 0.18, 4, 10)),
      bagMat
    );
    backpack.scale.set(1.15, 1, 0.62);
    backpack.position.set(0, 0.11, 0.18);
    backpack.castShadow = true;
    bodyGroup.add(backpack);

    const bagPocket = new THREE.Mesh(
      this.geo('h_bag_pocket', () => new THREE.CapsuleGeometry(0.095, 0.06, 4, 8)),
      bagTrimMat
    );
    bagPocket.scale.set(1.15, 0.9, 0.52);
    bagPocket.position.set(0, 0.02, 0.26);
    bodyGroup.add(bagPocket);

    const strapGeo = this.geo('h_strap', () => new THREE.BoxGeometry(0.05, 0.4, 0.26));
    for (const sx of [-0.14, 0.14]) {
      const strap = new THREE.Mesh(strapGeo, bagMat);
      strap.position.set(sx, 0.15, 0.04);
      bodyGroup.add(strap);
    }

    // Human Head + Face + Character Headwear
    const headGroup = this.buildHumanHead(skinMat, hairMat, -1);
    headGroup.position.set(0, 0.56, 0);
    bodyGroup.add(headGroup);

    // Subtle Hair Cap under headwear
    const hairCap = new THREE.Mesh(
      this.geo('h_hair_cap', () => new THREE.SphereGeometry(0.168, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)),
      hairMat
    );
    hairCap.scale.set(0.94, 1.05, 1.0);
    hairCap.position.set(0, 0.015, 0.01);
    headGroup.add(hairCap);

    if (characterId === 'awa') {
      const wrapColor = outfitId === 'tokbook_or' ? 0xfbbf24 : 0xea580c;
      const wrapMat = this.mat(wrapColor, 0.65, outfitId === 'tokbook_or' ? 0.7 : 0.06);
      const headWrap = new THREE.Mesh(
        this.geo('h_awa_wrap', () => new THREE.SphereGeometry(0.182, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58)),
        wrapMat
      );
      headWrap.scale.set(0.98, 1.05, 1.02);
      headWrap.position.set(0, 0.04, 0.015);
      headWrap.rotation.x = 0.18;
      headGroup.add(headWrap);

      const wrapBand = new THREE.Mesh(
        this.geo('h_awa_band', () => new THREE.TorusGeometry(0.155, 0.036, 6, 14)),
        goldMat
      );
      wrapBand.rotation.x = Math.PI / 2 + 0.18;
      wrapBand.position.set(0, 0.085, 0.01);
      headGroup.add(wrapBand);

      const wrapKnot = new THREE.Mesh(
        this.geo('h_awa_knot', () => new THREE.SphereGeometry(0.075, 8, 6)),
        wrapMat
      );
      wrapKnot.position.set(0, 0.21, 0.05);
      headGroup.add(wrapKnot);
    } else if (characterId === 'policier' || outfitId === 'police') {
      const capDome = new THREE.Mesh(
        this.geo('h_police_cap', () => new THREE.CylinderGeometry(0.195, 0.168, 0.13, 12)),
        this.mat(0x1d4ed8, 0.45, 0.15)
      );
      capDome.position.set(0, 0.16, 0);
      headGroup.add(capDome);

      const capBand = new THREE.Mesh(
        this.geo('h_police_band', () => new THREE.CylinderGeometry(0.172, 0.172, 0.045, 12)),
        whiteMat
      );
      capBand.position.set(0, 0.105, 0);
      headGroup.add(capBand);

      const capVisor = new THREE.Mesh(
        this.geo('h_visor', () => new THREE.CylinderGeometry(0.22, 0.22, 0.026, 10, 1, false, Math.PI * 0.72, Math.PI * 0.56)),
        this.mat(0x0f172a, 0.28, 0.3)
      );
      capVisor.position.set(0, 0.085, -0.045);
      capVisor.rotation.x = 0.2;
      headGroup.add(capVisor);
    } else if (characterId === 'taximan') {
      const taxiCapMat = this.mat(0x16a34a, 0.5, 0.1);
      const capCrown = new THREE.Mesh(
        this.geo('h_cap_dome', () => new THREE.SphereGeometry(0.176, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52)),
        taxiCapMat
      );
      capCrown.position.set(0, 0.04, 0);
      headGroup.add(capCrown);

      const capVisor = new THREE.Mesh(
        this.geo('h_visor', () => new THREE.CylinderGeometry(0.22, 0.22, 0.026, 10, 1, false, Math.PI * 0.72, Math.PI * 0.56)),
        taxiCapMat
      );
      capVisor.position.set(0, 0.065, -0.045);
      capVisor.rotation.x = 0.16;
      headGroup.add(capVisor);

      const taxiSign = new THREE.Mesh(this.boxGeo(0.1, 0.055, 0.03), goldMat);
      taxiSign.position.set(0, 0.145, -0.155);
      headGroup.add(taxiSign);
    } else if (characterId === 'boss') {
      const fadeTop = new THREE.Mesh(
        this.geo('h_boss_hair', () => new THREE.CylinderGeometry(0.15, 0.16, 0.075, 10)),
        hairMat
      );
      fadeTop.position.set(0, 0.155, 0);
      headGroup.add(fadeTop);

      const shades = new THREE.Mesh(
        this.boxGeo(0.24, 0.062, 0.05),
        this.mat(0x09090b, 0.1, 0.65)
      );
      shades.position.set(0, 0.022, -0.155);
      headGroup.add(shades);

      const frame = new THREE.Mesh(this.boxGeo(0.255, 0.018, 0.055), goldMat);
      frame.position.set(0, 0.052, -0.155);
      headGroup.add(frame);
    } else if (characterId === 'taoruto_binks' || characterId === 'naruto_odg') {
      const isOdg = characterId === 'naruto_odg';
      const spikyHair = new THREE.Mesh(
        this.geo('h_ninja_hair', () => new THREE.ConeGeometry(0.185, 0.2, 7)),
        isOdg ? goldMat : this.mat(0xfacc15, 0.55, 0.15)
      );
      spikyHair.position.set(0, 0.15, 0.01);
      headGroup.add(spikyHair);

      const headband = new THREE.Mesh(
        this.geo('h_ninja_band', () => new THREE.CylinderGeometry(0.175, 0.175, 0.055, 12)),
        this.mat(isOdg ? 0x18181b : 0x0284c7, 0.5, 0.2)
      );
      headband.position.set(0, 0.085, 0);
      headGroup.add(headband);

      const plate = new THREE.Mesh(
        this.boxGeo(0.13, 0.048, 0.03),
        isOdg ? goldMat : this.mat(0xe2e8f0, 0.2, 0.85)
      );
      plate.position.set(0, 0.085, -0.168);
      headGroup.add(plate);
    } else if (characterId === 'rikmaro') {
      const ninjaBand = new THREE.Mesh(
        this.geo('h_ninja_band', () => new THREE.CylinderGeometry(0.175, 0.175, 0.055, 12)),
        this.mat(0xef4444, 0.55, 0.1)
      );
      ninjaBand.position.set(0, 0.085, 0);
      headGroup.add(ninjaBand);

      const topHair = new THREE.Mesh(
        this.geo('h_boss_hair', () => new THREE.CylinderGeometry(0.15, 0.16, 0.075, 10)),
        hairMat
      );
      topHair.position.set(0, 0.155, 0);
      headGroup.add(topHair);
    } else if (characterId === 'fils_korogho') {
      const capMat = this.mat(0x991b1b, 0.5, 0.12);
      const capCrown = new THREE.Mesh(
        this.geo('h_cap_dome', () => new THREE.SphereGeometry(0.176, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52)),
        capMat
      );
      capCrown.position.set(0, 0.04, 0);
      headGroup.add(capCrown);

      const capVisor = new THREE.Mesh(
        this.geo('h_visor', () => new THREE.CylinderGeometry(0.22, 0.22, 0.026, 10, 1, false, Math.PI * 0.72, Math.PI * 0.56)),
        goldMat
      );
      capVisor.position.set(0, 0.065, -0.045);
      capVisor.rotation.x = 0.16;
      headGroup.add(capVisor);
    } else if (characterId === 'bill_late') {
      const fadeTop = new THREE.Mesh(
        this.geo('h_boss_hair', () => new THREE.CylinderGeometry(0.15, 0.16, 0.075, 10)),
        hairMat
      );
      fadeTop.position.set(0, 0.155, 0);
      headGroup.add(fadeTop);

      const techGlasses = new THREE.Mesh(
        this.boxGeo(0.24, 0.056, 0.05),
        this.mat(0x38bdf8, 0.15, 0.75)
      );
      techGlasses.position.set(0, 0.022, -0.155);
      headGroup.add(techGlasses);
    } else if (characterId === 'tomsi') {
      const crownMat = goldMat;
      const crownBand = new THREE.Mesh(
        this.geo('h_ninja_band', () => new THREE.CylinderGeometry(0.175, 0.175, 0.055, 12)),
        crownMat
      );
      crownBand.position.set(0, 0.115, 0);
      headGroup.add(crownBand);

      const crest = new THREE.Mesh(
        this.geo('h_star', () => new THREE.OctahedronGeometry(0.06, 0)),
        this.mat(0x7c3aed, 0.25, 0.6)
      );
      crest.position.set(0, 0.145, -0.165);
      headGroup.add(crest);
    } else {
      // DIDI: Rounded curved red baseball cap
      const capMat = outfitId === 'tokbook_or' ? goldMat : this.mat(0xdc2626, 0.55, 0.06);
      const capCrown = new THREE.Mesh(
        this.geo('h_cap_dome', () => new THREE.SphereGeometry(0.176, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52)),
        capMat
      );
      capCrown.position.set(0, 0.04, 0);
      headGroup.add(capCrown);

      const capVisor = new THREE.Mesh(
        this.geo('h_visor', () => new THREE.CylinderGeometry(0.22, 0.22, 0.026, 10, 1, false, Math.PI * 0.72, Math.PI * 0.56)),
        capMat
      );
      capVisor.position.set(0, 0.065, -0.045);
      capVisor.rotation.x = 0.16;
      headGroup.add(capVisor);
    }

    // Rounded Pelvis / Shorts / Pagne Waist
    const hips = new THREE.Mesh(
      this.geo(
        isAwa ? 'h_hips_awa' : 'h_hips',
        () => new THREE.CylinderGeometry(isAwa ? 0.175 : 0.168, isAwa ? 0.235 : 0.18, isAwa ? 0.28 : 0.18, 10)
      ),
      pantsMat
    );
    hips.scale.set(1.12, 1, 0.74);
    hips.position.y = isAwa ? -0.25 : -0.22;
    bodyGroup.add(hips);

    if (isAwa) {
      const pagneTrim = new THREE.Mesh(
        this.geo('h_pagne_trim', () => new THREE.CylinderGeometry(0.228, 0.242, 0.065, 10)),
        this.mat(0xfacc15, 0.6, 0.08)
      );
      pagneTrim.scale.set(1.12, 1, 0.75);
      pagneTrim.position.y = -0.36;
      bodyGroup.add(pagneTrim);
    }

    // Articulated Human Arms (Shoulder -> Upper Arm -> Elbow -> Forearm -> Hand)
    const sleeveLong =
      outfitId === 'pdg_didi' ||
      outfitId === 'rood_woko' ||
      outfitId === 'tokbook_or' ||
      (outfitId === 'base' &&
        (characterId === 'boss' ||
          characterId === 'taoruto_binks' ||
          characterId === 'rikmaro' ||
          characterId === 'naruto_odg' ||
          characterId === 'fils_korogho' ||
          characterId === 'bill_late' ||
          characterId === 'tomsi'));

    const shoulderBallGeo = this.geo('h_shoulder_ball', () => new THREE.SphereGeometry(0.064, 8, 6));
    const upperArmGeo = this.geo('h_upper_arm', () => new THREE.CapsuleGeometry(0.05, 0.135, 4, 8));
    const elbowGeo = this.geo('h_elbow_ball', () => new THREE.SphereGeometry(0.046, 6, 6));
    const forearmGeo = this.geo('h_forearm', () => new THREE.CapsuleGeometry(0.042, 0.135, 4, 8));
    const handGeo = this.geo('h_hand', () => new THREE.SphereGeometry(0.048, 8, 6));

    const makeArm = (side: -1 | 1): { armPivot: THREE.Group; forearmPivot: THREE.Group } => {
      const armPivot = new THREE.Group();
      armPivot.position.set(side * (isBoubou ? 0.31 : 0.275), 0.27, 0);

      const shoulder = new THREE.Mesh(shoulderBallGeo, shirtMat);
      armPivot.add(shoulder);

      const upperArm = new THREE.Mesh(upperArmGeo, shirtMat);
      upperArm.position.y = -0.11;
      armPivot.add(upperArm);

      const forearmPivot = new THREE.Group();
      forearmPivot.position.set(0, -0.22, 0);

      const elbow = new THREE.Mesh(elbowGeo, sleeveLong ? shirtMat : skinMat);
      forearmPivot.add(elbow);

      const forearm = new THREE.Mesh(forearmGeo, sleeveLong ? shirtMat : skinMat);
      forearm.position.y = -0.105;
      forearmPivot.add(forearm);

      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.scale.set(0.82, 1.18, 0.72);
      hand.position.set(0, -0.225, -0.01);
      forearmPivot.add(hand);

      armPivot.add(forearmPivot);
      bodyGroup.add(armPivot);
      return { armPivot, forearmPivot };
    };

    const leftArmRig = makeArm(-1);
    const rightArmRig = makeArm(1);

    // Articulated Human Legs (Hip -> Thigh -> Knee -> Calf -> Sneaker)
    // Total drop from hipPivot (-0.26) to sole bottom (-0.66) = -0.92 => grounded at y = 0!
    const hipBallGeo = this.geo('h_hip_ball', () => new THREE.SphereGeometry(0.072, 8, 6));
    const thighGeo = this.geo('h_thigh', () => new THREE.CapsuleGeometry(0.068, 0.15, 4, 8));
    const kneeGeo = this.geo('h_knee_ball', () => new THREE.SphereGeometry(0.056, 6, 6));
    const calfGeo = this.geo('h_calf', () => new THREE.CapsuleGeometry(0.054, 0.16, 4, 8));
    const shoeUpperGeo = this.geo('h_shoe_upper', () => new THREE.CapsuleGeometry(0.064, 0.12, 4, 8));
    const shoeSoleGeo = this.geo('h_shoe_sole', () => new THREE.CapsuleGeometry(0.068, 0.14, 4, 8));

    const makeLeg = (side: -1 | 1): { legPivot: THREE.Group; kneePivot: THREE.Group } => {
      const legPivot = new THREE.Group();
      legPivot.position.set(side * 0.118, -0.26, 0);

      const hip = new THREE.Mesh(hipBallGeo, pantsMat);
      legPivot.add(hip);

      const thigh = new THREE.Mesh(thighGeo, pantsMat);
      thigh.position.y = -0.135;
      legPivot.add(thigh);

      const kneePivot = new THREE.Group();
      kneePivot.position.set(0, -0.275, 0);

      const knee = new THREE.Mesh(kneeGeo, fullLengthPants ? pantsMat : skinMat);
      kneePivot.add(knee);

      const calf = new THREE.Mesh(calfGeo, fullLengthPants ? pantsMat : skinMat);
      calf.position.y = -0.135;
      kneePivot.add(calf);

      // Sculpted rounded sneaker facing -Z
      const shoeUpper = new THREE.Mesh(shoeUpperGeo, shoeMat);
      shoeUpper.rotation.x = Math.PI / 2;
      shoeUpper.scale.set(1.05, 1.0, 0.72);
      shoeUpper.position.set(0, -0.31, -0.05);
      kneePivot.add(shoeUpper);

      const sole = new THREE.Mesh(shoeSoleGeo, soleMat);
      sole.rotation.x = Math.PI / 2;
      sole.scale.set(1.1, 1.04, 0.35);
      sole.position.set(0, -0.36, -0.05);
      kneePivot.add(sole);

      legPivot.add(kneePivot);
      bodyGroup.add(legPivot);
      return { legPivot, kneePivot };
    };

    const leftLegRig = makeLeg(-1);
    const rightLegRig = makeLeg(1);

    // Grigri protective shield bubble
    const shieldBubble = new THREE.Mesh(
      this.geo('h_shield_bubble', () => new THREE.SphereGeometry(1.05, 14, 10)),
      this.trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.24,
          wireframe: true,
        })
      )
    );
    shieldBubble.position.y = 0.95;
    shieldBubble.visible = false;
    root.add(shieldBubble);

    // Turbo aura cone
    const turboFlame = new THREE.Mesh(
      this.geo('h_turbo_flame', () => new THREE.ConeGeometry(0.55, 1.35, 8)),
      this.trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xf97316,
          transparent: true,
          opacity: 0.45,
        })
      )
    );
    turboFlame.rotation.x = Math.PI / 2;
    turboFlame.position.set(0, 0.9, 0.72);
    turboFlame.visible = false;
    root.add(turboFlame);

    const shadow = this.createShadowPlane(1.15, 1.15);
    root.add(shadow);

    const uniqueMats: THREE.Material[] = [
      shieldBubble.material as THREE.Material,
      turboFlame.material as THREE.Material,
    ];
    const uniqueTexs: THREE.Texture[] = [];

    if (playerBadge) {
      const ringMat = this.trackMat(
        new THREE.MeshBasicMaterial({
          color: playerBadge.colorInt,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92,
        })
      );
      uniqueMats.push(ringMat);
      const colorRing = new THREE.Mesh(
        this.geo('mp_player_ring', () => {
          const g = new THREE.RingGeometry(0.56, 0.78, 24);
          g.rotateX(-Math.PI / 2);
          return g;
        }),
        ringMat
      );
      colorRing.position.y = 0.04;
      root.add(colorRing);

      // Colored chest/shoulder sash band so color is clear even mid-air
      const sashMat = this.mat(playerBadge.colorInt, 0.35, 0.15, playerBadge.colorInt, 0.22);
      const sash = new THREE.Mesh(
        this.geo('mp_player_sash', () => new THREE.CylinderGeometry(0.24, 0.23, 0.09, 12)),
        sashMat
      );
      sash.position.set(0, 0.25, 0);
      bodyGroup.add(sash);

      const nameSprite = this.createRunnerNameSprite(
        playerBadge.name,
        playerBadge.colorHex,
        playerBadge.textHex
      );
      if (nameSprite.userData.uniqueMat) {
        uniqueMats.push(nameSprite.userData.uniqueMat as THREE.Material);
      }
      if (nameSprite.userData.uniqueTex) {
        uniqueTexs.push(nameSprite.userData.uniqueTex as THREE.Texture);
      }
      nameSprite.position.set(0, 2.38, 0);
      root.add(nameSprite);
    }

    const disposeUnique = () => {
      for (const m of uniqueMats) {
        m.dispose();
        const idx = this.materials.indexOf(m);
        if (idx >= 0) this.materials.splice(idx, 1);
      }
      for (const t of uniqueTexs) {
        t.dispose();
        const idx = this.textures.indexOf(t);
        if (idx >= 0) this.textures.splice(idx, 1);
      }
      uniqueMats.length = 0;
      uniqueTexs.length = 0;
    };

    return {
      root,
      bodyGroup,
      headGroup,
      leftArm: leftArmRig.armPivot,
      rightArm: rightArmRig.armPivot,
      leftForearm: leftArmRig.forearmPivot,
      rightForearm: rightArmRig.forearmPivot,
      leftLeg: leftLegRig.legPivot,
      rightLeg: rightLegRig.legPivot,
      leftKnee: leftLegRig.kneePivot,
      rightKnee: rightLegRig.kneePivot,
      shieldBubble,
      turboFlame,
      shadow,
      disposeUnique,
    };
  }

  public createPoliceMoto(): PoliceRig {
    const root = new THREE.Group();

    const blueMotoMat = this.mat(0x1d4ed8, 0.35, 0.45);
    const navyMat = this.mat(0x172554, 0.75, 0.08);
    const chromeMat = this.mat(0xd1d5db, 0.22, 0.85);
    const tireMat = this.mat(0x111827, 0.88, 0.05);
    const skinMat = this.mat(0x5c3621, 0.72, 0.05);
    const hairMat = this.mat(0x111827, 0.85, 0.05);
    const helmetMat = this.mat(0xf8fafc, 0.28, 0.2);
    const visorMat = this.mat(0x0f172a, 0.12, 0.65);

    // Rounded Tires + Chrome Rims
    const wheelGeo = this.geo('pm_wheel', () => {
      const g = new THREE.CylinderGeometry(0.32, 0.32, 0.16, 12);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const rimGeo = this.geo('pm_rim', () => {
      const g = new THREE.CylinderGeometry(0.18, 0.18, 0.175, 10);
      g.rotateZ(Math.PI / 2);
      return g;
    });

    const frontWheel = new THREE.Mesh(wheelGeo, tireMat);
    frontWheel.position.set(0, 0.32, -0.68);
    frontWheel.add(new THREE.Mesh(rimGeo, chromeMat));
    root.add(frontWheel);

    const rearWheel = new THREE.Mesh(wheelGeo, tireMat);
    rearWheel.position.set(0, 0.32, 0.65);
    rearWheel.add(new THREE.Mesh(rimGeo, chromeMat));
    root.add(rearWheel);

    // Sculpted Motorcycle Tank / Fairing
    const chassis = new THREE.Mesh(
      this.geo('pm_chassis', () => new THREE.CapsuleGeometry(0.22, 0.95, 4, 10)),
      blueMotoMat
    );
    chassis.rotation.x = Math.PI / 2;
    chassis.scale.set(1.05, 1, 0.85);
    chassis.position.set(0, 0.56, 0);
    chassis.castShadow = true;
    root.add(chassis);

    const frontShield = new THREE.Mesh(
      this.geo('pm_shield', () => new THREE.CapsuleGeometry(0.22, 0.32, 4, 8)),
      blueMotoMat
    );
    frontShield.scale.set(1.12, 1, 0.58);
    frontShield.position.set(0, 0.86, -0.52);
    frontShield.rotation.x = 0.28;
    root.add(frontShield);

    // Twin chrome exhausts
    const exhaustGeo = this.geo('pm_exhaust', () => {
      const g = new THREE.CylinderGeometry(0.045, 0.055, 0.85, 8);
      g.rotateX(Math.PI / 2);
      return g;
    });
    for (const sx of [-0.2, 0.2]) {
      const ex = new THREE.Mesh(exhaustGeo, chromeMat);
      ex.position.set(sx, 0.36, 0.45);
      root.add(ex);
    }

    // Handlebars & Fork
    const fork = new THREE.Mesh(
      this.geo('pm_fork', () => new THREE.CylinderGeometry(0.045, 0.045, 0.64, 8)),
      chromeMat
    );
    fork.position.set(0, 0.65, -0.58);
    fork.rotation.x = 0.22;
    root.add(fork);

    const handleBar = new THREE.Mesh(
      this.geo('pm_hbar', () => {
        const g = new THREE.CylinderGeometry(0.028, 0.028, 0.78, 8);
        g.rotateZ(Math.PI / 2);
        return g;
      }),
      chromeMat
    );
    handleBar.position.set(0, 1.06, -0.45);
    root.add(handleBar);

    // Circular glowing Headlight (forward -Z)
    const headlight = new THREE.Mesh(
      this.geo('pm_hl', () => {
        const g = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 10);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      this.mat(0xfef08a, 0.2, 0.1, 0xfde047, 1.6)
    );
    headlight.position.set(0, 0.86, -0.68);
    root.add(headlight);

    // Rear Siren Mast + Rounded Alternating Red/Blue Beacons
    const pole = new THREE.Mesh(
      this.geo('pm_pole', () => new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6)),
      chromeMat
    );
    pole.position.set(0, 0.98, 0.68);
    root.add(pole);

    const redBeaconMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    this.trackMat(redBeaconMat);

    const blueBeaconMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x3b82f6,
      emissiveIntensity: 0.4,
      roughness: 0.2,
    });
    this.trackMat(blueBeaconMat);

    const beaconGeo = this.geo('pm_beacon', () => new THREE.SphereGeometry(0.085, 8, 6));
    const redBeacon = new THREE.Mesh(beaconGeo, redBeaconMat);
    redBeacon.position.set(-0.1, 1.28, 0.68);
    root.add(redBeacon);

    const blueBeacon = new THREE.Mesh(beaconGeo, blueBeaconMat);
    blueBeacon.position.set(0.1, 1.28, 0.68);
    root.add(blueBeacon);

    // Human Police Officer Seated & Leaning Forward Gripping Handlebars
    const officerTorso = new THREE.Mesh(
      this.geo('pm_torso', () => new THREE.CylinderGeometry(0.21, 0.17, 0.5, 10)),
      navyMat
    );
    officerTorso.scale.set(1.12, 1, 0.72);
    officerTorso.position.set(0, 1.07, 0.12);
    officerTorso.rotation.x = -0.28;
    officerTorso.castShadow = true;
    root.add(officerTorso);

    const shoulderYoke = new THREE.Mesh(
      this.geo('h_yoke', () => new THREE.CapsuleGeometry(0.112, 0.24, 4, 8)),
      navyMat
    );
    shoulderYoke.rotation.z = Math.PI / 2;
    shoulderYoke.position.set(0, 1.25, 0.05);
    root.add(shoulderYoke);

    const belt = new THREE.Mesh(
      this.geo('pm_belt', () => new THREE.CylinderGeometry(0.18, 0.18, 0.07, 10)),
      helmetMat
    );
    belt.scale.set(1.12, 1, 0.75);
    belt.position.set(0, 0.88, 0.16);
    root.add(belt);

    // Arms reaching forward to handlebars
    const armGeo = this.geo('pm_arm', () => new THREE.CapsuleGeometry(0.048, 0.34, 4, 8));
    const gloveGeo = this.geo('pm_glove', () => new THREE.SphereGeometry(0.052, 8, 6));
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, navyMat);
      arm.position.set(sx * 0.3, 1.15, -0.2);
      arm.rotation.x = 1.15;
      arm.rotation.z = sx * -0.18;
      root.add(arm);

      const glove = new THREE.Mesh(gloveGeo, tireMat);
      glove.position.set(sx * 0.35, 1.06, -0.44);
      root.add(glove);
    }

    // Seated legs straddling chassis
    const legGeo = this.geo('pm_leg', () => new THREE.CapsuleGeometry(0.068, 0.34, 4, 8));
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, navyMat);
      leg.position.set(sx * 0.22, 0.66, 0.05);
      leg.rotation.x = 0.55;
      root.add(leg);
    }

    // Human Officer Head + Rounded White Moto Helmet + Tinted Visor
    const officerHead = this.buildHumanHead(skinMat, hairMat, -1);
    officerHead.position.set(0, 1.48, -0.02);
    root.add(officerHead);

    const helmetShell = new THREE.Mesh(
      this.geo('pm_helmet', () => new THREE.SphereGeometry(0.185, 12, 10)),
      helmetMat
    );
    helmetShell.scale.set(0.96, 1.02, 1.08);
    helmetShell.position.set(0, 0.04, 0.01);
    officerHead.add(helmetShell);

    const visor = new THREE.Mesh(
      this.geo('pm_visor', () => new THREE.CylinderGeometry(0.182, 0.182, 0.09, 10, 1, false, Math.PI * 0.65, Math.PI * 0.7)),
      visorMat
    );
    visor.position.set(0, 0.02, -0.01);
    officerHead.add(visor);

    const sirenGlowMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        map: this.headlightPoolTexture,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    const sirenGlow = new THREE.Mesh(
      this.geo('pm_siren_glow', () => new THREE.PlaneGeometry(3.2, 3.6)),
      sirenGlowMat
    );
    sirenGlow.rotation.x = -Math.PI / 2;
    sirenGlow.position.set(0, 0.035, 0.35);
    root.add(sirenGlow);

    const shadow = this.createShadowPlane(1.4, 2.0);
    root.add(shadow);

    return {
      root,
      frontWheel,
      rearWheel,
      redBeaconMat,
      blueBeaconMat,
      sirenGlowMat,
      shadow,
    };
  }

  public createObstacleGroup(kind: ObstacleKind): THREE.Group {
    const g = new THREE.Group();

    switch (kind) {
      case 'TRAIN_ROUGE':
      case 'TRAIN_BLEU': {
        const isRed = kind === 'TRAIN_ROUGE';
        const bodyMat = this.mat(isRed ? 0xef4444 : 0x2563eb, 0.34, 0.38);
        const stripeMat = this.mat(isRed ? 0xfacc15 : 0xf8fafc, 0.38, 0.16);
        const roofMat = this.mat(0xcbd5e1, 0.42, 0.5);
        const glassMat = this.mat(0x0f172a, 0.1, 0.55);
        const bogieMat = this.mat(0x1f2937, 0.85, 0.25);
        const wheelSteelMat = this.mat(0x94a3b8, 0.28, 0.82);
        const lampMat = this.mat(0xfef08a, 0.16, 0.1, 0xfde047, 2.4);
        const beaconMat = this.mat(0xf97316, 0.2, 0.1, 0xf97316, 1.8);
        const tailMat = this.mat(0xdc2626, 0.25, 0.1, 0xef4444, 1.3);

        // Main Locomotive & Car Body (14m long)
        const body = new THREE.Mesh(
          this.geo('train_body', () => new THREE.BoxGeometry(2.05, 2.75, 13.4)),
          bodyMat
        );
        body.position.set(0, 1.88, -0.3);
        body.castShadow = true;
        g.add(body);

        // Sculpted Sloped Aerodynamic Nose facing player (+Z)
        const noseLower = new THREE.Mesh(
          this.geo('train_nose_low', () => new THREE.BoxGeometry(2.02, 1.15, 0.95)),
          bodyMat
        );
        noseLower.position.set(0, 1.1, 6.65);
        g.add(noseLower);

        const noseUpper = new THREE.Mesh(
          this.geo('train_nose_up', () => new THREE.BoxGeometry(1.94, 1.35, 0.72)),
          bodyMat
        );
        noseUpper.position.set(0, 2.32, 6.45);
        noseUpper.rotation.x = 0.22;
        g.add(noseUpper);

        // Front Cowcatcher / Rail Plow + Bumper
        const bumper = new THREE.Mesh(
          this.geo('train_bumper', () => new THREE.BoxGeometry(2.16, 0.48, 0.56)),
          stripeMat
        );
        bumper.position.set(0, 0.54, 7.0);
        g.add(bumper);

        // Racing Stripe along sides & front
        const stripe = new THREE.Mesh(
          this.geo('train_stripe', () => new THREE.BoxGeometry(2.09, 0.32, 14.0)),
          stripeMat
        );
        stripe.position.set(0, 1.34, 0.05);
        g.add(stripe);

        // Recessed Front Cab Windshield facing player (+Z)
        const windshield = new THREE.Mesh(
          this.geo('train_windshield', () => new THREE.BoxGeometry(1.7, 0.86, 0.12)),
          glassMat
        );
        windshield.position.set(0, 2.38, 6.82);
        windshield.rotation.x = 0.22;
        g.add(windshield);

        // Twin Glowing Headlights + Top Beacon + Rear Red Tail Lamps
        for (const sx of [-0.64, 0.64]) {
          const headlight = new THREE.Mesh(
            this.geo('train_hl', () => {
              const cg = new THREE.CylinderGeometry(0.18, 0.18, 0.14, 10);
              cg.rotateX(Math.PI / 2);
              return cg;
            }),
            lampMat
          );
          headlight.position.set(sx, 1.34, 7.08);
          g.add(headlight);

          const tail = new THREE.Mesh(this.boxGeo(0.26, 0.18, 0.1), tailMat);
          tail.position.set(sx, 1.15, -7.02);
          g.add(tail);
        }
        const topBeacon = new THREE.Mesh(this.boxGeo(0.46, 0.2, 0.22), beaconMat);
        topBeacon.position.set(0, 3.25, 6.6);
        g.add(topBeacon);

        // Side Windows strip + Corrugated Roof Pods
        const sideWindows = new THREE.Mesh(
          this.geo('train_side_win', () => new THREE.BoxGeometry(2.08, 0.72, 11.4)),
          glassMat
        );
        sideWindows.position.set(0, 2.34, -0.2);
        g.add(sideWindows);

        const roof = new THREE.Mesh(
          this.geo('train_roof', () => new THREE.BoxGeometry(1.68, 0.26, 13.0)),
          roofMat
        );
        roof.position.set(0, 3.36, -0.2);
        g.add(roof);

        for (const az of [-3.6, 0.4, 4.2]) {
          const acPod = new THREE.Mesh(this.boxGeo(1.18, 0.2, 1.6), bogieMat);
          acPod.position.set(0, 3.55, az);
          g.add(acPod);
        }

        // Bogies + Spinning Steel Railway Wheels
        const bogie = new THREE.Mesh(
          this.geo('train_bogie', () => new THREE.BoxGeometry(1.62, 0.38, 13.0)),
          bogieMat
        );
        bogie.position.y = 0.3;
        g.add(bogie);

        const trainWheelGeo = this.geo('train_wheel', () => {
          const wg = new THREE.CylinderGeometry(0.32, 0.32, 0.16, 12);
          wg.rotateZ(Math.PI / 2);
          return wg;
        });
        const wheels: THREE.Object3D[] = [];
        for (const wz of [-5.2, -3.9, 3.9, 5.2]) {
          for (const wx of [-0.82, 0.82]) {
            const w = new THREE.Mesh(trainWheelGeo, wheelSteelMat);
            w.position.set(wx, 0.32, wz);
            g.add(w);
            wheels.push(w);
          }
        }
        g.userData.wheels = wheels;

        g.add(this.createShadowPlane(2.4, 14.5));
        g.add(this.createHeadlightPool(2.2, 5.2, 7.0));
        break;
      }

      case 'BUS': {
        const greenBus = this.mat(0x16a34a, 0.38, 0.24);
        const creamMat = this.mat(0xfef3c7, 0.48, 0.1);
        const yellowStripe = this.mat(0xfacc15, 0.42, 0.15);
        const glassMat = this.mat(0x1e293b, 0.12, 0.55);
        const chromeMat = this.mat(0xd1d5db, 0.24, 0.85);
        const tireMat = this.mat(0x111827, 0.88, 0.05);
        const lampMat = this.mat(0xfef08a, 0.16, 0.1, 0xfde047, 2.2);
        const tailMat = this.mat(0xdc2626, 0.25, 0.1, 0xef4444, 1.3);
        const signMat = this.mat(0xf97316, 0.25, 0.1, 0xf97316, 1.3);

        const lower = new THREE.Mesh(
          this.geo('bus_lower', () => new THREE.BoxGeometry(1.94, 1.32, 7.5)),
          greenBus
        );
        lower.position.y = 1.04;
        lower.castShadow = true;
        g.add(lower);

        const upper = new THREE.Mesh(
          this.geo('bus_upper', () => new THREE.BoxGeometry(1.88, 1.28, 7.3)),
          creamMat
        );
        upper.position.y = 2.34;
        g.add(upper);

        const stripe = new THREE.Mesh(
          this.geo('bus_stripe', () => new THREE.BoxGeometry(1.98, 0.22, 7.54)),
          yellowStripe
        );
        stripe.position.y = 1.64;
        g.add(stripe);

        const glass = new THREE.Mesh(
          this.geo('bus_glass', () => new THREE.BoxGeometry(1.92, 0.78, 6.75)),
          glassMat
        );
        glass.position.y = 2.32;
        g.add(glass);

        // Front windshield, chrome radiator grille, bumpers & glowing route sign (+Z)
        const frontGlass = new THREE.Mesh(
          this.geo('bus_fglass', () => new THREE.BoxGeometry(1.68, 0.9, 0.1)),
          glassMat
        );
        frontGlass.position.set(0, 2.28, 3.68);
        frontGlass.rotation.x = 0.08;
        g.add(frontGlass);

        const grille = new THREE.Mesh(this.boxGeo(1.06, 0.42, 0.08), chromeMat);
        grille.position.set(0, 0.88, 3.77);
        g.add(grille);

        const frontBumper = new THREE.Mesh(this.boxGeo(1.98, 0.22, 0.2), chromeMat);
        frontBumper.position.set(0, 0.46, 3.76);
        g.add(frontBumper);

        const routeSign = new THREE.Mesh(this.boxGeo(1.25, 0.22, 0.12), signMat);
        routeSign.position.set(0, 2.88, 3.71);
        g.add(routeSign);

        // Side Rear-View Mirrors
        for (const sx of [-1.06, 1.06]) {
          const mirror = new THREE.Mesh(this.boxGeo(0.1, 0.28, 0.14), chromeMat);
          mirror.position.set(sx, 2.1, 3.55);
          g.add(mirror);
        }

        // Roof AC Pods
        for (const rz of [-1.6, 1.4]) {
          const pod = new THREE.Mesh(this.boxGeo(1.15, 0.18, 1.45), creamMat);
          pod.position.set(0, 3.06, rz);
          g.add(pod);
        }

        for (const sx of [-0.66, 0.66]) {
          const lamp = new THREE.Mesh(this.boxGeo(0.32, 0.2, 0.12), lampMat);
          lamp.position.set(sx, 0.86, 3.77);
          g.add(lamp);

          const tail = new THREE.Mesh(this.boxGeo(0.28, 0.24, 0.1), tailMat);
          tail.position.set(sx, 0.9, -3.76);
          g.add(tail);
        }

        const wheelGeo = this.geo('bus_wheel', () => {
          const wg = new THREE.CylinderGeometry(0.38, 0.38, 0.24, 12);
          wg.rotateZ(Math.PI / 2);
          return wg;
        });
        const rimGeo = this.geo('bus_rim', () => {
          const rg = new THREE.CylinderGeometry(0.22, 0.22, 0.26, 10);
          rg.rotateZ(Math.PI / 2);
          return rg;
        });
        const wheels: THREE.Object3D[] = [];
        for (const wz of [-2.3, 2.3]) {
          for (const wx of [-0.9, 0.9]) {
            const w = new THREE.Mesh(wheelGeo, tireMat);
            w.position.set(wx, 0.38, wz);
            w.add(new THREE.Mesh(rimGeo, chromeMat));
            g.add(w);
            wheels.push(w);
          }
        }
        g.userData.wheels = wheels;

        g.add(this.createShadowPlane(2.3, 8.1));
        g.add(this.createHeadlightPool(2.0, 4.2, 3.8));
        break;
      }

      case 'TAXI_VERT': {
        const taxiGreen = this.mat(0x22c55e, 0.28, 0.28);
        const glassMat = this.mat(0x0f172a, 0.08, 0.62);
        const signMat = this.mat(0xfacc15, 0.25, 0.1, 0xfacc15, 1.5);
        const stripeMat = this.mat(0xfaf5ee, 0.4, 0.1);
        const chromeMat = this.mat(0xe2e8f0, 0.22, 0.85);
        const tireMat = this.mat(0x111827, 0.88, 0.05);
        const lampMat = this.mat(0xfef08a, 0.16, 0.1, 0xfde047, 2.3);
        const tailMat = this.mat(0xdc2626, 0.25, 0.1, 0xef4444, 1.4);

        const body = new THREE.Mesh(
          this.geo('taxi_body', () => new THREE.BoxGeometry(1.74, 0.66, 4.05)),
          taxiGreen
        );
        body.position.y = 0.62;
        body.castShadow = true;
        g.add(body);

        // Sloped front hood facing player (+Z)
        const hood = new THREE.Mesh(
          this.geo('taxi_hood', () => new THREE.BoxGeometry(1.66, 0.18, 1.25)),
          taxiGreen
        );
        hood.position.set(0, 0.92, 1.38);
        hood.rotation.x = 0.08;
        g.add(hood);

        // Bright white taxi beltline stripe
        const beltStripe = new THREE.Mesh(
          this.geo('taxi_stripe', () => new THREE.BoxGeometry(1.78, 0.12, 4.08)),
          stripeMat
        );
        beltStripe.position.y = 0.8;
        g.add(beltStripe);

        // Chrome front & rear bumpers + front radiator grille
        const frontBumper = new THREE.Mesh(this.boxGeo(1.8, 0.18, 0.18), chromeMat);
        frontBumper.position.set(0, 0.36, 2.04);
        g.add(frontBumper);

        const rearBumper = new THREE.Mesh(this.boxGeo(1.8, 0.18, 0.16), chromeMat);
        rearBumper.position.set(0, 0.36, -2.02);
        g.add(rearBumper);

        const grille = new THREE.Mesh(this.boxGeo(0.76, 0.24, 0.08), chromeMat);
        grille.position.set(0, 0.66, 2.04);
        g.add(grille);

        // Sculpted cabin + angled front/rear glass + side mirrors
        const cabin = new THREE.Mesh(
          this.geo('taxi_cabin', () => new THREE.BoxGeometry(1.48, 0.54, 1.92)),
          taxiGreen
        );
        cabin.position.set(0, 1.24, -0.14);
        g.add(cabin);

        const cabinGlass = new THREE.Mesh(
          this.geo('taxi_glass', () => new THREE.BoxGeometry(1.52, 0.4, 1.72)),
          glassMat
        );
        cabinGlass.position.set(0, 1.22, -0.14);
        g.add(cabinGlass);

        const windshield = new THREE.Mesh(this.boxGeo(1.42, 0.5, 0.1), glassMat);
        windshield.position.set(0, 1.18, 0.88);
        windshield.rotation.x = 0.42;
        g.add(windshield);

        for (const sx of [-0.88, 0.88]) {
          const mirror = new THREE.Mesh(this.boxGeo(0.14, 0.1, 0.14), taxiGreen);
          mirror.position.set(sx, 1.02, 0.72);
          g.add(mirror);
        }

        const taxiRoofSign = new THREE.Mesh(this.boxGeo(0.66, 0.2, 0.28), signMat);
        taxiRoofSign.position.set(0, 1.6, 0.08);
        g.add(taxiRoofSign);

        for (const sx of [-0.58, 0.58]) {
          const lamp = new THREE.Mesh(this.boxGeo(0.32, 0.2, 0.1), lampMat);
          lamp.position.set(sx, 0.68, 2.06);
          g.add(lamp);

          const tail = new THREE.Mesh(this.boxGeo(0.28, 0.16, 0.1), tailMat);
          tail.position.set(sx, 0.72, -2.04);
          g.add(tail);
        }

        const wheelGeo = this.geo('taxi_wheel', () => {
          const wg = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12);
          wg.rotateZ(Math.PI / 2);
          return wg;
        });
        const rimGeo = this.geo('taxi_rim', () => {
          const rg = new THREE.CylinderGeometry(0.18, 0.18, 0.22, 10);
          rg.rotateZ(Math.PI / 2);
          return rg;
        });
        const wheels: THREE.Object3D[] = [];
        for (const wz of [-1.28, 1.28]) {
          for (const wx of [-0.82, 0.82]) {
            const w = new THREE.Mesh(wheelGeo, tireMat);
            w.position.set(wx, 0.3, wz);
            w.add(new THREE.Mesh(rimGeo, chromeMat));
            g.add(w);
            wheels.push(w);
          }
        }
        g.userData.wheels = wheels;

        g.add(this.createShadowPlane(2.05, 4.5));
        g.add(this.createHeadlightPool(1.8, 3.6, 2.1));
        break;
      }

      case 'MOTO': {
        // High-visibility Ouaga Moto with rounded rider, glowing circular headlight & spinning wheels
        const scooterMat = this.mat(0xf97316, 0.32, 0.35);
        const shieldMat = this.mat(0xdc2626, 0.35, 0.25);
        const tireMat = this.mat(0x111827, 0.88, 0.05);
        const vestMat = this.mat(0xfacc15, 0.45, 0.1, 0xeab308, 0.35);
        const pantsMat = this.mat(0x1e293b, 0.8, 0.05);
        const helmetMat = this.mat(0xfaf5ee, 0.25, 0.2);
        const helmetStripeMat = this.mat(0xdc2626, 0.35, 0.1);
        const visorMat = this.mat(0x0f172a, 0.12, 0.65);
        const chromeMat = this.mat(0xe2e8f0, 0.25, 0.85);
        const lampMat = this.mat(0xfef08a, 0.15, 0.1, 0xfde047, 2.4);
        const blinkerMat = this.mat(0xf97316, 0.2, 0.1, 0xf97316, 1.5);
        const skinMat = this.mat(0x6b3e26, 0.72, 0.04);
        const hairMat = this.mat(0x111827, 0.85, 0.05);

        const wheelGeo = this.geo('obs_moto_wheel', () => {
          const wg = new THREE.CylinderGeometry(0.3, 0.3, 0.18, 12);
          wg.rotateZ(Math.PI / 2);
          return wg;
        });
        const rimGeo = this.geo('obs_moto_rim', () => {
          const rg = new THREE.CylinderGeometry(0.16, 0.16, 0.19, 10);
          rg.rotateZ(Math.PI / 2);
          return rg;
        });
        const fw = new THREE.Mesh(wheelGeo, tireMat);
        fw.position.set(0, 0.3, 0.7);
        fw.add(new THREE.Mesh(rimGeo, chromeMat));
        g.add(fw);
        const rw = new THREE.Mesh(wheelGeo, tireMat);
        rw.position.set(0, 0.3, -0.7);
        rw.add(new THREE.Mesh(rimGeo, chromeMat));
        g.add(rw);
        g.userData.wheels = [fw, rw];

        const frame = new THREE.Mesh(
          this.geo('obs_moto_frame', () => new THREE.CapsuleGeometry(0.24, 0.95, 4, 10)),
          scooterMat
        );
        frame.rotation.x = Math.PI / 2;
        frame.scale.set(1.08, 1, 0.88);
        frame.position.y = 0.56;
        frame.castShadow = true;
        g.add(frame);

        const frontApron = new THREE.Mesh(
          this.geo('obs_moto_apron', () => new THREE.CapsuleGeometry(0.26, 0.36, 4, 8)),
          shieldMat
        );
        frontApron.scale.set(1.15, 1, 0.55);
        frontApron.position.set(0, 0.78, 0.52);
        frontApron.rotation.x = -0.18;
        g.add(frontApron);

        const handlebar = new THREE.Mesh(
          this.geo('obs_moto_hbar', () => {
            const hg = new THREE.CylinderGeometry(0.032, 0.032, 0.94, 8);
            hg.rotateZ(Math.PI / 2);
            return hg;
          }),
          chromeMat
        );
        handlebar.position.set(0, 1.12, 0.48);
        g.add(handlebar);

        const headlight = new THREE.Mesh(
          this.geo('obs_moto_hl', () => {
            const cg = new THREE.CylinderGeometry(0.13, 0.13, 0.1, 10);
            cg.rotateX(Math.PI / 2);
            return cg;
          }),
          lampMat
        );
        headlight.position.set(0, 0.96, 0.66);
        g.add(headlight);

        const blinkerGeo = this.geo('obs_moto_blinker', () => new THREE.SphereGeometry(0.06, 6, 6));
        for (const sx of [-0.42, 0.42]) {
          const blinker = new THREE.Mesh(blinkerGeo, blinkerMat);
          blinker.position.set(sx, 1.08, 0.54);
          g.add(blinker);
        }

        // Human Rider Torso + Shoulders + Arms Gripping Handlebars + Legs + Rounded Helmet
        const riderTorso = new THREE.Mesh(
          this.geo('obs_moto_torso', () => new THREE.CylinderGeometry(0.22, 0.175, 0.52, 10)),
          vestMat
        );
        riderTorso.scale.set(1.12, 1, 0.72);
        riderTorso.position.set(0, 1.1, -0.06);
        riderTorso.rotation.x = 0.22;
        g.add(riderTorso);

        const shoulderYoke = new THREE.Mesh(
          this.geo('h_yoke', () => new THREE.CapsuleGeometry(0.112, 0.24, 4, 8)),
          vestMat
        );
        shoulderYoke.rotation.z = Math.PI / 2;
        shoulderYoke.position.set(0, 1.28, 0.01);
        g.add(shoulderYoke);

        const armGeo = this.geo('obs_moto_arm', () => new THREE.CapsuleGeometry(0.05, 0.34, 4, 8));
        const handGeo = this.geo('h_hand', () => new THREE.SphereGeometry(0.048, 8, 6));
        const legGeo = this.geo('obs_moto_leg', () => new THREE.CapsuleGeometry(0.072, 0.34, 4, 8));
        for (const sx of [-1, 1]) {
          const arm = new THREE.Mesh(armGeo, vestMat);
          arm.position.set(sx * 0.31, 1.19, 0.25);
          arm.rotation.x = -1.18;
          arm.rotation.z = sx * 0.16;
          g.add(arm);

          const hand = new THREE.Mesh(handGeo, skinMat);
          hand.position.set(sx * 0.4, 1.12, 0.47);
          g.add(hand);

          const leg = new THREE.Mesh(legGeo, pantsMat);
          leg.position.set(sx * 0.24, 0.68, 0.05);
          leg.rotation.x = -0.5;
          g.add(leg);
        }

        const riderHead = this.buildHumanHead(skinMat, hairMat, 1);
        riderHead.position.set(0, 1.52, 0.02);
        g.add(riderHead);

        const helmet = new THREE.Mesh(
          this.geo('obs_moto_helmet', () => new THREE.SphereGeometry(0.19, 12, 10)),
          helmetMat
        );
        helmet.scale.set(0.96, 1.02, 1.06);
        helmet.position.set(0, 0.04, -0.01);
        riderHead.add(helmet);

        const helmetStripe = new THREE.Mesh(
          this.geo('obs_moto_hstripe', () => new THREE.TorusGeometry(0.192, 0.024, 6, 14, Math.PI * 1.15)),
          helmetStripeMat
        );
        helmetStripe.rotation.y = Math.PI / 2;
        helmetStripe.rotation.z = -0.1;
        helmetStripe.position.set(0, 0.04, -0.01);
        riderHead.add(helmetStripe);

        const visor = new THREE.Mesh(
          this.geo('obs_moto_visor', () => new THREE.CylinderGeometry(0.186, 0.186, 0.09, 10, 1, false, -Math.PI * 0.35, Math.PI * 0.7)),
          visorMat
        );
        visor.position.set(0, 0.02, 0.01);
        riderHead.add(visor);

        g.add(this.createShadowPlane(1.3, 2.2));
        g.add(this.createHeadlightPool(1.25, 3.4, 0.78));
        break;
      }

      case 'MARCHANDE': {
        const woodMat = this.mat(0x9a4c2a, 0.82, 0.04);
        const basketMat = this.mat(0xb45309, 0.86, 0.03);
        const apronRed = this.mat(0xea580c, 0.65, 0.05);
        const apronGold = this.mat(0xfacc15, 0.55, 0.08);
        const clothMat = this.mat(0xdc2626, 0.65, 0.05);
        const orangeMat = this.mat(0xf97316, 0.52, 0.04);
        const mangoMat = this.mat(0x84cc16, 0.52, 0.04);
        const umbrellaRed = this.mat(0xdc2626, 0.6, 0.05);
        const umbrellaGold = this.mat(0xfacc15, 0.55, 0.05);
        const pagneMat = this.mat(0x14b8a6, 0.7, 0.05);
        const blouseMat = this.mat(0xf59e0b, 0.72, 0.04);
        const skinMat = this.mat(0x6b3e26, 0.7, 0.04);
        const hairMat = this.mat(0x111827, 0.85, 0.05);
        const lanternMat = this.mat(0xfef08a, 0.2, 0.1, 0xfde047, 1.6);

        // Wooden market table + vibrant wax cloth front apron facing (+Z)
        const table = new THREE.Mesh(
          this.geo('obs_march_table', () => new THREE.BoxGeometry(1.82, 0.84, 1.34)),
          woodMat
        );
        table.position.y = 0.42;
        table.castShadow = true;
        g.add(table);

        const frontApron = new THREE.Mesh(
          this.geo('obs_march_apron', () => new THREE.BoxGeometry(1.84, 0.62, 0.08)),
          apronRed
        );
        frontApron.position.set(0, 0.44, 0.68);
        g.add(frontApron);

        const apronStripe = new THREE.Mesh(
          this.geo('obs_march_stripe', () => new THREE.BoxGeometry(1.86, 0.16, 0.1)),
          apronGold
        );
        apronStripe.position.set(0, 0.72, 0.68);
        g.add(apronStripe);

        // Woven baskets + pyramids of round oranges & mangoes!
        const trayGeo = this.geo('obs_march_tray', () => new THREE.CylinderGeometry(0.36, 0.28, 0.16, 10));
        const fruitGeo = this.geo('obs_march_fruit', () => new THREE.SphereGeometry(0.095, 7, 6));
        const fruitOffsets = [
          [-0.14, 0.06, -0.12], [0.06, 0.06, -0.14], [0.16, 0.06, 0.06],
          [-0.08, 0.06, 0.14], [0.0, 0.19, 0.0],
        ];
        for (const [bx, fMat] of [[-0.44, orangeMat], [0.44, mangoMat]] as const) {
          const tray = new THREE.Mesh(trayGeo, basketMat);
          tray.position.set(bx, 0.92, 0.18);
          g.add(tray);
          for (const [fx, fy, fz] of fruitOffsets) {
            const fruit = new THREE.Mesh(fruitGeo, fMat);
            fruit.position.set(bx + fx, 0.95 + fy, 0.18 + fz);
            g.add(fruit);
          }
        }

        // Human Vendor Behind Stall (sculpted torso, pagne skirt, arms, face & headscarf)
        const skirt = new THREE.Mesh(
          this.geo('obs_march_skirt', () => new THREE.CylinderGeometry(0.18, 0.25, 0.62, 10)),
          pagneMat
        );
        skirt.scale.set(1.12, 1, 0.78);
        skirt.position.set(0, 0.85, -0.52);
        g.add(skirt);

        const blouse = new THREE.Mesh(
          this.geo('obs_march_blouse', () => new THREE.CylinderGeometry(0.2, 0.17, 0.44, 10)),
          blouseMat
        );
        blouse.scale.set(1.06, 1, 0.72);
        blouse.position.set(0, 1.32, -0.52);
        g.add(blouse);

        const vShoulder = new THREE.Mesh(
          this.geo('h_yoke', () => new THREE.CapsuleGeometry(0.112, 0.24, 4, 8)),
          blouseMat
        );
        vShoulder.rotation.z = Math.PI / 2;
        vShoulder.scale.set(0.95, 0.92, 0.85);
        vShoulder.position.set(0, 1.48, -0.52);
        g.add(vShoulder);

        const vArmGeo = this.geo('obs_march_arm', () => new THREE.CapsuleGeometry(0.045, 0.28, 4, 8));
        const vHandGeo = this.geo('h_hand', () => new THREE.SphereGeometry(0.048, 8, 6));
        for (const sx of [-1, 1]) {
          const arm = new THREE.Mesh(vArmGeo, skinMat);
          arm.position.set(sx * 0.26, 1.32, -0.34);
          arm.rotation.x = -0.85;
          arm.rotation.z = sx * -0.15;
          g.add(arm);

          const hand = new THREE.Mesh(vHandGeo, skinMat);
          hand.position.set(sx * 0.22, 1.15, -0.18);
          g.add(hand);
        }

        const vendorHead = this.buildHumanHead(skinMat, hairMat, 1);
        vendorHead.position.set(0, 1.76, -0.52);
        g.add(vendorHead);

        const headWrap = new THREE.Mesh(
          this.geo('h_awa_wrap', () => new THREE.SphereGeometry(0.182, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58)),
          clothMat
        );
        headWrap.position.set(0, 0.04, -0.015);
        headWrap.rotation.x = -0.18;
        vendorHead.add(headWrap);

        const wrapBand = new THREE.Mesh(
          this.geo('h_awa_band', () => new THREE.TorusGeometry(0.155, 0.036, 6, 14)),
          apronGold
        );
        wrapBand.rotation.x = Math.PI / 2 - 0.18;
        wrapBand.position.set(0, 0.085, -0.01);
        vendorHead.add(wrapBand);

        // Tall Market Parasol Pole + Glowing Lantern + Striped Canopy
        const pole = new THREE.Mesh(
          this.geo('obs_march_pole', () => new THREE.CylinderGeometry(0.055, 0.055, 2.35, 8)),
          woodMat
        );
        pole.position.set(0, 1.18, 0);
        g.add(pole);

        const lantern = new THREE.Mesh(
          this.geo('obs_march_lantern', () => new THREE.CylinderGeometry(0.11, 0.13, 0.26, 8)),
          lanternMat
        );
        lantern.position.set(0.45, 1.85, 0.45);
        g.add(lantern);

        const canopy1 = new THREE.Mesh(
          this.geo('obs_march_canopy1', () => new THREE.ConeGeometry(1.28, 0.58, 8)),
          umbrellaRed
        );
        canopy1.position.y = 2.48;
        g.add(canopy1);

        const canopyTop = new THREE.Mesh(
          this.geo('obs_march_canopy2', () => new THREE.ConeGeometry(0.68, 0.36, 8)),
          umbrellaGold
        );
        canopyTop.position.y = 2.68;
        g.add(canopyTop);

        g.add(this.createShadowPlane(2.2, 2.2));
        break;
      }

      case 'BARRIERE_BASSE': {
        const legMat = this.mat(0xeab308, 0.45, 0.2);
        const railMat = this.mat(0xfacc15, 0.35, 0.15);
        const beaconMat = this.mat(0xf97316, 0.2, 0.1, 0xf97316, 2.0);
        const signMat = this.trackMat(
          new THREE.MeshBasicMaterial({ map: this.jumpSignTexture })
        );

        // Wide high-visibility yellow support feet + beacons
        for (const sx of [-0.82, 0.82]) {
          const foot = new THREE.Mesh(
            this.trackGeo(new THREE.BoxGeometry(0.28, 0.12, 0.65)),
            legMat
          );
          foot.position.set(sx, 0.06, 0);
          g.add(foot);

          const leg = new THREE.Mesh(
            this.trackGeo(new THREE.BoxGeometry(0.16, 0.96, 0.2)),
            legMat
          );
          leg.position.set(sx, 0.54, 0);
          g.add(leg);

          const beacon = new THREE.Mesh(
            this.trackGeo(new THREE.BoxGeometry(0.2, 0.2, 0.2)),
            beaconMat
          );
          beacon.position.set(sx, 1.12, 0);
          g.add(beacon);
        }

        // Crisp "▲ SAUTER" hazard board facing player (+Z)
        const board = new THREE.Mesh(
          this.trackGeo(new THREE.BoxGeometry(1.98, 0.54, 0.24)),
          [railMat, railMat, railMat, railMat, signMat, railMat]
        );
        board.position.y = 0.72;
        board.castShadow = true;
        g.add(board);

        g.add(this.createShadowPlane(2.15, 0.95));
        break;
      }

      case 'BARRIERE_HAUTE': {
        // Engine places obs at y = 1.15. Local y = -1.15 touches the road at world y = 0!
        const postMat = this.mat(0xfacc15, 0.45, 0.25);
        const footMat = this.mat(0xf97316, 0.45, 0.2);
        const frameMat = this.mat(0xf59e0b, 0.4, 0.15);
        const redBeaconMat = this.mat(0xef4444, 0.2, 0.1, 0xef4444, 2.2);
        const signMat = this.trackMat(
          new THREE.MeshBasicMaterial({ map: this.slideSignTexture })
        );

        for (const sx of [-1.0, 1.0]) {
          // Ground footplate at local y = -1.09 (world y = 0.06) so the open tunnel below is obvious!
          const foot = new THREE.Mesh(
            this.trackGeo(new THREE.BoxGeometry(0.32, 0.12, 0.65)),
            footMat
          );
          foot.position.set(sx, -1.09, 0);
          g.add(foot);

          const post = new THREE.Mesh(
            this.trackGeo(new THREE.BoxGeometry(0.18, 2.58, 0.22)),
            postMat
          );
          post.position.set(sx, 0.14, 0); // local -1.15 .. +1.43 => world 0 .. 2.58m
          g.add(post);

          const beacon = new THREE.Mesh(
            this.trackGeo(new THREE.BoxGeometry(0.22, 0.22, 0.22)),
            redBeaconMat
          );
          beacon.position.set(sx, 1.52, 0);
          g.add(beacon);
        }

        // Overhead "▼ GLISSER" gantry board (local +0.02..+1.18 => world 1.17m..2.33m)
        const signBoard = new THREE.Mesh(
          this.trackGeo(new THREE.BoxGeometry(2.16, 1.16, 0.26)),
          [frameMat, frameMat, frameMat, frameMat, signMat, frameMat]
        );
        signBoard.position.y = 0.6;
        signBoard.castShadow = true;
        g.add(signBoard);

        g.add(this.createShadowPlane(2.25, 0.95, -1.13));
        break;
      }
    }

    return g;
  }

  public createCollectibleGroup(kind: CollectibleKind): THREE.Group {
    const g = new THREE.Group();

    switch (kind) {
      case 'PIECE': {
        const rimMat = this.mat(0xfbbf24, 0.2, 0.92, 0xb45309, 0.2);
        const faceMat = this.texMat('coin_face', this.coinFaceTexture, 0.22, 0.85);
        const disc = new THREE.Mesh(
          this.geo('col_coin_disc', () => new THREE.CylinderGeometry(0.38, 0.38, 0.09, 14)),
          [rimMat, faceMat, faceMat]
        );
        disc.rotation.x = Math.PI / 2;
        g.add(disc);
        break;
      }

      case 'BILLET': {
        const billMat = this.texMat('bill_face', this.banknoteTexture, 0.45, 0.12);
        const edgeMat = this.mat(0x059669, 0.48, 0.12);
        const note = new THREE.Mesh(
          this.geo('col_bill_box', () => new THREE.BoxGeometry(0.72, 0.4, 0.06)),
          [edgeMat, edgeMat, edgeMat, edgeMat, billMat, billMat]
        );
        g.add(note);
        break;
      }

      case 'AIMANT': {
        const redMat = this.mat(0xef4444, 0.35, 0.25, 0xdc2626, 0.3);
        const tipMat = this.mat(0xe2e8f0, 0.2, 0.9);
        const arch = new THREE.Mesh(
          this.trackGeo(new THREE.TorusGeometry(0.28, 0.09, 8, 12, Math.PI)),
          redMat
        );
        arch.position.y = 0.08;
        g.add(arch);

        for (const sx of [-0.28, 0.28]) {
          const tip = new THREE.Mesh(
            this.trackGeo(new THREE.BoxGeometry(0.16, 0.24, 0.16)),
            tipMat
          );
          tip.position.set(sx, -0.06, 0);
          g.add(tip);
        }
        break;
      }

      case 'GRIGRI': {
        const skyMat = this.mat(0x38bdf8, 0.18, 0.35, 0x0284c7, 0.55);
        const gem = new THREE.Mesh(
          this.trackGeo(new THREE.OctahedronGeometry(0.38, 0)),
          skyMat
        );
        g.add(gem);
        break;
      }

      case 'GINGEMBRE': {
        const turboMat = this.mat(0xf97316, 0.28, 0.2, 0xea580c, 0.5);
        const capMat = this.mat(0xfef08a, 0.35, 0.2);
        const bottle = new THREE.Mesh(
          this.trackGeo(new THREE.CylinderGeometry(0.2, 0.24, 0.56, 10)),
          turboMat
        );
        g.add(bottle);
        const neck = new THREE.Mesh(
          this.trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 8)),
          capMat
        );
        neck.position.y = 0.34;
        g.add(neck);
        break;
      }
    }

    return g;
  }

  public createPalmTree(scale: number = 1): THREE.Group {
    const tree = new THREE.Group();
    const trunkMat = this.mat(0x7a4b2c, 0.9, 0.02);
    const cocoMat = this.mat(0x451a03, 0.78, 0.05);
    const frondMatA = this.mat(0x16a34a, 0.72, 0.04);
    const frondMatB = this.mat(0x22c55e, 0.7, 0.04);

    // 4-segment gently curved palm trunk with ringed silhouette
    const segPositions = [
      [0, 0.65, 0, -0.02],
      [0.05, 1.9, 0, -0.06],
      [0.14, 3.1, 0, -0.09],
      [0.25, 4.25, 0, -0.06],
    ];
    for (let i = 0; i < segPositions.length; i++) {
      const [sx, sy, sz, rz] = segPositions[i];
      const seg = new THREE.Mesh(
        this.geo(`palm_seg_${i}`, () => new THREE.CylinderGeometry(0.18 - i * 0.025, 0.23 - i * 0.025, 1.35, 7)),
        trunkMat
      );
      seg.position.set(sx, sy, sz);
      seg.rotation.z = rz;
      tree.add(seg);
    }

    // Crown heart & coconuts
    const crown = new THREE.Group();
    crown.position.set(0.28, 4.9, 0);
    const cocoGeo = this.geo('palm_coco', () => new THREE.SphereGeometry(0.14, 6, 6));
    for (let c = 0; c < 3; c++) {
      const ang = (c / 3) * Math.PI * 2;
      const coco = new THREE.Mesh(cocoGeo, cocoMat);
      coco.position.set(Math.sin(ang) * 0.16, -0.12, Math.cos(ang) * 0.16);
      crown.add(coco);
    }

    // 8 gracefully arched 2-segment palm fronds (inner lift + drooping tip)
    const frondBaseGeo = this.geo('palm_f_base', () => new THREE.BoxGeometry(0.38, 0.06, 1.25));
    const frondTipGeo = this.geo('palm_f_tip', () => new THREE.BoxGeometry(0.26, 0.05, 1.15));
    for (let f = 0; f < 8; f++) {
      const frondGroup = new THREE.Group();
      const angle = (f / 8) * Math.PI * 2 + (f % 2 === 0 ? 0.08 : -0.08);
      const pitch = f % 2 === 0 ? -0.18 : 0.05;
      frondGroup.rotation.y = angle;

      const mat = f % 2 === 0 ? frondMatA : frondMatB;
      const baseSeg = new THREE.Mesh(frondBaseGeo, mat);
      baseSeg.rotation.x = pitch;
      baseSeg.position.set(0, 0.08 - pitch * 0.35, 0.62);
      frondGroup.add(baseSeg);

      const tipSeg = new THREE.Mesh(frondTipGeo, mat);
      tipSeg.rotation.x = 0.52;
      tipSeg.position.set(0, -0.18 - pitch * 0.35, 1.62);
      frondGroup.add(tipSeg);

      crown.add(frondGroup);
    }
    tree.add(crown);

    tree.scale.setScalar(scale);
    return tree;
  }

  public createNeemTree(scale: number = 1): THREE.Group {
    const tree = new THREE.Group();
    const barkMat = this.mat(0x5c3a24, 0.92, 0.02);
    const leafDark = this.mat(0x15803d, 0.78, 0.03);
    const leafLight = this.mat(0x22c55e, 0.74, 0.04);

    // Gnarled trunk + twin main limbs
    const trunk = new THREE.Mesh(
      this.geo('neem_trunk', () => new THREE.CylinderGeometry(0.22, 0.34, 2.6, 7)),
      barkMat
    );
    trunk.position.y = 1.3;
    tree.add(trunk);

    const branchGeo = this.geo('neem_branch', () => new THREE.CylinderGeometry(0.11, 0.17, 1.5, 6));
    for (const [bx, rz] of [[-0.4, 0.48], [0.42, -0.45]] as const) {
      const br = new THREE.Mesh(branchGeo, barkMat);
      br.position.set(bx, 2.75, 0);
      br.rotation.z = rz;
      tree.add(br);
    }

    // Lush layered foliage canopy (4 low-poly icosahedron puffs)
    const canopyMain = new THREE.Mesh(
      this.geo('neem_canopy_main', () => new THREE.IcosahedronGeometry(1.55, 1)),
      leafDark
    );
    canopyMain.scale.set(1.25, 0.85, 1.15);
    canopyMain.position.set(0, 3.85, 0);
    tree.add(canopyMain);

    const puffGeo = this.geo('neem_canopy_puff', () => new THREE.IcosahedronGeometry(1.08, 1));
    const puffs: [number, number, number, THREE.Material][] = [
      [-1.05, 3.45, 0.35, leafLight],
      [1.08, 3.55, -0.3, leafLight],
      [0.15, 4.45, 0.4, leafLight],
    ];
    for (const [px, py, pz, pm] of puffs) {
      const puff = new THREE.Mesh(puffGeo, pm);
      puff.scale.set(1.1, 0.82, 1.05);
      puff.position.set(px, py, pz);
      tree.add(puff);
    }

    tree.scale.setScalar(scale);
    return tree;
  }

  public createSceneryChunk(chunkIndex: number, length: number): THREE.Group {
    const g = new THREE.Group();

    // 1. Central 3-lane Asphalt Road (PBR bump-mapped tarmac, dynamic wet sheen in rain)
    const road = new THREE.Mesh(
      this.geo(`road_${length}`, () => new THREE.PlaneGeometry(LANE_WIDTH * 3 + 2.2, length)),
      this.roadMat
    );
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0;
    road.receiveShadow = true;
    g.add(road);

    // 2. Textured Sahelian Laterite Ground extending cleanly into horizon/fog
    const earthMat = this.texMat('laterite', this.lateriteTexture, 0.94, 0.0);
    const earthGeo = this.geo(`earth_${length}`, () => new THREE.PlaneGeometry(68, length));
    for (const side of [-1, 1]) {
      const earth = new THREE.Mesh(earthGeo, earthMat);
      earth.rotation.x = -Math.PI / 2;
      earth.position.set(side * 38.6, -0.02, 0);
      g.add(earth);
    }

    // 3. Textured Concrete Sidewalks & Curbs
    const sidewalkMat = this.texMat('sidewalk', this.sidewalkTexture, 0.88, 0.04);
    const walkGeo = this.geo(`walk_${length}`, () => new THREE.BoxGeometry(2.8, 0.16, length));
    for (const side of [-1, 1]) {
      const walk = new THREE.Mesh(walkGeo, sidewalkMat);
      walk.position.set(side * 6.05, 0.08, 0);
      g.add(walk);
    }

    // 4. Realistic Ouagadougou Buildings, Roofs, Balconies, Poly-Tanks & Street Life
    const roofMat = this.texMat('roof', this.roofTexture, 0.72, 0.25);
    const parapetMat = this.mat(0xd6c7b4, 0.86, 0.04);
    const wallCompoundMat = this.mat(0xd99b72, 0.88, 0.02);
    const polyTankMat = this.mat(0x0284c7, 0.35, 0.15);
    const dishMat = this.mat(0xe2e8f0, 0.32, 0.65);
    const poleMat = this.mat(0x475569, 0.55, 0.5);
    const wireMat = this.mat(0x1e293b, 0.75, 0.2);
    const lampBulbMat = this.lampBulbMat;
    const awningRed = this.mat(0xdc2626, 0.72, 0.05);
    const awningGreen = this.mat(0x059669, 0.72, 0.05);
    const awningGold = this.mat(0xd97706, 0.7, 0.06);
    const distantMat = this.mat(0x8c5642, 0.92, 0.02);
    const terracottaMat = this.mat(0x9a3412, 0.85, 0.03);
    const trees: THREE.Object3D[] = [];

    for (const side of [-1, 1]) {
      for (let b = 0; b < 2; b++) {
        const seed = chunkIndex * 7 + b * 3 + (side > 0 ? 1 : 0);
        const w = 4.6 + (seed % 3) * 1.1;
        const h = 5.4 + ((seed * 5) % 4) * 1.4;
        const d = 8.4;
        const bz = -length * 0.25 + b * (length * 0.5);
        const bx = side * (9.9 + w * 0.5);

        const texIdx = seed % this.facadeTextures.length;
        const facadeMat = this.texMat(`facade_${texIdx}`, this.facadeTextures[texIdx], 0.84, 0.04);
        const sideWallMat = this.mat(
          texIdx === 0 ? 0xe2a882 : texIdx === 1 ? 0xd47654 : texIdx === 2 ? 0xe3bd73 : 0xcbd5e1,
          0.86,
          0.03
        );
        // Apply crisp architectural facade texture on street-facing side (-side) + clean plaster on ends
        const streetFaceIdx = side > 0 ? 1 : 0; // -X face (idx 1) if building is on +X, +X face (idx 0) if on -X
        const bldgMats = [
          streetFaceIdx === 0 ? facadeMat : sideWallMat,
          streetFaceIdx === 1 ? facadeMat : sideWallMat,
          parapetMat,
          sideWallMat,
          sideWallMat,
          sideWallMat,
        ];

        const bldg = new THREE.Mesh(
          this.geo(`bldg_${w.toFixed(1)}_${h.toFixed(1)}_${d}`, () => new THREE.BoxGeometry(w, h, d)),
          bldgMats
        );
        bldg.position.set(bx, h * 0.5, bz);
        g.add(bldg);

        // Corrugated metal roof or stepped parapet terrace + Polytank / Satellite Dish
        if (seed % 3 === 0) {
          const parapet = new THREE.Mesh(
            this.geo(`para_${w.toFixed(1)}_${d}`, () => new THREE.BoxGeometry(w + 0.35, 0.45, d + 0.35)),
            parapetMat
          );
          parapet.position.set(bx, h + 0.22, bz);
          g.add(parapet);

          // Iconic Ouaga blue rooftop water tank ("Polytank")
          const tank = new THREE.Mesh(
            this.geo('rooftop_tank', () => new THREE.CylinderGeometry(0.55, 0.55, 1.15, 10)),
            polyTankMat
          );
          tank.position.set(bx - side * 0.5, h + 0.95, bz + 1.2);
          g.add(tank);
        } else {
          const roof = new THREE.Mesh(
            this.geo(`roof_${w.toFixed(1)}_${d}`, () => new THREE.BoxGeometry(w + 0.65, 0.28, d + 0.55)),
            roofMat
          );
          roof.position.set(bx, h + 0.14, bz);
          roof.rotation.z = side * 0.08;
          g.add(roof);

          if (seed % 2 === 1) {
            const dish = new THREE.Mesh(
              this.geo('rooftop_dish', () => new THREE.CylinderGeometry(0.45, 0.12, 0.22, 10)),
              dishMat
            );
            dish.position.set(bx - side * 0.8, h + 0.52, bz - 1.5);
            dish.rotation.set(0.65, side * -0.4, 0);
            g.add(dish);
          }
        }

        // Ground-floor boutique awning + slender support poles
        const aMat = seed % 3 === 0 ? awningRed : seed % 3 === 1 ? awningGreen : awningGold;
        const awning = new THREE.Mesh(
          this.geo(`awn_${d}`, () => new THREE.BoxGeometry(1.75, 0.12, d * 0.78)),
          aMat
        );
        const frontWallX = bx - side * (w * 0.5);
        awning.position.set(frontWallX - side * 0.85, 2.75, bz);
        awning.rotation.z = side * -0.22;
        g.add(awning);

        const poleGeo = this.geo('awn_pole', () => new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6));
        for (const pz of [bz - d * 0.34, bz + d * 0.34]) {
          const ap = new THREE.Mesh(poleGeo, poleMat);
          ap.position.set(frontWallX - side * 1.62, 1.3, pz);
          g.add(ap);
        }

        // Street-level terracotta water jars / crates near shop entrance
        const jar = new THREE.Mesh(
          this.geo('street_jar', () => new THREE.SphereGeometry(0.28, 8, 6)),
          terracottaMat
        );
        jar.scale.set(1, 1.2, 1);
        jar.position.set(frontWallX - side * 0.7, 0.34, bz - 2.4);
        g.add(jar);
      }

      // Courtyard compound wall bridging the gap between the 2 buildings
      const compoundWall = new THREE.Mesh(
        this.geo('compound_wall', () => new THREE.BoxGeometry(0.45, 2.15, 3.8)),
        wallCompoundMat
      );
      compoundWall.position.set(side * 10.1, 1.07, 0);
      g.add(compoundWall);

      // Streetlight (Lampadaire) + Roadside Utility Wire along the sidewalk curb
      const lampZ = side > 0 ? 5.2 : -5.2;
      const lampPost = new THREE.Mesh(
        this.geo('lamp_post', () => new THREE.CylinderGeometry(0.065, 0.095, 5.2, 6)),
        poleMat
      );
      lampPost.position.set(side * 5.05, 2.6, lampZ);
      g.add(lampPost);

      const lampArm = new THREE.Mesh(
        this.geo('lamp_arm', () => new THREE.BoxGeometry(1.15, 0.08, 0.08)),
        poleMat
      );
      lampArm.position.set(side * 4.55, 5.15, lampZ);
      g.add(lampArm);

      const lampHead = new THREE.Mesh(
        this.geo('lamp_head', () => new THREE.BoxGeometry(0.38, 0.1, 0.22)),
        lampBulbMat
      );
      lampHead.position.set(side * 4.08, 5.08, lampZ);
      g.add(lampHead);

      // Overhead power cable running cleanly along sidewalk utility corridor
      const wire = new THREE.Mesh(
        this.geo(`wire_${length}`, () => new THREE.BoxGeometry(0.035, 0.035, length)),
        wireMat
      );
      wire.position.set(side * 5.05, 5.12, 0);
      g.add(wire);

      // Alternating Palm Trees & Lush Neem Shade Trees along sidewalks
      const treeZ = side > 0 ? -4.5 : 4.5;
      const useNeem = (chunkIndex + (side > 0 ? 1 : 0)) % 2 === 1;
      const tree = useNeem
        ? this.createNeemTree(0.88 + (chunkIndex % 3) * 0.08)
        : this.createPalmTree(0.95 + ((chunkIndex + (side > 0 ? 1 : 0)) % 3) * 0.12);
      tree.position.set(side * 6.35, 0.15, treeZ);
      g.add(tree);
      trees.push(tree);

      // Background skyline silhouette blocks for deep urban vista
      const bgH = 7.5 + ((chunkIndex * 5 + (side > 0 ? 2 : 0)) % 5) * 2.2;
      const bgBlock = new THREE.Mesh(
        this.geo(`bg_block_${bgH.toFixed(1)}`, () => new THREE.BoxGeometry(7, bgH, 13)),
        distantMat
      );
      bgBlock.position.set(side * 24.5, bgH * 0.5, (side > 0 ? -3 : 3));
      g.add(bgBlock);
    }
    g.userData.trees = trees;

    // 5. Overhead Ouagadougou Boulevard Sign Gantry ("ROOD-WOKO" / "OUAGA 2000") every 3 chunks
    if (chunkIndex % 3 === 0) {
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(
          this.geo('gantry_post', () => new THREE.CylinderGeometry(0.14, 0.18, 7.2, 6)),
          poleMat
        );
        post.position.set(side * 5.2, 3.6, 0);
        g.add(post);
      }

      const crossbar = new THREE.Mesh(
        this.geo('gantry_bar', () => new THREE.BoxGeometry(10.8, 0.22, 0.22)),
        poleMat
      );
      crossbar.position.set(0, 7.05, 0);
      g.add(crossbar);

      const signTex =
        chunkIndex % 6 === 0 ? this.roodWokoSignTexture : this.ouaga2000SignTexture;
      const signMat = this.trackMat(
        new THREE.MeshBasicMaterial({
          map: signTex,
        })
      );
      const signBoard = new THREE.Mesh(
        this.geo('gantry_board', () => new THREE.BoxGeometry(6.8, 1.65, 0.24)),
        signMat
      );
      signBoard.position.set(0, 6.55, 0);
      g.add(signBoard);
    }

    return g;
  }

  public dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.geometries = [];
    this.materials = [];
    this.textures = [];
    this.materialCache.clear();
    this.boxCache.clear();
    this.geoCache.clear();
  }
}
