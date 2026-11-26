import { resolveEffectiveSongInfo } from './musicStorage';
import { CharacterId, getCharacterById } from './shop';
import { soundEngine } from './sound';
import {
  Collectible,
  CollectibleKind,
  getLevelConfig,
  getWeatherMeta,
  HudSnapshot,
  LaneIndex,
  LevelConfig,
  Obstacle,
  ObstacleKind,
  Particle,
  PlayerState,
  PoliceState,
  WeatherKind,
} from './types';

export const LANE_WIDTH = 2.4;
export const SPAWN_Z = -142;
export const DESPAWN_Z = 16;

const GRAVITY = 42;
const JUMP_VELOCITY = 15.8;
const SLIDE_DURATION = 0.68;
const STAND_HEIGHT = 1.78;
const SLIDE_HEIGHT = 0.72;

export function laneToX(lane: LaneIndex): number {
  return lane * LANE_WIDTH;
}

interface ObstacleSpec {
  width: number;
  height: number;
  length: number;
  y: number;
  speedOffset: number;
  isOverhead: boolean;
  isJumpable: boolean;
}

function getObstacleSpec(kind: ObstacleKind): ObstacleSpec {
  switch (kind) {
    case 'BUS':
      return {
        width: 1.95,
        height: 3.1,
        length: 7.8,
        y: 0,
        speedOffset: 4.5,
        isOverhead: false,
        isJumpable: false,
      };
    case 'TRAIN_ROUGE':
    case 'TRAIN_BLEU':
      return {
        width: 2.08,
        height: 3.45,
        length: 14.5,
        y: 0,
        speedOffset: 9.5,
        isOverhead: false,
        isJumpable: false,
      };
    case 'TAXI_VERT':
      return {
        width: 1.76,
        height: 1.52,
        length: 4.2,
        y: 0,
        speedOffset: 3.2,
        isOverhead: false,
        isJumpable: true,
      };
    case 'MOTO':
      return {
        width: 1.15,
        height: 1.45,
        length: 2.2,
        y: 0,
        speedOffset: 4.0,
        isOverhead: false,
        isJumpable: true,
      };
    case 'MARCHANDE':
      return {
        width: 1.85,
        height: 2.55,
        length: 2.4,
        y: 0,
        speedOffset: 0,
        isOverhead: false,
        isJumpable: false,
      };
    case 'BARRIERE_BASSE':
      return {
        width: 1.95,
        height: 1.05,
        length: 0.75,
        y: 0,
        speedOffset: 0,
        isOverhead: false,
        isJumpable: true,
      };
    case 'BARRIERE_HAUTE':
      return {
        width: 2.05,
        height: 1.55,
        length: 0.75,
        y: 1.15, // Bottom at 1.15m: standing player (1.78m) hits it, sliding player (0.72m) glides under!
        speedOffset: 0,
        isOverhead: true,
        isJumpable: false,
      };
  }
}

export class GameEngine3D {
  public startLevel: number = 1;
  public level: number = 1;
  public levelConfig: LevelConfig = getLevelConfig(1);
  public levelStartMeters: number = 0;
  public levelBannerTimer: number = 0;
  public levelBannerTitle: string = '';

  /** Forward track speed in world units/sec (1 unit = ~1m) */
  public speed: number = 18;
  public characterSpeedMultiplier: number = 1;
  public worldScroll: number = 0;
  public distanceMeters: number = 0;
  public lootCfa: number = 0;
  public coinsCollected: number = 0;
  public score: number = 0;
  public combo: number = 1;
  public comboTimer: number = 0;
  /** 0..1 day-to-sunset-to-dusk cycle */
  public timeOfDay: number = 0.08;
  public weather: WeatherKind = 'SOLEIL_INTENSE';
  public weatherTime: number = 0;
  public weatherIntensity: number = 0.55;
  public lightningFlash: number = 0;
  private nextLightningAt: number = 9;
  public cameraShake: number = 0;
  public isGameOver: boolean = false;
  public isLevelComplete: boolean = false;
  public arrestReason: string = '';
  public statusFlashText: string = '';
  public statusFlashTimer: number = 0;
  public jumpsCount: number = 0;
  public slidesCount: number = 0;

  public player: PlayerState;
  public police: PoliceState;
  public obstacles: Obstacle[] = [];
  public collectibles: Collectible[] = [];
  public particles: Particle[] = [];

  public isMultiplayer: boolean = false;
  private rngState: number | null = null;

  private nextId: number = 1;
  private spawnTimer: number = 0.85;
  private jumpBufferTimer: number = 0;
  private coyoteTimer: number = 0;
  private stepDustTimer: number = 0;

  constructor(startLevel: number = 1, characterId: CharacterId = 'didi') {
    this.startLevel = Math.max(1, startLevel);
    this.characterSpeedMultiplier = getCharacterById(characterId).speedMultiplier;
    this.player = this.createInitialPlayer();
    this.police = this.createInitialPolice();
    this.reset(this.startLevel, characterId);
  }

  private createInitialPlayer(): PlayerState {
    return {
      lane: 0,
      x: 0,
      y: 0,
      z: 0,
      vy: 0,
      height: STAND_HEIGHT,
      isGrounded: true,
      isSliding: false,
      slideTimer: 0,
      rollProgress: 0,
      laneTilt: 0,
      runCycle: 0,
      squashY: 1,
      invincibleTimer: 0,
      stumbleTimer: 0,
      turboTimer: 0,
      turboSpeedBonus: 10.5,
      magnetTimer: 0,
      hasShield: false,
      shieldCharges: 0,
      shieldInvincibleSec: 1.3,
    };
  }

  private createInitialPolice(): PoliceState {
    return {
      danger: 28,
      chaseZ: 3.3,
      laneX: 0,
      sirenPhase: 0,
      motoWheelPhase: 0,
    };
  }

  private getBaseSpeedForLevel(cfg: LevelConfig): number {
    // Map existing LevelConfig speed (~540..1160) to crisp 3D units/sec (~17.5..33), scaled by character speed
    const progress = Math.min(
      1,
      Math.max(0, (this.distanceMeters - this.levelStartMeters) / cfg.lengthMeters)
    );
    const speed2d = cfg.baseSpeed + (cfg.maxSpeed - cfg.baseSpeed) * progress;
    return (11.5 + speed2d / 64) * this.characterSpeedMultiplier;
  }

  private rand(): number {
    if (this.rngState === null) return Math.random();
    let t = (this.rngState += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public reset(
    startLevel: number = this.startLevel,
    characterId: CharacterId = 'didi',
    options?: { seed?: number; isMultiplayer?: boolean }
  ): void {
    this.isMultiplayer = Boolean(options?.isMultiplayer);
    this.rngState =
      typeof options?.seed === 'number' && Number.isFinite(options.seed)
        ? (options.seed >>> 0) || 1
        : null;
    this.startLevel = Math.max(1, Math.floor(startLevel));
    this.characterSpeedMultiplier = getCharacterById(characterId).speedMultiplier;
    this.level = this.startLevel;
    this.levelConfig = getLevelConfig(this.level);
    this.levelStartMeters = 0;
    this.levelBannerTimer = 2.6;
    this.levelBannerTitle = this.isMultiplayer
      ? `Course WiFi · ${this.levelConfig.displayName}`
      : `Niveau ${this.level} · ${this.levelConfig.displayName}`;

    this.speed = this.getBaseSpeedForLevel(this.levelConfig);
    this.worldScroll = 0;
    this.distanceMeters = 0;
    this.lootCfa = 0;
    this.coinsCollected = 0;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.timeOfDay = 0.08;
    this.weather = this.levelConfig.quartier.weather;
    this.weatherTime = 0;
    this.weatherIntensity = 0.52;
    this.lightningFlash = 0;
    this.nextLightningAt = 6 + this.rand() * 6;
    this.cameraShake = 0;
    this.isGameOver = false;
    this.isLevelComplete = false;
    this.arrestReason = '';
    this.statusFlashText = '';
    this.statusFlashTimer = 0;
    this.jumpsCount = 0;
    this.slidesCount = 0;

    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];
    this.spawnTimer = 0.65;
    this.jumpBufferTimer = 0;
    this.coyoteTimer = 0;
    this.stepDustTimer = 0;
    this.player = this.createInitialPlayer();
    this.police = this.createInitialPolice();

    // Welcome coin trail in the center lane
    this.spawnCoinLine(0, -32, 6, 3.4, 0.75, 'PIECE');
  }

  public moveLeft(): void {
    if (this.isGameOver || this.isLevelComplete) return;
    if (this.player.lane > -1) {
      this.player.lane = (this.player.lane - 1) as LaneIndex;
      this.player.laneTilt = -0.34;
      soundEngine.playClick();
    }
  }

  public moveRight(): void {
    if (this.isGameOver || this.isLevelComplete) return;
    if (this.player.lane < 1) {
      this.player.lane = (this.player.lane + 1) as LaneIndex;
      this.player.laneTilt = 0.34;
      soundEngine.playClick();
    }
  }

  public triggerJump(): void {
    if (this.isGameOver || this.isLevelComplete) return;
    this.jumpBufferTimer = 0.14;
    this.tryExecuteJump();
  }

  private tryExecuteJump(): void {
    const p = this.player;
    if (p.isGrounded || this.coyoteTimer > 0) {
      if (p.isSliding) {
        this.endSlide();
      }
      p.vy = JUMP_VELOCITY;
      p.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      p.squashY = 1.2;
      this.jumpsCount += 1;
      this.emitDust(
        p.x,
        0.15,
        p.z,
        8,
        this.weather === 'PLUIE' ? '#BAE6FD' : '#D97706'
      );
      soundEngine.playJump(false);
    }
  }

  public triggerSlide(): void {
    if (this.isGameOver || this.isLevelComplete) return;
    const p = this.player;
    if (!p.isGrounded) {
      // Fast slam down into roll!
      p.vy = Math.min(p.vy, -24);
      if (!p.isSliding) {
        this.slidesCount += 1;
      }
      p.isSliding = true;
      p.slideTimer = SLIDE_DURATION;
      p.rollProgress = 0;
      p.height = SLIDE_HEIGHT;
      soundEngine.playSlide();
      return;
    }
    if (!p.isSliding) {
      p.isSliding = true;
      p.slideTimer = SLIDE_DURATION;
      p.rollProgress = 0;
      p.height = SLIDE_HEIGHT;
      p.squashY = 0.65;
      this.slidesCount += 1;
      this.emitDust(
        p.x,
        0.15,
        p.z,
        7,
        this.weather === 'PLUIE' ? '#BAE6FD' : '#B45309'
      );
      soundEngine.playSlide();
    } else {
      p.slideTimer = Math.max(p.slideTimer, 0.35);
    }
  }

  private endSlide(): void {
    const p = this.player;
    p.isSliding = false;
    p.slideTimer = 0;
    p.rollProgress = 0;
    p.height = STAND_HEIGHT;
  }

  public update(rawDt: number): void {
    const dt = Math.min(0.05, Math.max(0.001, rawDt));

    if (this.isGameOver) {
      this.updateParticles(dt);
      this.police.sirenPhase += dt * 10;
      this.police.chaseZ += (1.15 - this.police.chaseZ) * Math.min(1, dt * 6);
      this.police.laneX += (this.player.x - this.police.laneX) * Math.min(1, dt * 8);
      return;
    }

    if (this.isLevelComplete) {
      this.updateParticles(dt);
      this.police.sirenPhase += dt * 4;
      this.police.chaseZ += (5.2 - this.police.chaseZ) * Math.min(1, dt * 3);
      if (this.player.y > 0) {
        this.player.y = Math.max(0, this.player.y - dt * 10);
      }
      this.player.isGrounded = this.player.y <= 0.01;
      this.player.isSliding = false;
      this.player.squashY += (1 - this.player.squashY) * Math.min(1, dt * 10);
      return;
    }

    const cfg = this.levelConfig;
    const baseTarget = this.getBaseSpeedForLevel(cfg);
    const turboBoost = this.player.turboTimer > 0 ? this.player.turboSpeedBonus : 0;
    const stumbleSlow = this.player.stumbleTimer > 0 ? -4.5 : 0;
    const targetSpeed = Math.max(14, baseTarget + turboBoost + stumbleSlow);
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 5);

    const moveDz = this.speed * dt;
    this.worldScroll += moveDz;
    this.distanceMeters += moveDz * 1.15;
    this.score += moveDz * 4.2 * cfg.multiplier * this.combo;

    if (this.distanceMeters - this.levelStartMeters >= cfg.lengthMeters) {
      if (this.isMultiplayer) {
        this.level += 1;
        this.levelStartMeters += cfg.lengthMeters;
        this.levelConfig = getLevelConfig(this.level);
        this.levelBannerTimer = 2.2;
        this.levelBannerTitle = `${this.levelConfig.displayName} · Vitesse +`;
        this.flashStatus(`${this.distanceMeters.toFixed(0)} m · ${this.levelConfig.displayName} !`);
      } else {
        this.completeCurrentLevel();
        this.updateParticles(dt);
        return;
      }
    }

    if (this.levelBannerTimer > 0) this.levelBannerTimer = Math.max(0, this.levelBannerTimer - dt);
    if (this.statusFlashTimer > 0) this.statusFlashTimer = Math.max(0, this.statusFlashTimer - dt);
    if (this.cameraShake > 0) this.cameraShake = Math.max(0, this.cameraShake - dt * 2.4);

    // Smooth blue sky -> golden orange sunset -> twilight cycle
    this.timeOfDay = (this.timeOfDay + dt * 0.014) % 1;
    this.updateWeather(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
      }
    }

    this.updatePlayer(dt);
    this.updatePolice(dt);
    this.updateSpawner(dt);
    this.updateObstacles(dt, moveDz);
    this.updateCollectibles(dt, moveDz);
    this.updateParticles(dt);
  }

  public updateTutorialCruise(rawDt: number): void {
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    this.speed = 14;
    this.worldScroll += this.speed * dt;
    this.timeOfDay = (this.timeOfDay + dt * 0.01) % 1;
    this.updateWeather(dt);
    this.updatePlayer(dt);
    this.police.sirenPhase += dt * 7;
    this.police.chaseZ += (3.5 - this.police.chaseZ) * Math.min(1, dt * 4.5);
    this.police.laneX += (this.player.x - this.police.laneX) * Math.min(1, dt * 6.5);
    this.updateParticles(dt);
  }

  private completeCurrentLevel(): void {
    this.isLevelComplete = true;
    this.distanceMeters = this.levelStartMeters + this.levelConfig.lengthMeters;

    const bonus = Math.round(300 * this.levelConfig.multiplier);
    this.score += bonus;
    this.police.danger = Math.max(12, this.police.danger - 25);
    this.levelBannerTimer = 0;
    this.flashStatus(`NIVEAU ${this.level} TERMINÉ !`);
    this.obstacles = [];

    this.emitDust(this.player.x, this.player.y + 1.4, this.player.z, 18, '#FBBF24');
    this.emitDust(this.player.x, this.player.y + 1.6, this.player.z, 12, '#34D399');
    soundEngine.playLevelUp(this.level);
  }

  private flashStatus(text: string): void {
    this.statusFlashText = text;
    this.statusFlashTimer = 1.6;
  }

  public activateSpeedJuice(
    label: string,
    durationSec: number,
    speedBonus: number,
    policePushback: number
  ): boolean {
    if (this.isGameOver || this.isLevelComplete) return false;
    this.player.turboTimer = Math.max(this.player.turboTimer, durationSec);
    this.player.turboSpeedBonus = Math.max(
      this.player.turboTimer > 0 ? this.player.turboSpeedBonus : 0,
      speedBonus
    );
    this.police.danger = Math.max(10, this.police.danger - policePushback);
    this.emitDust(this.player.x, this.player.y + 0.9, this.player.z, 14, '#F97316');
    this.flashStatus(`${label.toUpperCase()} !`);
    soundEngine.playPowerUp();
    return true;
  }

  public activateProtection(
    label: string,
    charges: number,
    invincibleBonusSec: number
  ): boolean {
    if (this.isGameOver || this.isLevelComplete) return false;
    const safeCharges = Math.max(1, Math.floor(charges));
    this.player.shieldCharges += safeCharges;
    this.player.hasShield = this.player.shieldCharges > 0;
    this.player.shieldInvincibleSec = Math.max(
      this.player.shieldInvincibleSec,
      invincibleBonusSec
    );
    this.emitDust(this.player.x, this.player.y + 1.0, this.player.z, 14, '#38BDF8');
    this.flashStatus(`${label.toUpperCase()} (${this.player.shieldCharges}×) !`);
    soundEngine.playPowerUp();
    return true;
  }

  private updatePlayer(dt: number): void {
    const p = this.player;

    if (p.invincibleTimer > 0) p.invincibleTimer = Math.max(0, p.invincibleTimer - dt);
    if (p.stumbleTimer > 0) p.stumbleTimer = Math.max(0, p.stumbleTimer - dt);
    if (p.magnetTimer > 0) p.magnetTimer = Math.max(0, p.magnetTimer - dt);

    if (p.turboTimer > 0) {
      p.turboTimer = Math.max(0, p.turboTimer - dt);
      if (Math.random() < 0.6) {
        this.emitDust(p.x, p.y + 0.7, p.z + 0.4, 1, '#F59E0B');
      }
    }

    // Smooth lane X damping
    const targetX = laneToX(p.lane);
    p.x += (targetX - p.x) * Math.min(1, dt * 16);
    p.laneTilt += (0 - p.laneTilt) * Math.min(1, dt * 11);

    if (p.isGrounded) {
      this.coyoteTimer = 0.09;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
      this.tryExecuteJump();
    }

    if (p.isSliding) {
      p.slideTimer -= dt;
      p.rollProgress = Math.min(1, 1 - p.slideTimer / SLIDE_DURATION);
      if (p.slideTimer <= 0) {
        this.endSlide();
      }
    }

    if (!p.isGrounded) {
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        p.isGrounded = true;
        p.squashY = 0.78;
        this.emitDust(
          p.x,
          0.12,
          p.z,
          6,
          this.weather === 'PLUIE' ? '#BAE6FD' : '#D97706'
        );
      }
    } else {
      p.runCycle += dt * (this.speed * 0.62);
      this.stepDustTimer -= dt;
      if (this.stepDustTimer <= 0) {
        const isRain = this.weather === 'PLUIE';
        this.stepDustTimer = p.isSliding ? 0.05 : 0.16;
        this.emitDust(p.x, 0.1, p.z + 0.3, 1, isRain ? '#BAE6FD' : '#C27438');
        if (!p.isSliding) {
          soundEngine.playFootstep(isRain);
        }
      }
    }

    p.squashY += (1 - p.squashY) * Math.min(1, dt * 14);
  }

  private updatePolice(dt: number): void {
    const pol = this.police;
    pol.sirenPhase += dt * 9;
    pol.motoWheelPhase += dt * this.speed * 1.4;

    if (this.player.turboTimer > 0) {
      pol.danger = Math.max(15, pol.danger - dt * 14);
    } else if (this.player.stumbleTimer <= 0) {
      pol.danger = Math.max(24, pol.danger - dt * 2.2);
    }

    if (pol.danger >= 65) {
      soundEngine.playSirenPulse(pol.danger);
    }

    // Keep motorcycle visible behind thief (z = 2.2..3.6), creeping closer when danger rises!
    const targetZ = 3.7 - (pol.danger / 100) * 1.65;
    pol.chaseZ += (targetZ - pol.chaseZ) * Math.min(1, dt * 4.5);
    pol.laneX += (this.player.x - pol.laneX) * Math.min(1, dt * 6.5);
  }

  private getObstacleArrivalWindow(
    z: number,
    length: number,
    speedOffset: number
  ): { enter: number; exit: number } {
    const v = Math.max(12, this.speed + speedOffset);
    const frontZ = z + length * 0.5;
    const backZ = z - length * 0.5;
    return {
      enter: -frontZ / v,
      exit: -backZ / v,
    };
  }

  private canPlaceObstacle(kind: ObstacleKind, lane: LaneIndex, z: number): boolean {
    const spec = getObstacleSpec(kind);
    const cand = this.getObstacleArrivalWindow(z, spec.length, spec.speedOffset);

    // 1. Prevent same-lane overlap or overtaking across the entire track
    for (const obs of this.obstacles) {
      if (obs.lane !== lane) continue;
      const minSpawnGap = (spec.length + obs.length) * 0.5 + 9.0;
      if (Math.abs(z - obs.z) < minSpawnGap) return false;

      const ex = this.getObstacleArrivalWindow(obs.z, obs.length, obs.speedOffset);
      // Preserve order from spawn to player plane + 0.65s recovery gap
      if (z <= obs.z) {
        if (cand.enter < ex.exit + 0.65) return false;
      } else {
        if (cand.exit + 0.65 > ex.enter) return false;
      }
    }

    // 2. Guarantee an open escape corridor across all 3 lanes at every instant
    const existingWindows = this.obstacles.map((obs) => {
      const w = this.getObstacleArrivalWindow(obs.z, obs.length, obs.speedOffset);
      const pad = obs.isJumpable || obs.isOverhead ? 0.34 : 0.42;
      return { lane: obs.lane, start: w.enter - pad, end: w.exit + pad };
    });

    const candPad = spec.isJumpable || spec.isOverhead ? 0.34 : 0.42;
    existingWindows.push({
      lane,
      start: cand.enter - candPad,
      end: cand.exit + candPad,
    });

    const checkStart = cand.enter - 0.45;
    const checkEnd = cand.exit + 0.45;
    for (let t = checkStart; t <= checkEnd; t += 0.1) {
      let blockedCount = 0;
      for (const checkLane of [-1, 0, 1] as LaneIndex[]) {
        const isBlocked = existingWindows.some(
          (w) => w.lane === checkLane && t >= w.start && t <= w.end
        );
        if (isBlocked) blockedCount++;
      }
      if (blockedCount >= 3) {
        return false;
      }
    }

    return true;
  }

  private trySpawnObstacle(kind: ObstacleKind, lane: LaneIndex, z: number): boolean {
    if (!this.canPlaceObstacle(kind, lane, z)) {
      return false;
    }
    this.spawnObstacle(kind, lane, z);
    return true;
  }

  private updateSpawner(dt: number): void {
    if (!this.isMultiplayer) {
      const remainingMeters =
        this.levelConfig.lengthMeters - (this.distanceMeters - this.levelStartMeters);
      if (remainingMeters <= 46) return;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    const lanes: LaneIndex[] = [-1, 0, 1];
    const roll = this.rand();
    let safeCoinLane: LaneIndex = lanes[Math.floor(this.rand() * 3)];
    let spawnedAny = false;

    if (roll < 0.23) {
      // Oncoming Red or Blue Train on 1 or 2 lanes, keeping at least 1 lane completely open
      const openLane = lanes[Math.floor(this.rand() * 3)];
      safeCoinLane = openLane;
      const trainLanes = lanes.filter((l) => l !== openLane);
      const twoTrains = this.rand() < 0.45;
      const chosen = twoTrains ? trainLanes : [trainLanes[Math.floor(this.rand() * 2)]];

      for (const lane of chosen) {
        const kind: ObstacleKind = this.rand() < 0.5 ? 'TRAIN_ROUGE' : 'TRAIN_BLEU';
        if (this.trySpawnObstacle(kind, lane, SPAWN_Z)) {
          spawnedAny = true;
        }
      }
      this.spawnCoinLine(openLane, SPAWN_Z - 4, 6, 3.2, 0.75, 'PIECE');
      this.spawnTimer = this.computeNextDelay(spawnedAny ? 1.15 : 0.45);
    } else if (roll < 0.45) {
      // Bus + Taxi/Moto traffic combo with clear safe lane
      const busLane = lanes[Math.floor(this.rand() * 3)];
      const otherLanes = lanes.filter((l) => l !== busLane);
      const secondLane = otherLanes[0];
      const safeLane = otherLanes[1];
      safeCoinLane = safeLane;

      if (this.trySpawnObstacle('BUS', busLane, SPAWN_Z)) {
        spawnedAny = true;
      }
      if (this.rand() < 0.72) {
        const secKind: ObstacleKind = this.rand() < 0.55 ? 'TAXI_VERT' : 'MOTO';
        if (this.trySpawnObstacle(secKind, secondLane, SPAWN_Z - 1.5)) {
          spawnedAny = true;
        }
      }
      this.spawnCoinLine(safeLane, SPAWN_Z - 2, 5, 3.2, 0.75, 'PIECE');
      this.spawnTimer = this.computeNextDelay(spawnedAny ? 1.05 : 0.45);
    } else if (roll < 0.65) {
      // High Barrier to SLIDE under + optional Stall on another lane + 1 guaranteed open lane
      const lane = lanes[Math.floor(this.rand() * 3)];
      const remaining = lanes.filter((l) => l !== lane);
      const otherLane = remaining[0];
      safeCoinLane = remaining[1];

      if (this.trySpawnObstacle('BARRIERE_HAUTE', lane, SPAWN_Z)) {
        spawnedAny = true;
        this.spawnCoinLine(lane, SPAWN_Z - 3, 4, 3.0, 0.5, 'PIECE');
      }
      if (this.rand() < 0.68) {
        if (this.trySpawnObstacle('MARCHANDE', otherLane, SPAWN_Z)) {
          spawnedAny = true;
        }
      }
      this.spawnTimer = this.computeNextDelay(spawnedAny ? 0.96 : 0.45);
    } else if (roll < 0.84) {
      // Low Barrier (with locked jump coin arc!) or Taxi + clear escape lane
      const lane = lanes[Math.floor(this.rand() * 3)];
      const remaining = lanes.filter((l) => l !== lane);
      const altLane = remaining[0];
      safeCoinLane = remaining[1];

      const isBarrier = this.rand() < 0.58;
      const kind: ObstacleKind = isBarrier ? 'BARRIERE_BASSE' : 'TAXI_VERT';
      if (this.trySpawnObstacle(kind, lane, SPAWN_Z)) {
        spawnedAny = true;
        if (isBarrier) {
          this.spawnCoinArc(lane, SPAWN_Z, 5, 2.3, 2.35);
        } else {
          this.spawnCoinLine(safeCoinLane, SPAWN_Z - 2, 5, 3.2, 0.75, 'PIECE');
        }
      }
      if (this.rand() < 0.6) {
        if (this.trySpawnObstacle('MARCHANDE', altLane, SPAWN_Z)) {
          spawnedAny = true;
        }
      }
      this.spawnTimer = this.computeNextDelay(spawnedAny ? 0.95 : 0.45);
    } else {
      // Rood-Woko Market Stall + Moto + Safe Coin Corridor
      const stallLane = lanes[Math.floor(this.rand() * 3)];
      const remaining = lanes.filter((l) => l !== stallLane);
      safeCoinLane = remaining[1];

      if (this.trySpawnObstacle('MARCHANDE', stallLane, SPAWN_Z)) {
        spawnedAny = true;
      }
      if (this.trySpawnObstacle('MOTO', remaining[0], SPAWN_Z - 1.5)) {
        spawnedAny = true;
      }
      this.spawnCoinLine(safeCoinLane, SPAWN_Z - 3, 5, 3.1, 0.75, 'PIECE');
      this.spawnTimer = this.computeNextDelay(spawnedAny ? 0.98 : 0.45);
    }

    // Power-up spawn (Aimant, Grigri, Gingembre) or bonus Billet 500F along the clear lane
    if (spawnedAny && this.rand() < 0.25) {
      const r = this.rand();
      const kind: CollectibleKind =
        r < 0.36 ? 'AIMANT' : r < 0.64 ? 'GRIGRI' : r < 0.86 ? 'GINGEMBRE' : 'BILLET';
      this.collectibles.push({
        id: this.nextId++,
        kind,
        lane: safeCoinLane,
        x: laneToX(safeCoinLane),
        y: 1.05,
        z: SPAWN_Z - 12,
        radius: 0.65,
        collected: false,
        bobOffset: this.rand() * Math.PI * 2,
      });
    }
  }

  private computeNextDelay(baseFactor: number): number {
    const speedRatio = 20 / Math.max(16, this.speed);
    const jitter = (this.rand() - 0.5) * 0.14;
    return Math.max(0.68, baseFactor * (0.68 + 0.48 * speedRatio) + jitter);
  }

  private spawnObstacle(kind: ObstacleKind, lane: LaneIndex, z: number): void {
    const spec = getObstacleSpec(kind);

    if ((kind === 'TAXI_VERT' || kind === 'BUS') && this.rand() < 0.35) {
      soundEngine.playTaxiHorn();
    }

    this.obstacles.push({
      id: this.nextId++,
      kind,
      lane,
      x: laneToX(lane),
      y: spec.y,
      z,
      width: spec.width,
      height: spec.height,
      length: spec.length,
      speedOffset: spec.speedOffset,
      isOverhead: spec.isOverhead,
      isJumpable: spec.isJumpable,
      passed: false,
      hit: false,
      variant: this.rand(),
    });
  }

  private spawnCoinLine(
    lane: LaneIndex,
    startZ: number,
    count: number,
    spacing: number,
    y: number,
    kind: CollectibleKind
  ): void {
    const x = laneToX(lane);
    for (let i = 0; i < count; i++) {
      const isBill = kind === 'PIECE' && i === count - 1 && count >= 5 && this.rand() < 0.35;
      this.collectibles.push({
        id: this.nextId++,
        kind: isBill ? 'BILLET' : kind,
        lane,
        x,
        y,
        z: startZ - i * spacing,
        radius: 0.55,
        collected: false,
        bobOffset: i * 0.55,
      });
    }
  }

  private spawnCoinArc(
    lane: LaneIndex,
    centerZ: number,
    count: number,
    spacing: number,
    peakY: number
  ): void {
    const x = laneToX(lane);
    const half = (count - 1) / 2;
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const parabola = 4 * t * (1 - t);
      const y = 0.75 + parabola * (peakY - 0.75);
      const z = centerZ + (i - half) * spacing;
      this.collectibles.push({
        id: this.nextId++,
        kind: i === Math.floor(count / 2) ? 'BILLET' : 'PIECE',
        lane,
        x,
        y,
        z,
        radius: 0.55,
        collected: false,
        bobOffset: i * 0.5,
      });
    }
  }

  private updateObstacles(dt: number, moveDz: number): void {
    const p = this.player;
    const pHalfW = 0.28;
    const pHalfD = 0.32;
    const pBottom = p.y;
    const pTop = p.y + p.height;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.z += moveDz + obs.speedOffset * dt;

      if (!obs.passed && obs.z - obs.length * 0.5 > p.z + pHalfD) {
        obs.passed = true;
        if (!obs.hit) {
          this.score += 20 * this.levelConfig.multiplier;
        }
      }

      if (!obs.hit) {
        const oHalfW = obs.width * 0.38;
        const oHalfD = obs.length * 0.44;
        const oBottom = obs.y;
        const oTop = obs.y + obs.height;

        const overlapX = Math.abs(p.x - obs.x) < pHalfW + oHalfW;
        const overlapZ = Math.abs(p.z - obs.z) < pHalfD + oHalfD;
        const overlapY = pBottom < oTop - 0.08 && pTop > oBottom + 0.08;

        if (overlapX && overlapZ && overlapY) {
          this.handleObstacleHit(obs);
        }
      }

      if (obs.z - obs.length * 0.5 > DESPAWN_Z) {
        this.obstacles.splice(i, 1);
      }
    }
  }

  private handleObstacleHit(obs: Obstacle): void {
    obs.hit = true;
    const p = this.player;

    if (p.turboTimer > 0) {
      this.cameraShake = 0.45;
      this.emitDust(obs.x, 1.0, obs.z, 14, '#F59E0B');
      this.score += 75;
      this.flashStatus('PERCÉ ! +75');
      obs.z = DESPAWN_Z + 40;
      soundEngine.playStumble();
      return;
    }

    if (p.invincibleTimer > 0) return;

    if (p.shieldCharges > 0 || p.hasShield) {
      p.shieldCharges = Math.max(0, p.shieldCharges - 1);
      p.hasShield = p.shieldCharges > 0;
      p.invincibleTimer = Math.max(p.invincibleTimer, p.shieldInvincibleSec || 1.3);
      this.cameraShake = 0.55;
      this.emitDust(p.x, p.y + 1.0, p.z, 16, '#38BDF8');
      this.flashStatus(
        p.shieldCharges > 0
          ? `CHOC ABSORBÉ ! (${p.shieldCharges} restant${p.shieldCharges > 1 ? 's' : ''})`
          : 'PROTECTION BRISÉE !'
      );
      soundEngine.playShieldBreak();
      return;
    }

    // Fatal collision -> Caught by police motorcycle!
    this.police.danger = 100;
    this.cameraShake = 0.9;
    this.isGameOver = true;
    this.arrestReason = this.describeArrest(obs);
    this.emitDust(p.x, p.y + 0.9, p.z, 22, '#EF4444');
    soundEngine.playBusted();
  }

  private describeArrest(obs: Obstacle): string {
    const q = this.levelConfig.displayName;
    switch (obs.kind) {
      case 'TRAIN_ROUGE':
        return `Train rouge percuté sur les rails à ${q}`;
      case 'TRAIN_BLEU':
        return `Train bleu percuté à pleine vitesse à ${q}`;
      case 'BUS':
        return `Bloqué par un grand bus à ${q}`;
      case 'TAXI_VERT':
        return `Collision avec un taxi-vert à ${q}`;
      case 'MOTO':
        return `Accrochage avec une moto de rue à ${q}`;
      case 'MARCHANDE':
        return `Renversé l’étal de la marchande à ${q}`;
      case 'BARRIERE_BASSE':
        return `Stoppé par une barrière de police à ${q}`;
      case 'BARRIERE_HAUTE':
        return `Fauché par une barrière haute à ${q}`;
    }
  }

  private updateCollectibles(dt: number, moveDz: number): void {
    const p = this.player;
    const targetY = p.y + p.height * 0.5;

    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      c.z += moveDz;
      c.bobOffset += dt * 4.5;

      // Magnet pulls coins & bills toward player in 3D!
      if (p.magnetTimer > 0 && (c.kind === 'PIECE' || c.kind === 'BILLET')) {
        const dx = p.x - c.x;
        const dy = targetY - c.y;
        const dz = p.z - c.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < 18 && dist > 0.05) {
          const pull = 36 * dt;
          c.x += (dx / dist) * pull;
          c.y += (dy / dist) * pull;
          c.z += (dz / dist) * pull;
        }
      }

      const dist = Math.hypot(p.x - c.x, targetY - c.y, p.z - c.z);
      if (!c.collected && dist < c.radius + 0.92) {
        this.collectItem(c);
      }

      if (c.collected || c.z > DESPAWN_Z) {
        this.collectibles.splice(i, 1);
      }
    }
  }

  private collectItem(c: Collectible): void {
    c.collected = true;
    const mult = this.levelConfig.multiplier;

    switch (c.kind) {
      case 'PIECE':
        this.lootCfa += 100;
        this.coinsCollected += 1;
        this.score += 25 * mult * this.combo;
        this.bumpCombo();
        this.emitDust(c.x, c.y, c.z, 5, '#FBBF24');
        soundEngine.playCoin(false);
        break;
      case 'BILLET':
        this.lootCfa += 500;
        this.score += 80 * mult * this.combo;
        this.bumpCombo();
        this.emitDust(c.x, c.y, c.z, 8, '#34D399');
        this.flashStatus('+500 F CFA !');
        soundEngine.playCoin(true);
        break;
      case 'AIMANT':
        this.player.magnetTimer = 7.5;
        this.emitDust(c.x, c.y, c.z, 12, '#A78BFA');
        this.flashStatus('AIMANT ACTIVÉ !');
        soundEngine.playPowerUp();
        break;
      case 'GRIGRI':
        this.player.shieldCharges += 1;
        this.player.hasShield = true;
        this.player.shieldInvincibleSec = Math.max(this.player.shieldInvincibleSec, 1.4);
        this.emitDust(c.x, c.y, c.z, 12, '#38BDF8');
        this.flashStatus(
          this.player.shieldCharges > 1
            ? `GRIGRI PROTECTEUR (${this.player.shieldCharges}×) !`
            : 'GRIGRI PROTECTEUR !'
        );
        soundEngine.playPowerUp();
        break;
      case 'GINGEMBRE':
        this.player.turboTimer = Math.max(this.player.turboTimer, 4.2);
        this.player.turboSpeedBonus = Math.max(this.player.turboSpeedBonus, 10.5);
        this.police.danger = Math.max(15, this.police.danger - 20);
        this.emitDust(c.x, c.y, c.z, 12, '#F97316');
        this.flashStatus('GINGEMBRE TURBO !');
        soundEngine.playPowerUp();
        break;
    }
  }

  private bumpCombo(): void {
    this.comboTimer = 3.0;
    if (this.combo < 5) {
      this.combo = Math.min(5, +(this.combo + 0.25).toFixed(2));
    }
  }

  private emitDust(x: number, y: number, z: number, count: number, color: string): void {
    if (this.particles.length > 48) return; // Keep Pop 9 lightweight
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 0.45,
        y: y + Math.random() * 0.3,
        z: z + (Math.random() - 0.5) * 0.45,
        vx: (Math.random() - 0.5) * 3.2,
        vy: 1.5 + Math.random() * 3.0,
        vz: 2.0 + Math.random() * 4.0,
        size: 0.12 + Math.random() * 0.14,
        alpha: 0.9,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
        color,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      pt.vy -= 9.5 * dt;
      pt.alpha = Math.max(0, 1 - pt.life / pt.maxLife);
      if (pt.life >= pt.maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }

  public updateWeather(dt: number): void {
    this.weatherTime += dt;
    const waveA = 0.5 + 0.5 * Math.sin(this.weatherTime * 0.34 - 0.6);
    const waveB = 0.5 + 0.5 * Math.sin(this.weatherTime * 0.85 + 1.1);
    const dynamicMix = waveA * 0.72 + waveB * 0.28;

    if (this.weather === 'HARMATTAN') {
      // Swirling Saharan dust gusts
      this.weatherIntensity = 0.42 + dynamicMix * 0.58;
      this.lightningFlash = 0;
    } else if (this.weather === 'PLUIE') {
      // Tropical downpour squalls + occasional subtle distant lightning flash
      this.weatherIntensity = 0.46 + dynamicMix * 0.54;
      if (this.lightningFlash > 0) {
        this.lightningFlash = Math.max(0, this.lightningFlash - dt * 3.1);
      }
      this.nextLightningAt -= dt;
      if (this.nextLightningAt <= 0) {
        if (this.weatherIntensity > 0.62) {
          this.lightningFlash = 0.85;
          soundEngine.playThunder();
        }
        this.nextLightningAt = 7.5 + this.rand() * 8.5;
      }
    } else {
      // SOLEIL_INTENSE: blazing afternoon peak & glare waves
      this.weatherIntensity = 0.48 + dynamicMix * 0.52;
      this.lightningFlash = 0;
    }
  }

  public getVisibilityPercent(): number {
    if (this.weather === 'HARMATTAN') {
      return Math.max(32, Math.min(82, Math.round(74 - this.weatherIntensity * 38)));
    }
    if (this.weather === 'PLUIE') {
      return Math.max(38, Math.min(84, Math.round(78 - this.weatherIntensity * 34)));
    }
    return Math.max(52, Math.min(90, Math.round(88 - this.weatherIntensity * 28)));
  }

  public getHudSnapshot(): HudSnapshot {
    const levelDone = Math.max(0, Math.floor(this.distanceMeters - this.levelStartMeters));
    const levelTotal = this.levelConfig.lengthMeters;
    const weatherMeta = getWeatherMeta(this.weather);
    return {
      score: Math.floor(this.score),
      distanceMeters: Math.floor(this.distanceMeters),
      worldScroll: +this.worldScroll.toFixed(2),
      lootCfa: this.lootCfa,
      coinsCollected: this.coinsCollected,
      policeDanger: Math.round(this.police.danger),
      combo: Math.floor(this.combo),
      hasShield: this.player.hasShield,
      shieldCharges: this.player.shieldCharges,
      turboRemaining: +this.player.turboTimer.toFixed(1),
      magnetRemaining: +this.player.magnetTimer.toFixed(1),
      speedKmh: Math.round(this.speed * 2.1),
      arrestReason: this.arrestReason,
      level: this.level,
      quartierName: this.levelConfig.displayName,
      quartierZone: this.levelConfig.quartier.zone,
      soundTitle: resolveEffectiveSongInfo(this.level).label,
      weather: this.weather,
      weatherLabel: weatherMeta.label,
      weatherIntensity: +this.weatherIntensity.toFixed(2),
      visibilityPercent: this.getVisibilityPercent(),
      levelProgress: Math.min(1, levelDone / levelTotal),
      levelMetersDone: Math.min(levelTotal, levelDone),
      levelMetersTotal: levelTotal,
      multiplier: this.levelConfig.multiplier,
      bannerText: this.levelBannerTimer > 0 ? this.levelBannerTitle : '',
      flashText: this.statusFlashTimer > 0 ? this.statusFlashText : '',
      jumpsCount: this.jumpsCount,
      slidesCount: this.slidesCount,
    };
  }
}
