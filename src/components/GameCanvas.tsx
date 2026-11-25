import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GameEngine3D } from '../game/engine3d';
import { AssetLibrary3D, SceneryChunk, ThiefRig } from '../game/models3d';
import { PLAYER_COLORS, RemoteRunnerPose, RoomPlayerInfo } from '../game/multiplayerTypes';
import { CharacterId, OutfitId } from '../game/shop';
import { soundEngine } from '../game/sound';
import { CollectibleKind, GameState, HudSnapshot, ObstacleKind } from '../game/types';

export interface MultiplayerCanvasConfig {
  active: boolean;
  seed: number;
  localPlayerId: string;
  players: RoomPlayerInfo[];
  remotePosesRef: React.MutableRefObject<Map<string, RemoteRunnerPose>>;
  onSendPose: (pose: Omit<RemoteRunnerPose, 'playerId' | 'ts'>) => void;
}

export interface GameCanvasHandle {
  moveLeft: () => void;
  moveRight: () => void;
  jump: () => void;
  slide: () => void;
  activateSpeedJuice: (
    label: string,
    durationSec: number,
    speedBonus: number,
    policePushback: number
  ) => boolean;
  activateProtection: (label: string, charges: number, invincibleBonusSec: number) => boolean;
}

interface GameCanvasProps {
  gameState: GameState;
  startLevel: number;
  runKey: number;
  characterId: CharacterId;
  outfitId: OutfitId;
  pausedByModal?: boolean;
  isFrozen?: boolean;
  isTutorial?: boolean;
  multiplayer?: MultiplayerCanvasConfig;
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onLevelComplete: (finalSnapshot: HudSnapshot) => void;
  onGameOver: (finalSnapshot: HudSnapshot) => void;
  onTogglePause: () => void;
  onScreenTap?: () => void;
  onTutorialAction?: (action: 'left' | 'right' | 'jump' | 'slide') => void;
}

// Pre-allocated colors & helpers (zero per-frame GC allocations)
const _skyDay = new THREE.Color(0x38bdf8);
const _skySunset = new THREE.Color(0xf97316);
const _skyDusk = new THREE.Color(0x9a3412);
const _fogDay = new THREE.Color(0xbae6fd);
const _fogSunset = new THREE.Color(0xfdba74);
const _fogDusk = new THREE.Color(0xea580c);
const _sunDayColor = new THREE.Color(0xfef08a);
const _sunSunsetColor = new THREE.Color(0xfde047);

// Dynamic Ouagadougou weather target colors (pre-allocated, zero GC)
const _skySunIntense = new THREE.Color(0x60c8ff);
const _fogSunIntense = new THREE.Color(0xfef3c7);
const _sunBlazeColor = new THREE.Color(0xffffff);

const _skyHarmattan = new THREE.Color(0xc99361);
const _fogHarmattan = new THREE.Color(0xd6a575);
const _sunHarmattanColor = new THREE.Color(0xfde6ba);

const _skyRain = new THREE.Color(0x334155);
const _fogRain = new THREE.Color(0x64748b);
const _skyLightning = new THREE.Color(0xcbd5e1);
const _sunRainColor = new THREE.Color(0x94a3b8);

const _activeSky = new THREE.Color();
const _activeFog = new THREE.Color();
const _activeSun = new THREE.Color();

const _hemiSkyNoon = new THREE.Color(0xe0f2fe);
const _hemiSkySunset = new THREE.Color(0xfed7aa);
const _hemiSkyRain = new THREE.Color(0x94a3b8);
const _hemiGroundDry = new THREE.Color(0xb4532a);
const _hemiGroundRain = new THREE.Color(0x475569);
const _activeHemiSky = new THREE.Color();
const _activeHemiGround = new THREE.Color();
const _roadDryColor = new THREE.Color(0xffffff);
const _roadWetColor = new THREE.Color(0xb8bcc2);

const CHUNK_LENGTH = 24;
const CHUNK_COUNT = 7;

function createSoftCircleTexture(innerRgba: string, outerRgba: string, size: number = 32): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, innerRgba);
    grad.addColorStop(0.5, innerRgba);
    grad.addColorStop(1, outerRgba);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function isSoftwareRenderer(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    return /SwiftShader|llvmpipe|softpipe/i.test(gpu);
  } catch {
    return false;
  }
}

export const GameCanvas = React.forwardRef<GameCanvasHandle, GameCanvasProps>(
  (
    {
      gameState,
      startLevel,
      runKey,
      characterId,
      outfitId,
      pausedByModal = false,
      isFrozen = false,
      isTutorial = false,
      multiplayer,
      onHudUpdate,
      onLevelComplete,
      onGameOver,
      onTogglePause,
      onScreenTap,
      onTutorialAction,
    },
    ref
  ) => {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const engineRef = useRef<GameEngine3D>(new GameEngine3D(startLevel, characterId));
    const stateRef = useRef<GameState>(gameState);
    const gameOverNotifiedRef = useRef<boolean>(false);
    const levelCompleteNotifiedRef = useRef<boolean>(false);
    const mpSig = multiplayer?.active ? `mp:${multiplayer.seed}` : 'solo';
    const appliedRunSigRef = useRef<string>(`${runKey}:${startLevel}:${characterId}:${mpSig}`);

    const sceneRef = useRef<THREE.Scene | null>(null);
    const assetsRef = useRef<AssetLibrary3D | null>(null);
    const thiefRef = useRef<ThiefRig | null>(null);
    const remoteRigsRef = useRef<
      Map<
        string,
        {
          rig: ThiefRig;
          x: number;
          y: number;
          relZ: number;
          wasAlive: boolean;
        }
      >
    >(new Map());
    const characterIdRef = useRef<CharacterId>(characterId);
    const outfitIdRef = useRef<OutfitId>(outfitId);
    const pausedByModalRef = useRef<boolean>(pausedByModal);
    const isFrozenRef = useRef<boolean>(isFrozen);
    const isTutorialRef = useRef<boolean>(isTutorial);
    const onScreenTapRef = useRef<typeof onScreenTap>(onScreenTap);
    const onTutorialActionRef = useRef<typeof onTutorialAction>(onTutorialAction);
    const multiplayerRef = useRef<MultiplayerCanvasConfig | undefined>(multiplayer);

    characterIdRef.current = characterId;
    outfitIdRef.current = outfitId;
    pausedByModalRef.current = pausedByModal;
    isFrozenRef.current = isFrozen;
    isTutorialRef.current = isTutorial;
    onScreenTapRef.current = onScreenTap;
    onTutorialActionRef.current = onTutorialAction;
    multiplayerRef.current = multiplayer;

    const localPlayerInfo = multiplayer?.active
      ? multiplayer.players.find((p) => p.id === multiplayer.localPlayerId)
      : undefined;
    const localColorSlot = localPlayerInfo ? PLAYER_COLORS[localPlayerInfo.slot] : undefined;
    const localBadgeKey =
      localPlayerInfo && localColorSlot
        ? `${localPlayerInfo.name}:${localColorSlot.hex}:${localColorSlot.int}`
        : 'solo';
    const localBadgeRef = useRef<
      { name: string; colorHex: string; colorInt: number; textHex?: string } | undefined
    >(undefined);
    localBadgeRef.current =
      localPlayerInfo && localColorSlot
        ? {
            name: localPlayerInfo.name,
            colorHex: localColorSlot.hex,
            colorInt: localColorSlot.int,
            textHex: localColorSlot.textHex,
          }
        : undefined;

    const remotePlayersList = multiplayer?.active
      ? multiplayer.players.filter((p) => p.id !== multiplayer.localPlayerId)
      : [];
    const remotePlayersKey = multiplayer?.active
      ? `${multiplayer.seed}|${remotePlayersList
          .map((p) => `${p.id}:${p.name}:${p.characterId}:${p.outfitId}:${p.slot}`)
          .join(',')}`
      : 'solo';

    const touchStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
    const touchHandledRef = useRef<boolean>(false);
    const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
    const [contextLost, setContextLost] = useState<boolean>(false);

    stateRef.current = gameState;

    const nextRunSig = `${runKey}:${startLevel}:${characterId}:${mpSig}`;
    if (appliedRunSigRef.current !== nextRunSig) {
      appliedRunSigRef.current = nextRunSig;
      gameOverNotifiedRef.current = false;
      levelCompleteNotifiedRef.current = false;
      engineRef.current.reset(startLevel, characterId, {
        seed: multiplayer?.active ? multiplayer.seed : undefined,
        isMultiplayer: Boolean(multiplayer?.active),
      });
    }

    const wasTutorialRef = useRef<boolean>(isTutorial);
    useEffect(() => {
      if (wasTutorialRef.current && !isTutorial && stateRef.current === 'TITLE_MENU') {
        engineRef.current.reset(startLevel, characterId, {
          seed: multiplayerRef.current?.active ? multiplayerRef.current.seed : undefined,
          isMultiplayer: Boolean(multiplayerRef.current?.active),
        });
      }
      wasTutorialRef.current = isTutorial;
    }, [isTutorial, startLevel, characterId]);

    const canControlRunner = () =>
      (stateRef.current === 'PLAYING' && !isFrozenRef.current) ||
      (stateRef.current === 'TITLE_MENU' && isTutorialRef.current);

    useImperativeHandle(ref, () => ({
      moveLeft: () => {
        if (!canControlRunner()) return;
        soundEngine.unlock();
        engineRef.current.moveLeft();
        if (stateRef.current === 'TITLE_MENU' && isTutorialRef.current) {
          onTutorialActionRef.current?.('left');
        }
      },
      moveRight: () => {
        if (!canControlRunner()) return;
        soundEngine.unlock();
        engineRef.current.moveRight();
        if (stateRef.current === 'TITLE_MENU' && isTutorialRef.current) {
          onTutorialActionRef.current?.('right');
        }
      },
      jump: () => {
        if (!canControlRunner()) return;
        soundEngine.unlock();
        engineRef.current.triggerJump();
        if (stateRef.current === 'TITLE_MENU' && isTutorialRef.current) {
          onTutorialActionRef.current?.('jump');
        }
      },
      slide: () => {
        if (!canControlRunner()) return;
        soundEngine.unlock();
        engineRef.current.triggerSlide();
        if (stateRef.current === 'TITLE_MENU' && isTutorialRef.current) {
          onTutorialActionRef.current?.('slide');
        }
      },
      activateSpeedJuice: (label, durationSec, speedBonus, policePushback) => {
        if (stateRef.current !== 'PLAYING') return false;
        soundEngine.unlock();
        const ok = engineRef.current.activateSpeedJuice(
          label,
          durationSec,
          speedBonus,
          policePushback
        );
        if (ok) onHudUpdate(engineRef.current.getHudSnapshot());
        return ok;
      },
      activateProtection: (label, charges, invincibleBonusSec) => {
        if (stateRef.current !== 'PLAYING') return false;
        soundEngine.unlock();
        const ok = engineRef.current.activateProtection(label, charges, invincibleBonusSec);
        if (ok) onHudUpdate(engineRef.current.getHudSnapshot());
        return ok;
      },
    }));

    // Sync HUD snapshot after a new run, starting level, or character change commits
    useEffect(() => {
      onHudUpdate(engineRef.current.getHudSnapshot());
    }, [startLevel, runKey, characterId, mpSig, onHudUpdate]);

    // Swap 3D character / outfit / multiplayer badge live in the scene without tearing down WebGL
    useEffect(() => {
      const scene = sceneRef.current;
      const assets = assetsRef.current;
      if (!scene || !assets) return;

      if (thiefRef.current) {
        thiefRef.current.disposeUnique?.();
        scene.remove(thiefRef.current.root);
      }
      const nextThief = assets.createThief(characterId, outfitId, localBadgeRef.current);
      scene.add(nextThief.root);
      thiefRef.current = nextThief;
    }, [characterId, outfitId, localBadgeKey]);

    const syncRemoteRigsRef = useRef<() => void>(() => {});
    syncRemoteRigsRef.current = () => {
      const scene = sceneRef.current;
      const assets = assetsRef.current;
      if (!scene || !assets) return;

      for (const entry of remoteRigsRef.current.values()) {
        entry.rig.disposeUnique?.();
        scene.remove(entry.rig.root);
      }
      remoteRigsRef.current.clear();

      const mp = multiplayerRef.current;
      if (!mp || !mp.active) return;

      const remotes = mp.players.filter((p) => p.id !== mp.localPlayerId);
      remotes.forEach((p, idx) => {
        const slotColor = PLAYER_COLORS[p.slot] ?? PLAYER_COLORS[0];
        const rig = assets.createThief(p.characterId, p.outfitId, {
          name: p.name,
          colorHex: slotColor.hex,
          colorInt: slotColor.int,
          textHex: slotColor.textHex,
        });
        // Slight lateral offset at spawn so runners are immediately visible side-by-side
        const initialX = (idx - (remotes.length - 1) / 2) * 0.85;
        rig.root.position.set(initialX, 0, -0.8);
        scene.add(rig.root);
        remoteRigsRef.current.set(p.id, {
          rig,
          x: initialX,
          y: 0,
          relZ: -0.8,
          wasAlive: true,
        });
      });
    };

    useEffect(() => {
      syncRemoteRigsRef.current();
    }, [remotePlayersKey]);

    // Keyboard controls (3-lane runner)
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
        ) {
          return;
        }

        if (e.code === 'KeyP' || e.code === 'Escape') {
          if (stateRef.current === 'PLAYING' || stateRef.current === 'PAUSED') {
            e.preventDefault();
            onTogglePause();
          }
          return;
        }

        if (!canControlRunner() || e.repeat) return;

        const notifyTutorial = (action: 'left' | 'right' | 'jump' | 'slide') => {
          if (stateRef.current === 'TITLE_MENU' && isTutorialRef.current) {
            onTutorialActionRef.current?.(action);
          }
        };

        if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyQ') {
          e.preventDefault();
          soundEngine.unlock();
          engineRef.current.moveLeft();
          notifyTutorial('left');
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          e.preventDefault();
          soundEngine.unlock();
          engineRef.current.moveRight();
          notifyTutorial('right');
        } else if (
          e.code === 'Space' ||
          e.code === 'ArrowUp' ||
          e.code === 'KeyW' ||
          e.code === 'KeyZ'
        ) {
          e.preventDefault();
          soundEngine.unlock();
          engineRef.current.triggerJump();
          notifyTutorial('jump');
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          e.preventDefault();
          soundEngine.unlock();
          engineRef.current.triggerSlide();
          notifyTutorial('slide');
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onTogglePause]);

    // Main Three.js WebGL Lifecycle & Render Loop
    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;

      const width = Math.max(320, mount.clientWidth || window.innerWidth);
      const height = Math.max(240, mount.clientHeight || window.innerHeight);
      const isTouchViewport =
        width < 900 ||
        (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) ||
        (typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 4) <= 4);

      const renderer = new THREE.WebGLRenderer({
        antialias: !isTouchViewport,
        powerPreference: 'high-performance',
        stencil: false,
      });
      const isSoftwareGl = isSoftwareRenderer(renderer);
      const isLowPowerGpu = isSoftwareGl || isTouchViewport;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.setPixelRatio(
        isLowPowerGpu ? 1 : Math.min(window.devicePixelRatio || 1, 1.35)
      );
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = !isLowPowerGpu && width >= 900;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      mount.appendChild(renderer.domElement);

      const onContextLost = (e: Event) => {
        e.preventDefault();
        setContextLost(true);
      };
      const onContextRestored = () => {
        setContextLost(false);
      };
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x38bdf8);
      scene.fog = new THREE.Fog(0xbae6fd, 62, 158);
      sceneRef.current = scene;

      // Studio IBL environment map for metallic sheen on desktop GPUs (skipped on mobile GPUs for steady 60fps)
      let envRT: THREE.WebGLRenderTarget | null = null;
      if (!isLowPowerGpu) {
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
        scene.environment = envRT.texture;
        pmremGenerator.dispose();
      }

      const aspect = width / height;
      const computeResponsiveFov = (asp: number) =>
        asp < 1.05 ? Math.min(82, 56 / Math.pow(asp, 0.42)) : 56;

      const camera = new THREE.PerspectiveCamera(computeResponsiveFov(aspect), aspect, 0.3, 190);
      camera.position.set(0, 5.35, 10.6);
      camera.lookAt(0, 1.35, -15);

      // Warm Sahelian Sunlight + Cool Sky/Laterite Fill
      const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0xb4532a, 1.05);
      scene.add(hemiLight);

      const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.75);
      sunLight.position.set(16, 26, 14);
      if (renderer.shadowMap.enabled) {
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(1024, 1024);
        sunLight.shadow.camera.near = 2;
        sunLight.shadow.camera.far = 65;
        sunLight.shadow.camera.left = -14;
        sunLight.shadow.camera.right = 14;
        sunLight.shadow.camera.top = 18;
        sunLight.shadow.camera.bottom = -14;
        sunLight.shadow.bias = -0.0005;
      }
      scene.add(sunLight);

      // Build Low-Poly 3D Asset Library (shared geometries & materials)
      const assets = new AssetLibrary3D(
        isLowPowerGpu ? 1 : renderer.capabilities.getMaxAnisotropy()
      );
      if (isLowPowerGpu) {
        assets.roadMat.bumpMap = null;
        assets.roadMat.needsUpdate = true;
      }
      assetsRef.current = assets;

      // Sun Disc + Intense Sun Glare Halo on Horizon
      const sunDiscMat = assets.trackMat(
        new THREE.MeshBasicMaterial({ color: 0xfef08a, fog: false })
      );
      const sunDisc = new THREE.Mesh(
        assets.trackGeo(new THREE.CircleGeometry(10.5, 20)),
        sunDiscMat
      );
      sunDisc.position.set(18, 28, -135);
      scene.add(sunDisc);

      const haloTex = createSoftCircleTexture('rgba(255, 248, 205, 0.72)', 'rgba(255, 230, 140, 0)', 64);
      const sunHaloMat = assets.trackMat(
        new THREE.MeshBasicMaterial({
          map: haloTex,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        })
      );
      const sunHalo = new THREE.Mesh(
        assets.trackGeo(new THREE.PlaneGeometry(54, 54)),
        sunHaloMat
      );
      sunHalo.position.set(18, 28, -136);
      scene.add(sunHalo);

      // 1-Draw-Call Slanted Rain Streaks (PLUIE)
      const RAIN_COUNT = 120;
      const rainPositions = new Float32Array(RAIN_COUNT * 6);
      const rainVelocities = new Float32Array(RAIN_COUNT);
      for (let i = 0; i < RAIN_COUNT; i++) {
        const rx = (Math.random() - 0.5) * 20;
        const ry = Math.random() * 14;
        const rz = -38 + Math.random() * 50;
        rainVelocities[i] = 24 + Math.random() * 10;
        const idx = i * 6;
        rainPositions[idx] = rx;
        rainPositions[idx + 1] = ry;
        rainPositions[idx + 2] = rz;
        rainPositions[idx + 3] = rx - 0.18;
        rainPositions[idx + 4] = ry + 1.05;
        rainPositions[idx + 5] = rz - 0.55;
      }
      const rainGeo = assets.trackGeo(new THREE.BufferGeometry());
      rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
      const rainMat = assets.trackMat(
        new THREE.LineBasicMaterial({
          color: 0xcbe7ff,
          transparent: true,
          opacity: 0.62,
          depthWrite: false,
          fog: false,
        })
      );
      const rainLines = new THREE.LineSegments(rainGeo, rainMat);
      rainLines.frustumCulled = false;
      rainLines.visible = false;
      scene.add(rainLines);

      // 1-Draw-Call Harmattan Swirling Dust Particles (HARMATTAN)
      const DUST_COUNT = 140;
      const dustPositions = new Float32Array(DUST_COUNT * 3);
      const dustSeeds = new Float32Array(DUST_COUNT);
      for (let i = 0; i < DUST_COUNT; i++) {
        dustPositions[i * 3] = (Math.random() - 0.5) * 24;
        dustPositions[i * 3 + 1] = 0.25 + Math.random() * 8.5;
        dustPositions[i * 3 + 2] = -44 + Math.random() * 56;
        dustSeeds[i] = Math.random() * Math.PI * 2;
      }
      const dustGeo = assets.trackGeo(new THREE.BufferGeometry());
      dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
      const dustTex = createSoftCircleTexture('rgba(235, 195, 145, 0.85)', 'rgba(214, 165, 117, 0)', 32);
      const dustMat = assets.trackMat(
        new THREE.PointsMaterial({
          size: 0.95,
          map: dustTex,
          color: 0xe6b885,
          transparent: true,
          opacity: 0.52,
          depthWrite: false,
          fog: false,
        })
      );
      const dustPoints = new THREE.Points(dustGeo, dustMat);
      dustPoints.frustumCulled = false;
      dustPoints.visible = false;
      scene.add(dustPoints);

      // Scenery Chunks Pool (reused infinitely)
      const chunks: SceneryChunk[] = [];
      for (let i = 0; i < CHUNK_COUNT; i++) {
        const group = assets.createSceneryChunk(i, CHUNK_LENGTH);
        const z = -i * CHUNK_LENGTH;
        group.position.z = z;
        scene.add(group);
        chunks.push({ group, z });
      }

      // Hero Thief + Pursuer Police Motorcycle + Any Active Multiplayer Runners
      const initialThief = assets.createThief(
        characterIdRef.current,
        outfitIdRef.current,
        localBadgeRef.current
      );
      scene.add(initialThief.root);
      thiefRef.current = initialThief;
      syncRemoteRigsRef.current();

      const police = assets.createPoliceMoto();
      police.root.position.set(0, 0, 3.3);
      scene.add(police.root);

      // Object Pools for Obstacles, Collectibles & Dust Particles (Zero per-frame allocation)
      const obstaclePools = new Map<ObstacleKind, THREE.Group[]>();
      const activeObstacles = new Map<number, { kind: ObstacleKind; group: THREE.Group }>();

      const collectiblePools = new Map<CollectibleKind, THREE.Group[]>();
      const activeCollectibles = new Map<number, { kind: CollectibleKind; group: THREE.Group }>();

      const acquireObstacle = (kind: ObstacleKind): THREE.Group => {
        const pool = obstaclePools.get(kind);
        if (pool && pool.length > 0) {
          const g = pool.pop()!;
          g.visible = true;
          return g;
        }
        const g = assets.createObstacleGroup(kind);
        scene.add(g);
        return g;
      };

      const releaseObstacle = (kind: ObstacleKind, group: THREE.Group) => {
        group.visible = false;
        let pool = obstaclePools.get(kind);
        if (!pool) {
          pool = [];
          obstaclePools.set(kind, pool);
        }
        pool.push(group);
      };

      const acquireCollectible = (kind: CollectibleKind): THREE.Group => {
        const pool = collectiblePools.get(kind);
        if (pool && pool.length > 0) {
          const g = pool.pop()!;
          g.visible = true;
          return g;
        }
        const g = assets.createCollectibleGroup(kind);
        scene.add(g);
        return g;
      };

      const releaseCollectible = (kind: CollectibleKind, group: THREE.Group) => {
        group.visible = false;
        let pool = collectiblePools.get(kind);
        if (!pool) {
          pool = [];
          collectiblePools.set(kind, pool);
        }
        pool.push(group);
      };

      // Pre-allocated Particle Mesh Pool (48 small cubes)
      const PARTICLE_POOL_SIZE = 48;
      const particleGeo = assets.trackGeo(new THREE.BoxGeometry(1, 1, 1));
      const particleMeshes: THREE.Mesh[] = [];
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const pMat = assets.trackMat(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
        const pMesh = new THREE.Mesh(particleGeo, pMat);
        pMesh.visible = false;
        scene.add(pMesh);
        particleMeshes.push(pMesh);
      }

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      // Pre-allocated Set buffers for zero-GC obstacle/collectible sync
      const aliveObsIds = new Set<number>();
      const aliveCoinIds = new Set<number>();

      // Handle Container Resize
      const handleResize = () => {
        if (!mount) return;
        const w = Math.max(320, mount.clientWidth || window.innerWidth);
        const h = Math.max(240, mount.clientHeight || window.innerHeight);
        const asp = w / h;
        camera.aspect = asp;
        camera.fov = computeResponsiveFov(asp);
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(
          isLowPowerGpu ? 1 : Math.min(window.devicePixelRatio || 1, 1.35)
        );
        renderer.setSize(w, h);
      };
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(mount);

      // Animation Loop with Software-WebGL GPU Sync Pacing
      let frameId = 0;
      let disposed = false;
      let lastTime = performance.now();
      let hudAccumulator = 0;
      let camX = 0;
      let camY = 5.35;
      let camRoll = 0;

      const afterDraw = (cb: () => void) => {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (!gl || !gl.fenceSync) {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      };

      const syncSceneToEngine = (dt: number) => {
        const engine = engineRef.current;

        // 1. Sky, Sunset & Dynamic Quartier Weather (Soleil intense / Harmattan / Pluie)
        const tod = engine.timeOfDay;
        if (tod < 0.45) {
          const t = tod / 0.45;
          _activeSky.copy(_skyDay).lerp(_skySunset, t * 0.35);
          _activeFog.copy(_fogDay).lerp(_fogSunset, t * 0.35);
          _activeSun.copy(_sunDayColor).lerp(_sunSunsetColor, t * 0.35);
          _activeHemiSky.copy(_hemiSkyNoon).lerp(_hemiSkySunset, t * 0.35);
          sunDisc.position.y = 32 - t * 12;
          sunLight.intensity = 1.75 - t * 0.1;
        } else if (tod < 0.8) {
          const t = (tod - 0.45) / 0.35;
          _activeSky.copy(_skyDay).lerp(_skySunset, 0.35 + t * 0.65);
          _activeFog.copy(_fogDay).lerp(_fogSunset, 0.35 + t * 0.65);
          _activeSun.copy(_sunDayColor).lerp(_sunSunsetColor, 0.35 + t * 0.65);
          _activeHemiSky.copy(_hemiSkyNoon).lerp(_hemiSkySunset, 0.35 + t * 0.65);
          sunDisc.position.y = 20 - t * 13;
          sunLight.intensity = 1.65 - t * 0.15;
        } else {
          const t = (tod - 0.8) / 0.2;
          _activeSky.copy(_skySunset).lerp(_skyDusk, t * 0.45).lerp(_skyDay, Math.max(0, t - 0.6) * 2.5);
          _activeFog.copy(_fogSunset).lerp(_fogDusk, t * 0.45).lerp(_fogDay, Math.max(0, t - 0.6) * 2.5);
          _activeSun.copy(_sunSunsetColor).lerp(_sunDayColor, t);
          _activeHemiSky.copy(_hemiSkySunset).lerp(_hemiSkyNoon, Math.max(0, t - 0.4) * 1.65);
          sunDisc.position.y = 7 + t * 25;
          sunLight.intensity = 1.5 + t * 0.25;
        }
        _activeHemiGround.copy(_hemiGroundDry);
        sunLight.position.set(16 - tod * 14, 28 - Math.sin(tod * Math.PI) * 10, 14 - tod * 10);

        const wKind = engine.weather;
        const wInt = engine.weatherIntensity;
        const linearFog = scene.fog as THREE.Fog;

        if (wKind === 'PLUIE') {
          _activeSky.lerp(_skyRain, 0.72 + wInt * 0.18);
          _activeFog.lerp(_fogRain, 0.74 + wInt * 0.2);
          _activeSun.lerp(_sunRainColor, 0.8);
          _activeHemiSky.lerp(_hemiSkyRain, 0.75);
          _activeHemiGround.lerp(_hemiGroundRain, 0.65 + wInt * 0.25);
          if (engine.lightningFlash > 0) {
            _activeSky.lerp(_skyLightning, engine.lightningFlash * 0.62);
            _activeFog.lerp(_skyLightning, engine.lightningFlash * 0.48);
          }
          sunLight.intensity = 0.92 + engine.lightningFlash * 1.35;
          hemiLight.intensity = 0.82 + engine.lightningFlash * 0.55;
          renderer.toneMappingExposure = 0.96 + engine.lightningFlash * 0.22;
          assets.roadMat.roughness = THREE.MathUtils.lerp(0.52, 0.22, wInt);
          assets.roadMat.envMapIntensity = 1.45;
          assets.roadMat.color.copy(_roadDryColor).lerp(_roadWetColor, 0.65 + wInt * 0.35);
          if (linearFog) {
            linearFog.near = 33 - wInt * 12;
            linearFog.far = 92 - wInt * 26;
          }
          sunDisc.visible = false;
          sunHalo.visible = false;

          rainLines.visible = true;
          dustPoints.visible = false;
          rainMat.opacity = 0.42 + wInt * 0.36;
          const posAttr = rainGeo.getAttribute('position') as THREE.BufferAttribute;
          const arr = posAttr.array as Float32Array;
          const windX = -3.8 - wInt * 3.2;
          const forwardZ = engine.speed * 0.65;
          for (let i = 0; i < RAIN_COUNT; i++) {
            const idx = i * 6;
            const fallY = rainVelocities[i] * (0.85 + wInt * 0.35) * dt;
            let x = arr[idx] + windX * dt;
            let y = arr[idx + 1] - fallY;
            let z = arr[idx + 2] + forwardZ * dt;
            if (y < 0 || z > 12) {
              x = (Math.random() - 0.5) * 20;
              y = 11.5 + Math.random() * 3.5;
              z = -38 + Math.random() * 44;
            }
            if (x < -11) x += 22;
            arr[idx] = x;
            arr[idx + 1] = y;
            arr[idx + 2] = z;
            arr[idx + 3] = x - windX * 0.042;
            arr[idx + 4] = y + 1.05;
            arr[idx + 5] = z - 0.55;
          }
          posAttr.needsUpdate = true;
        } else if (wKind === 'HARMATTAN') {
          _activeSky.lerp(_skyHarmattan, 0.58 + wInt * 0.32);
          _activeFog.lerp(_fogHarmattan, 0.65 + wInt * 0.3);
          _activeSun.lerp(_sunHarmattanColor, 0.65);
          _activeHemiSky.lerp(_fogHarmattan, 0.45);
          sunLight.intensity = 1.38 - wInt * 0.28;
          hemiLight.intensity = 1.02;
          renderer.toneMappingExposure = 1.03;
          assets.roadMat.roughness = 0.94;
          assets.roadMat.envMapIntensity = 0.65;
          assets.roadMat.color.copy(_roadDryColor);
          if (linearFog) {
            linearFog.near = 28 - wInt * 10;
            linearFog.far = 84 - wInt * 24;
          }
          sunDisc.visible = true;
          sunHalo.visible = true;
          sunHaloMat.opacity = 0.24 + wInt * 0.16;
          sunHalo.scale.setScalar(1.0);

          rainLines.visible = false;
          dustPoints.visible = true;
          dustMat.opacity = 0.35 + wInt * 0.35;
          dustMat.size = 0.8 + wInt * 0.45;
          const posAttr = dustGeo.getAttribute('position') as THREE.BufferAttribute;
          const arr = posAttr.array as Float32Array;
          const gustX = -5.5 - wInt * 5.2;
          const driftZ = (engine.speed * 0.55 + 4);
          for (let i = 0; i < DUST_COUNT; i++) {
            const idx = i * 3;
            const seed = dustSeeds[i];
            let x = arr[idx] + (gustX + Math.sin(engine.weatherTime * 2.1 + seed) * 1.8) * dt;
            let y = arr[idx + 1] + Math.cos(engine.weatherTime * 1.7 + seed) * 0.85 * dt;
            let z = arr[idx + 2] + driftZ * dt;
            if (x < -12) x += 24;
            if (y < 0.2) y = 7.5;
            if (y > 9.0) y = 0.5;
            if (z > 12) {
              z = -44 + Math.random() * 14;
              x = (Math.random() - 0.5) * 24;
              y = 0.3 + Math.random() * 8.2;
            }
            arr[idx] = x;
            arr[idx + 1] = y;
            arr[idx + 2] = z;
          }
          posAttr.needsUpdate = true;
        } else {
          // SOLEIL_INTENSE: blazing noon/afternoon sun glare + horizon heat haze
          _activeSky.lerp(_skySunIntense, 0.35 + wInt * 0.25);
          _activeFog.lerp(_fogSunIntense, 0.35 + wInt * 0.42);
          _activeSun.lerp(_sunBlazeColor, wInt * 0.45);
          sunLight.intensity = 1.95 + wInt * 0.55;
          hemiLight.intensity = 1.12 + wInt * 0.14;
          renderer.toneMappingExposure = 1.09 + wInt * 0.16;
          assets.roadMat.roughness = 0.85;
          assets.roadMat.envMapIntensity = 0.82;
          assets.roadMat.color.copy(_roadDryColor);
          if (linearFog) {
            linearFog.near = 44 - wInt * 12;
            linearFog.far = 122 - wInt * 24;
          }
          sunDisc.visible = true;
          sunHalo.visible = true;
          sunHaloMat.opacity = 0.42 + wInt * 0.42;
          sunHalo.scale.setScalar(1.0 + wInt * 0.55);

          rainLines.visible = false;
          dustPoints.visible = false;
        }

        assets.lampBulbMat.emissiveIntensity = wKind === 'PLUIE' || tod > 0.55 ? 2.6 : 0.9;
        hemiLight.color.copy(_activeHemiSky);
        hemiLight.groundColor.copy(_activeHemiGround);
        sunHalo.position.y = sunDisc.position.y;
        (scene.background as THREE.Color).copy(_activeSky);
        if (scene.fog) scene.fog.color.copy(_activeFog);
        sunDiscMat.color.copy(_activeSun);
        sunLight.color.copy(_activeSun);

        // 2. Scroll Scenery Chunks infinitely toward +Z & sway roadside trees in the wind
        const totalTrackLen = CHUNK_COUNT * CHUNK_LENGTH;
        const scrollMod = engine.worldScroll % totalTrackLen;
        const windAmp = wKind === 'HARMATTAN' ? 0.055 : wKind === 'PLUIE' ? 0.048 : 0.018;
        for (let i = 0; i < CHUNK_COUNT; i++) {
          let z = -i * CHUNK_LENGTH + scrollMod;
          if (z > CHUNK_LENGTH) z -= totalTrackLen;
          const chunkGroup = chunks[i].group;
          chunkGroup.position.z = z;
          if (dt > 0) {
            const trees = chunkGroup.userData.trees as THREE.Object3D[] | undefined;
            if (trees) {
              for (let tIdx = 0; tIdx < trees.length; tIdx++) {
                trees[tIdx].rotation.z =
                  Math.sin(engine.weatherTime * 2.2 + i * 1.1 + tIdx * 0.7) * windAmp;
              }
            }
          }
        }

        // 3. Animate Hero Thief (character & outfit synced via thiefRef)
        const p = engine.player;
        const pol = engine.police;
        const thief = thiefRef.current;
        if (thief) {
          thief.root.position.set(p.x, 0, p.z);
          thief.shadow.scale.setScalar(Math.max(0.45, 1 - p.y * 0.18));

          if (engine.isLevelComplete) {
            thief.bodyGroup.position.y = p.y + 0.94 + Math.abs(Math.sin(pol.sirenPhase * 0.9)) * 0.08;
            thief.bodyGroup.rotation.set(0, 0, 0);
            thief.headGroup.rotation.set(-0.08, 0, 0);
            thief.leftLeg.rotation.x = 0.12;
            thief.rightLeg.rotation.x = -0.12;
            thief.leftKnee.rotation.x = 0.15;
            thief.rightKnee.rotation.x = 0.15;
            thief.leftArm.rotation.x = -2.4 + Math.sin(pol.sirenPhase * 1.4) * 0.18;
            thief.rightArm.rotation.x = -2.4 - Math.sin(pol.sirenPhase * 1.4) * 0.18;
            thief.leftForearm.rotation.x = -0.35;
            thief.rightForearm.rotation.x = -0.35;
            thief.bodyGroup.scale.set(1, 1, 1);
          } else if (p.isSliding) {
            // Forward roll / low slide under barrier
            thief.bodyGroup.position.y = p.y + 0.52;
            thief.bodyGroup.rotation.x = -p.rollProgress * Math.PI * 2;
            thief.bodyGroup.rotation.y = 0;
            thief.bodyGroup.rotation.z = -p.laneTilt * 0.5;
            thief.headGroup.rotation.set(0.25, 0, 0);
            thief.leftLeg.rotation.x = 0.85;
            thief.rightLeg.rotation.x = 0.85;
            thief.leftKnee.rotation.x = 0.95;
            thief.rightKnee.rotation.x = 0.95;
            thief.leftArm.rotation.x = -0.9;
            thief.rightArm.rotation.x = -0.9;
            thief.leftForearm.rotation.x = -0.8;
            thief.rightForearm.rotation.x = -0.8;
          } else if (!p.isGrounded) {
            // Big Jump pose!
            thief.bodyGroup.position.y = p.y + 0.92;
            thief.bodyGroup.rotation.x = THREE.MathUtils.clamp(-p.vy * 0.02, -0.25, 0.2);
            thief.bodyGroup.rotation.y = 0;
            thief.bodyGroup.rotation.z = -p.laneTilt;
            thief.headGroup.rotation.set(-0.1, 0, 0);
            thief.leftLeg.rotation.x = 0.62;
            thief.rightLeg.rotation.x = -0.35;
            thief.leftKnee.rotation.x = 0.85;
            thief.rightKnee.rotation.x = 0.42;
            thief.leftArm.rotation.x = -0.95;
            thief.rightArm.rotation.x = -0.75;
            thief.leftForearm.rotation.x = -0.7;
            thief.rightForearm.rotation.x = -0.7;
          } else {
            // Fluid athletic human running stride with shoulder twist, speed lean & head stabilization!
            const swing = Math.sin(p.runCycle);
            const bounce = Math.abs(Math.cos(p.runCycle)) * 0.11;
            const leanX = 0.16 + Math.min(0.14, Math.max(0, (engine.speed - 18) * 0.008));
            const yawTwist = swing * 0.09;
            thief.bodyGroup.position.y = p.y + 0.92 * p.squashY + bounce;
            thief.bodyGroup.scale.set(
              1 + (1 - p.squashY) * 0.3,
              p.squashY,
              1 + (1 - p.squashY) * 0.3
            );
            thief.bodyGroup.rotation.x = leanX;
            thief.bodyGroup.rotation.y = yawTwist;
            thief.bodyGroup.rotation.z = -p.laneTilt;
            thief.headGroup.rotation.x = -0.12 + Math.sin(p.runCycle * 2) * 0.03;
            thief.headGroup.rotation.y = -yawTwist;
            thief.leftLeg.rotation.x = swing * 0.9;
            thief.rightLeg.rotation.x = -swing * 0.9;
            // Knees flex naturally during backward push & forward knee lift (+X bends calf backward)
            thief.leftKnee.rotation.x = Math.max(0.08, -swing * 0.85 + 0.35);
            thief.rightKnee.rotation.x = Math.max(0.08, swing * 0.85 + 0.35);
            thief.leftArm.rotation.x = -swing * 0.82;
            thief.rightArm.rotation.x = swing * 0.82;
            // Elbows stay bent forward (-X bends forearm forward toward -Z)
            thief.leftForearm.rotation.x = -0.78 - Math.max(0, -swing) * 0.42;
            thief.rightForearm.rotation.x = -0.78 - Math.max(0, swing) * 0.42;
          }

          if (p.isSliding || !p.isGrounded) {
            thief.bodyGroup.scale.set(1, 1, 1);
          }

          thief.shieldBubble.visible = p.hasShield;
          if (p.hasShield) {
            thief.shieldBubble.rotation.y += dt * 2.2;
          }
          thief.turboFlame.visible = p.turboTimer > 0;
          if (p.turboTimer > 0) {
            thief.turboFlame.scale.setScalar(0.85 + Math.sin(p.runCycle * 3) * 0.18);
          }

          // Invincible flicker
          thief.bodyGroup.visible =
            p.invincibleTimer <= 0 || Math.floor(p.invincibleTimer * 18) % 2 === 0;
        }

        // 3b. Animate Remote Multiplayer Runners (WebRTC P2P / WiFi Local)
        const mp = multiplayerRef.current;
        if (mp && mp.active && remoteRigsRef.current.size > 0) {
          const poses = mp.remotePosesRef.current;
          for (const [peerId, entry] of remoteRigsRef.current.entries()) {
            const pose = poses.get(peerId);
            const rig = entry.rig;
            if (!pose) {
              // At race start before first packet arrives, show standing ready next to player
              rig.root.visible = stateRef.current === 'PLAYING' && engine.distanceMeters < 20;
              rig.bodyGroup.position.y = 0.92;
              rig.bodyGroup.rotation.set(0, 0, 0);
              rig.shieldBubble.visible = false;
              rig.turboFlame.visible = false;
              continue;
            }
            if (!pose.isAlive) {
              rig.root.visible = false;
              continue;
            }
            const targetRelZ = engine.worldScroll - pose.worldScroll;
            const smoothFactor = dt > 0 ? Math.min(1, dt * 16) : 1;
            entry.x = THREE.MathUtils.lerp(entry.x, pose.x, smoothFactor);
            entry.y = THREE.MathUtils.lerp(entry.y, pose.y, smoothFactor);
            entry.relZ = THREE.MathUtils.lerp(entry.relZ, targetRelZ, smoothFactor);

            if (entry.relZ < -95 || entry.relZ > 15) {
              rig.root.visible = false;
              continue;
            }

            rig.root.visible = true;
            rig.root.position.set(entry.x, 0, entry.relZ);
            rig.shadow.scale.setScalar(Math.max(0.45, 1 - entry.y * 0.18));

            if (pose.isSliding) {
              rig.bodyGroup.position.y = entry.y + 0.52;
              rig.bodyGroup.rotation.set(-0.75, 0, 0);
              rig.headGroup.rotation.y = 0;
              rig.leftLeg.rotation.x = 0.85;
              rig.rightLeg.rotation.x = 0.85;
              rig.leftArm.rotation.x = -0.9;
              rig.rightArm.rotation.x = -0.9;
            } else if (!pose.isGrounded) {
              rig.bodyGroup.position.y = entry.y + 0.92;
              rig.bodyGroup.rotation.set(-0.08, 0, 0);
              rig.headGroup.rotation.y = 0;
              rig.leftLeg.rotation.x = 0.62;
              rig.rightLeg.rotation.x = -0.35;
              rig.leftArm.rotation.x = -0.95;
              rig.rightArm.rotation.x = -0.75;
            } else {
              const swing = Math.sin(pose.runCycle);
              const bounce = Math.abs(Math.cos(pose.runCycle)) * 0.11;
              rig.bodyGroup.position.y = entry.y + 0.92 + bounce;
              rig.bodyGroup.rotation.set(0.16, swing * 0.08, 0);
              rig.headGroup.rotation.y = -swing * 0.08;
              rig.leftLeg.rotation.x = swing * 0.9;
              rig.rightLeg.rotation.x = -swing * 0.9;
              rig.leftKnee.rotation.x = Math.max(0.08, -swing * 0.85 + 0.35);
              rig.rightKnee.rotation.x = Math.max(0.08, swing * 0.85 + 0.35);
              rig.leftArm.rotation.x = -swing * 0.82;
              rig.rightArm.rotation.x = swing * 0.82;
              rig.leftForearm.rotation.x = -0.78 - Math.max(0, -swing) * 0.42;
              rig.rightForearm.rotation.x = -0.78 - Math.max(0, swing) * 0.42;
            }

            rig.shieldBubble.visible = pose.hasShield;
            if (pose.hasShield) {
              rig.shieldBubble.rotation.y += dt * 2.2;
            }
            rig.turboFlame.visible = pose.turboActive;
            if (pose.turboActive) {
              rig.turboFlame.scale.setScalar(0.85 + Math.sin(pose.runCycle * 3) * 0.18);
            }
          }
        }

        // 4. Animate Pursuing Police Officer on Blue Motorcycle + Flashing Siren + Dynamic Glow!
        const motoVibration = dt > 0 ? Math.abs(Math.sin(pol.motoWheelPhase * 0.5)) * 0.018 : 0;
        police.root.position.set(pol.laneX, motoVibration, pol.chaseZ);
        police.root.rotation.z = THREE.MathUtils.clamp(
          (pol.laneX - p.x) * -0.14 - Math.sin(pol.sirenPhase * 0.5) * 0.02,
          -0.25,
          0.25
        );
        police.frontWheel.rotation.x -= dt * 16;
        police.rearWheel.rotation.x -= dt * 16;

        const redBright = Math.sin(pol.sirenPhase) > 0;
        police.redBeaconMat.emissiveIntensity = redBright ? 2.4 : 0.25;
        police.blueBeaconMat.emissiveIntensity = redBright ? 0.25 : 2.4;
        police.sirenGlowMat.color.setHex(redBright ? 0xef4444 : 0x3b82f6);
        police.sirenGlowMat.opacity =
          engine.isGameOver || pol.danger > 35 ? 0.26 + (pol.danger / 100) * 0.42 : 0.18;

        // 5. Sync Active Obstacles via Object Pool (with real wheel spin & suspension micro-bounce)
        aliveObsIds.clear();
        for (const obs of engine.obstacles) {
          aliveObsIds.add(obs.id);
          let entry = activeObstacles.get(obs.id);
          if (!entry) {
            entry = { kind: obs.kind, group: acquireObstacle(obs.kind) };
            activeObstacles.set(obs.id, entry);
          }
          const isRoadVehicle =
            obs.kind === 'BUS' || obs.kind === 'TAXI_VERT' || obs.kind === 'MOTO';
          const suspensionBounce = isRoadVehicle
            ? Math.sin(obs.z * 0.9 + obs.variant * 6.28) * 0.014
            : 0;
          entry.group.position.set(obs.x, obs.y + suspensionBounce, obs.z);

          if (dt > 0) {
            const wheels = entry.group.userData.wheels as THREE.Object3D[] | undefined;
            if (wheels) {
              const wheelSpin = (engine.speed + obs.speedOffset) * dt * 2.4;
              for (let wi = 0; wi < wheels.length; wi++) {
                wheels[wi].rotation.x += wheelSpin;
              }
            }
          }
        }
        for (const [id, entry] of activeObstacles) {
          if (!aliveObsIds.has(id)) {
            releaseObstacle(entry.kind, entry.group);
            activeObstacles.delete(id);
          }
        }

        // 6. Sync Active Collectibles (Gold Coins, 500F Bills, Magnet, Grigri, Ginger)
        aliveCoinIds.clear();
        for (const c of engine.collectibles) {
          aliveCoinIds.add(c.id);
          let entry = activeCollectibles.get(c.id);
          if (!entry) {
            entry = { kind: c.kind, group: acquireCollectible(c.kind) };
            activeCollectibles.set(c.id, entry);
          }
          entry.group.position.set(c.x, c.y + Math.sin(c.bobOffset) * 0.12, c.z);
          entry.group.rotation.y = c.bobOffset * 0.8;
        }
        for (const [id, entry] of activeCollectibles) {
          if (!aliveCoinIds.has(id)) {
            releaseCollectible(entry.kind, entry.group);
            activeCollectibles.delete(id);
          }
        }

        // 7. Sync Particles Pool
        const parts = engine.particles;
        for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
          const mesh = particleMeshes[i];
          if (i < parts.length) {
            const pt = parts[i];
            mesh.visible = true;
            mesh.position.set(pt.x, pt.y, pt.z);
            mesh.scale.setScalar(pt.size * pt.alpha);
            (mesh.material as THREE.MeshBasicMaterial).color.set(pt.color);
          } else {
            mesh.visible = false;
          }
        }

        // 8. Smooth 3rd-Person Chase Camera with speed-reactive FOV, stride bob & subtle banking
        camX = THREE.MathUtils.damp(camX, p.x * 0.62, 7.5, dt);
        camY = THREE.MathUtils.damp(camY, 5.35 + p.y * 0.42, 7.5, dt);
        camRoll = THREE.MathUtils.damp(camRoll, -p.laneTilt * 0.12, 8, dt);
        const strideBob =
          stateRef.current === 'PLAYING' && p.isGrounded && !p.isSliding
            ? Math.abs(Math.cos(p.runCycle)) * 0.032
            : 0;
        const shakeX = engine.cameraShake > 0 ? (Math.random() - 0.5) * engine.cameraShake * 0.45 : 0;
        const shakeY = engine.cameraShake > 0 ? (Math.random() - 0.5) * engine.cameraShake * 0.35 : 0;

        const targetFov =
          computeResponsiveFov(camera.aspect) +
          Math.min(5, Math.max(0, (engine.speed - 18) * 0.22)) +
          (p.turboTimer > 0 ? 5.5 : 0);
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6, dt);
          camera.updateProjectionMatrix();
        }

        camera.position.set(camX + shakeX, camY + strideBob + shakeY, 10.6 + (p.turboTimer > 0 ? 0.8 : 0));
        camera.lookAt(camX * 0.72, 1.35 + p.y * 0.25, -15);
        camera.rotation.z += camRoll;
      };

      const tick = () => {
        if (disposed) return;

        if (pausedByModalRef.current) {
          lastTime = performance.now();
          frameId = window.setTimeout(tick, 180);
          return;
        }

        const now = performance.now();
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        const engine = engineRef.current;
        const currentState = stateRef.current;

        if (currentState === 'TITLE_MENU') {
          if (isTutorialRef.current) {
            engine.updateTutorialCruise(dt);
          } else {
            // Gentle live Ouagadougou street cruise on Main Menu
            engine.worldScroll += 13 * dt;
            engine.player.runCycle += dt * 9.5;
            engine.police.sirenPhase += dt * 7;
            engine.timeOfDay = (engine.timeOfDay + dt * 0.01) % 1;
            engine.updateWeather(dt);
          }
          gameOverNotifiedRef.current = false;
          levelCompleteNotifiedRef.current = false;
        } else if (currentState === 'PLAYING') {
          if (isFrozenRef.current) {
            lastTime = performance.now();
          } else {
            if (!engine.isGameOver) {
              gameOverNotifiedRef.current = false;
            }
            if (!engine.isLevelComplete) {
              levelCompleteNotifiedRef.current = false;
            }
            engine.update(dt);
            hudAccumulator += dt;

            if (engine.isLevelComplete && !levelCompleteNotifiedRef.current) {
              levelCompleteNotifiedRef.current = true;
              const snap = engine.getHudSnapshot();
              onHudUpdate(snap);
              onLevelComplete(snap);
            } else if (engine.isGameOver && !gameOverNotifiedRef.current) {
              gameOverNotifiedRef.current = true;
              const mp = multiplayerRef.current;
              if (mp && mp.active) {
                mp.onSendPose({
                  x: engine.player.x,
                  y: engine.player.y,
                  lane: engine.player.lane,
                  worldScroll: engine.worldScroll,
                  distanceMeters: engine.distanceMeters,
                  coinsCollected: engine.coinsCollected,
                  score: engine.score,
                  isSliding: engine.player.isSliding,
                  isGrounded: engine.player.isGrounded,
                  turboActive: engine.player.turboTimer > 0,
                  hasShield: engine.player.hasShield,
                  runCycle: engine.player.runCycle,
                  isAlive: false,
                });
              }
              const snap = engine.getHudSnapshot();
              onHudUpdate(snap);
              onGameOver(snap);
            } else {
              const mp = multiplayerRef.current;
              if (mp && mp.active && !engine.isGameOver) {
                mp.onSendPose({
                  x: engine.player.x,
                  y: engine.player.y,
                  lane: engine.player.lane,
                  worldScroll: engine.worldScroll,
                  distanceMeters: engine.distanceMeters,
                  coinsCollected: engine.coinsCollected,
                  score: engine.score,
                  isSliding: engine.player.isSliding,
                  isGrounded: engine.player.isGrounded,
                  turboActive: engine.player.turboTimer > 0,
                  hasShield: engine.player.hasShield,
                  runCycle: engine.player.runCycle,
                  isAlive: true,
                });
              }
              if (hudAccumulator >= 0.15) {
                hudAccumulator = 0;
                onHudUpdate(engine.getHudSnapshot());
              }
            }
          }
        } else if (currentState === 'GAME_OVER' || currentState === 'LEVEL_COMPLETE') {
          engine.update(dt);
        }

        syncSceneToEngine(
          currentState === 'PAUSED' || (currentState === 'PLAYING' && isFrozenRef.current) ? 0 : dt
        );
        renderer.render(scene, camera);

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
      };

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }

      return () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        window.clearTimeout(frameId);
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
        sceneRef.current = null;
        assetsRef.current = null;
        thiefRef.current?.disposeUnique?.();
        thiefRef.current = null;
        for (const entry of remoteRigsRef.current.values()) {
          entry.rig.disposeUnique?.();
        }
        remoteRigsRef.current.clear();
        haloTex.dispose();
        dustTex.dispose();
        assets.dispose();
        envRT?.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) {
          mount.removeChild(renderer.domElement);
        }
      };
    }, [onHudUpdate, onLevelComplete, onGameOver]);

    // Mobile Swipe Gestures (15px crisp threshold; single tap = Jump; double-tap = Jus & Protections)
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!canControlRunner()) return;
      soundEngine.unlock();
      touchStartRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      touchHandledRef.current = false;
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!canControlRunner()) return;
      const start = touchStartRef.current;
      if (!start || start.pointerId !== e.pointerId || touchHandledRef.current) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const notifyTutorial = (action: 'left' | 'right' | 'jump' | 'slide') => {
        if (stateRef.current === 'TITLE_MENU' && isTutorialRef.current) {
          onTutorialActionRef.current?.(action);
        }
      };

      if (Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy)) {
        touchHandledRef.current = true;
        lastTapRef.current = null;
        if (dx < 0) {
          engineRef.current.moveLeft();
          notifyTutorial('left');
        } else {
          engineRef.current.moveRight();
          notifyTutorial('right');
        }
      } else if (dy < -15 && Math.abs(dy) >= Math.abs(dx)) {
        touchHandledRef.current = true;
        lastTapRef.current = null;
        engineRef.current.triggerJump();
        notifyTutorial('jump');
      } else if (dy > 15 && Math.abs(dy) >= Math.abs(dx)) {
        touchHandledRef.current = true;
        lastTapRef.current = null;
        engineRef.current.triggerSlide();
        notifyTutorial('slide');
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      const start = touchStartRef.current;
      if (canControlRunner() && start && start.pointerId === e.pointerId && !touchHandledRef.current) {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // If user lifted finger quickly after a short swipe (>10px), treat as swipe instead of dropping it
        if (absDx > 10 && absDx > absDy) {
          lastTapRef.current = null;
          if (dx < 0) engineRef.current.moveLeft();
          else engineRef.current.moveRight();
        } else if (dy < -10 && absDy >= absDx) {
          lastTapRef.current = null;
          engineRef.current.triggerJump();
        } else if (dy > 10 && absDy >= absDx) {
          lastTapRef.current = null;
          engineRef.current.triggerSlide();
        } else if (stateRef.current === 'PLAYING' && onScreenTapRef.current) {
          const now = performance.now();
          const prevTap = lastTapRef.current;
          if (
            prevTap &&
            now - prevTap.time <= 340 &&
            Math.abs(e.clientX - prevTap.x) <= 36 &&
            Math.abs(e.clientY - prevTap.y) <= 36
          ) {
            lastTapRef.current = null;
            onScreenTapRef.current();
          } else {
            lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
            engineRef.current.triggerJump();
          }
        } else {
          engineRef.current.triggerJump();
          if (stateRef.current === 'TITLE_MENU' && isTutorialRef.current) {
            onTutorialActionRef.current?.('jump');
          }
        }
      }
      touchStartRef.current = null;
      touchHandledRef.current = false;
    };

    const handlePointerCancel = () => {
      touchStartRef.current = null;
      touchHandledRef.current = false;
    };

    return (
      <div
        className="game-canvas-touch relative h-full w-full overflow-hidden bg-[#1D1512]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        aria-label="Zone de jeu 3D Cavale à Ouaga"
      >
        <div ref={mountRef} className="h-full w-full" />

        {contextLost && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#161210]/95 p-6 text-center">
            <div className="max-w-sm">
              <p className="font-display text-lg font-bold text-amber-400">
                Rendu 3D en cours de récupération
              </p>
              <p className="mt-1 text-xs text-[#D6CBC0]">
                La mémoire graphique du téléphone se réinitialise. Patientez un instant ou relancez
                la course.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

GameCanvas.displayName = 'GameCanvas';
