import {
  getCachedCustomSongUrl,
  getCustomSongUrl,
  getLevelSongMap,
  preloadCustomSongs,
} from './musicStorage';
import { getLevelConfig, QuartierTheme } from './types';

interface LevelAudioSignature {
  rootHz: number;
  scale: number[];
  bpm: number;
  melodyPattern: number[];
  bassPattern: number[];
  wave: OscillatorType;
}

const ROOT_FREQS = [130.81, 146.83, 155.56, 174.61, 196.0, 220.0, 233.08];

const THEME_SCALES: Record<QuartierTheme, number[]> = {
  MARKET: [0, 2, 4, 7, 9, 12, 14, 16],
  TRADITIONAL: [0, 3, 5, 7, 10, 12, 15, 17],
  MODERN: [0, 2, 3, 5, 7, 9, 10, 12],
  UNIVERSITY: [0, 2, 4, 5, 7, 9, 10, 12],
  HIGHWAY: [0, 1, 3, 5, 7, 8, 10, 12],
};

function semitoneToHz(root: number, semis: number): number {
  return root * Math.pow(2, semis / 12);
}

function getLevelSignature(level: number): LevelAudioSignature {
  const cfg = getLevelConfig(level);
  const rootHz = ROOT_FREQS[(level * 3 + cfg.quartier.index) % ROOT_FREQS.length];
  const scale = THEME_SCALES[cfg.quartier.theme];
  const bpm = Math.min(152, 114 + ((level - 1) % 10) * 3 + Math.floor((level - 1) / 10) * 4);

  // Deterministic 8-step melodic & bass patterns unique to each level
  const melodyPattern: number[] = [];
  const bassPattern: number[] = [];
  for (let step = 0; step < 8; step++) {
    const seed = (level * 17 + step * 13 + cfg.quartier.index * 7) % 11;
    melodyPattern.push(seed < 3 ? -1 : (seed + step) % scale.length);
    bassPattern.push(step % 2 === 0 ? (seed % 3 === 0 ? 2 : 0) : seed > 7 ? 3 : -1);
  }

  const waves: OscillatorType[] = ['triangle', 'sine', 'sawtooth', 'triangle', 'square'];
  const wave = waves[(level + cfg.quartier.index) % waves.length];

  return { rootHz, scale, bpm, melodyPattern, bassPattern, wave };
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private lastSirenTime: number = 0;
  private lastStepTime: number = 0;

  private musicTimer: number | null = null;
  private previewTimer: number | null = null;
  private currentMusicLevel: number = 1;
  private musicStep: number = 0;
  private musicActive: boolean = false;
  private customAudio: HTMLAudioElement | null = null;
  private customAudioToken: number = 0;
  private pendingCustomSong: { songId: string; loop: boolean } | null = null;
  private levelSongMap: Record<number, string> = {};

  constructor() {
    try {
      const saved = localStorage.getItem('cavale_ouaga_muted');
      if (saved === 'true') {
        this.muted = true;
      }
    } catch {
      // ignore storage errors
    }
    this.levelSongMap = getLevelSongMap();
    if (typeof window !== 'undefined') {
      void this.preloadAssignedSongs();
    }
  }

  public preloadAssignedSongs(): Promise<void> {
    this.levelSongMap = getLevelSongMap();
    const customIds: string[] = [];
    for (const val of Object.values(this.levelSongMap)) {
      if (typeof val === 'string' && val.startsWith('custom:')) {
        customIds.push(val.slice('custom:'.length));
      }
    }
    return preloadCustomSongs(customIds);
  }

  public refreshSongAssignments(): void {
    this.levelSongMap = getLevelSongMap();
    void this.preloadAssignedSongs();
    if (this.musicActive) {
      if (this.muted) {
        this.stopMusicLoopOnly();
      } else {
        this.startMusicLoop();
      }
    }
  }

  private resolveLevelTrack(level: number): { type: 'builtin'; trackLevel: number } | { type: 'custom'; songId: string } {
    const safeLevel = Math.max(1, Math.floor(level));
    const assignment = this.levelSongMap[safeLevel];
    if (assignment?.startsWith('custom:')) {
      return { type: 'custom', songId: assignment.slice('custom:'.length) };
    }
    if (assignment?.startsWith('builtin:')) {
      const trackLvl = Math.max(1, Math.floor(Number(assignment.slice('builtin:'.length)) || safeLevel));
      return { type: 'builtin', trackLevel: trackLvl };
    }
    return { type: 'builtin', trackLevel: safeLevel };
  }

  private ensureAudioElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.customAudio) {
      this.customAudio = new Audio();
      this.customAudio.preload = 'auto';
      this.customAudio.setAttribute('playsinline', '');
      this.customAudio.volume = 0.85;
      this.customAudio.onerror = () => {
        if (this.musicActive && !this.muted && this.musicTimer === null) {
          this.pendingCustomSong = null;
          this.startProceduralLoop(this.currentMusicLevel);
        }
      };
    }
    return this.customAudio;
  }

  private stopCustomAudio(): void {
    this.customAudioToken += 1;
    this.pendingCustomSong = null;
    if (this.customAudio) {
      try {
        this.customAudio.pause();
        if (this.customAudio.readyState >= 1) {
          this.customAudio.currentTime = 0;
        }
      } catch {
        // ignore audio reset issues
      }
    }
  }

  private startAudioElement(url: string, songId: string, loop: boolean, token: number): void {
    if (token !== this.customAudioToken || this.muted) return;
    const audio = this.ensureAudioElement();
    if (!audio) return;

    try {
      const sameSrc = audio.src === url;
      if (!sameSrc) {
        audio.src = url;
      } else if (audio.readyState >= 1) {
        try {
          audio.currentTime = 0;
        } catch {
          // ignore currentTime seek before metadata
        }
      }
      audio.loop = loop;
      audio.volume = 0.85;

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            if (token === this.customAudioToken) {
              this.pendingCustomSong = null;
            }
          })
          .catch((err: unknown) => {
            if (token !== this.customAudioToken || this.muted) return;
            const errName = (err as { name?: string })?.name || '';
            if (errName === 'NotAllowedError') {
              if (this.musicActive) {
                this.pendingCustomSong = { songId, loop };
              }
              return;
            }
            if (errName === 'AbortError') {
              return;
            }
            if (this.musicActive) {
              this.startProceduralLoop(this.currentMusicLevel);
            }
          });
      }
    } catch {
      if (token === this.customAudioToken && this.musicActive && !this.muted) {
        this.startProceduralLoop(this.currentMusicLevel);
      }
    }
  }

  private playCustomAudio(songId: string, loop: boolean): void {
    if (this.muted) return;
    const token = ++this.customAudioToken;

    // Try synchronous cache first so audio.play() runs inside the original user gesture!
    const syncUrl = getCachedCustomSongUrl(songId);
    if (syncUrl) {
      this.startAudioElement(syncUrl, songId, loop, token);
      return;
    }

    void getCustomSongUrl(songId).then((url) => {
      if (token !== this.customAudioToken || this.muted) return;
      if (!url) {
        if (this.musicActive) {
          this.startProceduralLoop(this.currentMusicLevel);
        }
        return;
      }
      this.startAudioElement(url, songId, loop, token);
    });
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private autoDisconnect(nodes: AudioNode[], osc: OscillatorNode): void {
    osc.onended = () => {
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch {
          // ignore
        }
      }
    };
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem('cavale_ouaga_muted', String(muted));
    } catch {
      // ignore
    }
    if (muted) {
      this.stopPreview();
      this.stopMusicLoopOnly();
    } else if (this.musicActive) {
      this.startMusicLoop();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.playClick();
    }
    return this.muted;
  }

  public unlock(): void {
    this.ensureContext();
    this.ensureAudioElement();
    if (this.pendingCustomSong && this.musicActive && !this.muted) {
      const pending = this.pendingCustomSong;
      this.pendingCustomSong = null;
      this.playCustomAudio(pending.songId, pending.loop);
    }
  }

  public startMusic(level: number): void {
    this.stopPreview();
    this.levelSongMap = getLevelSongMap();
    this.currentMusicLevel = Math.max(1, level);
    this.musicActive = true;
    this.musicStep = 0;
    this.startMusicLoop();
  }

  public setMusicLevel(level: number): void {
    const next = Math.max(1, level);
    if (this.currentMusicLevel === next) return;
    this.currentMusicLevel = next;
    if (this.musicActive && !this.muted) {
      this.startMusicLoop();
    }
  }

  public stopMusic(): void {
    this.musicActive = false;
    this.stopMusicLoopOnly();
  }

  private stopMusicLoopOnly(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.stopCustomAudio();
  }

  private previewEndedCb: (() => void) | null = null;

  public stopPreview(): void {
    if (this.previewTimer !== null) {
      window.clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    this.previewEndedCb = null;
    if (!this.musicActive) {
      this.stopCustomAudio();
    }
  }

  private startProceduralLoop(trackLevel: number): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    const sig = getLevelSignature(trackLevel);
    const stepMs = Math.round((60 / sig.bpm / 2) * 1000); // Eighth-note pulse

    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.musicActive) return;
      this.playGrooveStep(trackLevel, this.musicStep);
      this.musicStep = (this.musicStep + 1) % 8;
    }, stepMs);
  }

  private startMusicLoop(): void {
    this.stopMusicLoopOnly();
    if (this.muted || !this.musicActive) return;

    const resolved = this.resolveLevelTrack(this.currentMusicLevel);
    if (resolved.type === 'custom') {
      this.playCustomAudio(resolved.songId, true);
      return;
    }

    this.startProceduralLoop(resolved.trackLevel);
  }

  public previewBuiltinSong(trackLevel: number, onEnded?: () => void): void {
    this.unlock();
    this.stopPreview();
    if (this.muted) {
      onEnded?.();
      return;
    }

    this.previewEndedCb = onEnded ?? null;
    const safeTrack = Math.max(1, Math.floor(trackLevel));
    this.playLevelUp(safeTrack);
    let step = 0;
    const sig = getLevelSignature(safeTrack);
    const stepMs = Math.round((60 / sig.bpm / 2) * 1000);

    const runStep = () => {
      if (this.muted || this.musicActive) {
        const cb = this.previewEndedCb;
        this.previewEndedCb = null;
        cb?.();
        return;
      }
      if (step >= 8) {
        this.previewTimer = null;
        const cb = this.previewEndedCb;
        this.previewEndedCb = null;
        cb?.();
        return;
      }
      this.playGrooveStep(safeTrack, step);
      step += 1;
      this.previewTimer = window.setTimeout(runStep, stepMs);
    };
    this.previewTimer = window.setTimeout(runStep, 260);
  }

  public previewCustomSong(songId: string, onEnded?: () => void): void {
    this.unlock();
    this.stopPreview();
    if (this.muted) {
      onEnded?.();
      return;
    }

    this.previewEndedCb = onEnded ?? null;
    this.playCustomAudio(songId, false);
    this.previewTimer = window.setTimeout(() => {
      this.previewTimer = null;
      this.stopCustomAudio();
      const cb = this.previewEndedCb;
      this.previewEndedCb = null;
      cb?.();
    }, 15000);
  }

  public previewLevelSound(level: number, onEnded?: () => void): void {
    this.levelSongMap = getLevelSongMap();
    const resolved = this.resolveLevelTrack(level);
    if (resolved.type === 'custom') {
      this.previewCustomSong(resolved.songId, onEnded);
    } else {
      this.previewBuiltinSong(resolved.trackLevel, onEnded);
    }
  }

  private playGrooveStep(level: number, step: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const sig = getLevelSignature(level);
    const now = ctx.currentTime;

    // 1. Djembe / Dunun kick on downbeats & syncopated hits
    if (step === 0 || step === 4 || (level % 2 === 0 && step === 6)) {
      const kick = ctx.createOscillator();
      const kGain = ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(128, now);
      kick.frequency.exponentialRampToValueAtTime(48, now + 0.09);
      kGain.gain.setValueAtTime(0.085, now);
      kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      kick.connect(kGain);
      kGain.connect(ctx.destination);
      this.autoDisconnect([kick, kGain], kick);
      kick.start(now);
      kick.stop(now + 0.11);
    }

    // 2. Djembe slap / shaker off-beats
    if (step % 2 === 1 || step === 2) {
      const slap = ctx.createOscillator();
      const sGain = ctx.createGain();
      slap.type = 'triangle';
      const slapHz = step === 2 || step === 6 ? 340 : 620;
      slap.frequency.setValueAtTime(slapHz, now);
      slap.frequency.exponentialRampToValueAtTime(190, now + 0.04);
      sGain.gain.setValueAtTime(step % 2 === 1 ? 0.028 : 0.042, now);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      slap.connect(sGain);
      sGain.connect(ctx.destination);
      this.autoDisconnect([slap, sGain], slap);
      slap.start(now);
      slap.stop(now + 0.05);
    }

    // 3. Bassline pulse
    const bassDeg = sig.bassPattern[step];
    if (bassDeg >= 0) {
      const bassHz = semitoneToHz(sig.rootHz, sig.scale[bassDeg % sig.scale.length]);
      const bass = ctx.createOscillator();
      const bGain = ctx.createGain();
      bass.type = 'triangle';
      bass.frequency.setValueAtTime(bassHz, now);
      bGain.gain.setValueAtTime(0.065, now);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      bass.connect(bGain);
      bGain.connect(ctx.destination);
      this.autoDisconnect([bass, bGain], bass);
      bass.start(now);
      bass.stop(now + 0.18);
    }

    // 4. Balafon / Kora / Synth melody unique to this level
    const melDeg = sig.melodyPattern[step];
    if (melDeg >= 0) {
      const melHz = semitoneToHz(sig.rootHz * 2, sig.scale[melDeg % sig.scale.length]);
      const mel = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const mGain = ctx.createGain();
      filter.type = 'lowpass';
      filter.frequency.value = 2100;
      mel.type = sig.wave === 'sawtooth' || sig.wave === 'square' ? 'triangle' : sig.wave;
      mel.frequency.setValueAtTime(melHz, now);
      mGain.gain.setValueAtTime(0.052, now);
      mGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      mel.connect(filter);
      filter.connect(mGain);
      mGain.connect(ctx.destination);
      this.autoDisconnect([mel, filter, mGain], mel);
      mel.start(now);
      mel.stop(now + 0.16);
    }
  }

  public playClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.05);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    this.autoDisconnect([osc, gain], osc);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playFootstep(isWet: boolean = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const nowMs = performance.now();
    if (nowMs - this.lastStepTime < 150) return;
    this.lastStepTime = nowMs;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isWet ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isWet ? 240 : 105, now);
    osc.frequency.exponentialRampToValueAtTime(isWet ? 85 : 42, now + 0.048);
    gain.gain.setValueAtTime(isWet ? 0.036 : 0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    this.autoDisconnect([osc, gain], osc);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playThunder(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(68, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.75);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);
    filter.frequency.exponentialRampToValueAtTime(75, now + 0.8);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    this.autoDisconnect([osc, filter, gain], osc);
    osc.start(now);
    osc.stop(now + 0.88);
  }

  public playTaxiHorn(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const freq of [392, 493.88]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1100;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.022, now);
      gain.gain.setValueAtTime(0.022, now + 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      this.autoDisconnect([osc, filter, gain], osc);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  }

  public playJump(isDouble: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const startFreq = isDouble ? 320 : 210;
    const endFreq = isDouble ? 620 : 420;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.11);
    gain.gain.setValueAtTime(0.085, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    this.autoDisconnect([osc, gain], osc);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playSlide(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.14);
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    this.autoDisconnect([osc, gain], osc);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playCoin(isBill: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const f1 = isBill ? 784 : 988;
    const f2 = isBill ? 1175 : 1319;
    osc.frequency.setValueAtTime(f1, now);
    osc.frequency.setValueAtTime(f2, now + 0.045);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    this.autoDisconnect([osc, gain], osc);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playPowerUp(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.045;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.085, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      this.autoDisconnect([osc, gain], osc);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  public playLevelUp(level: number = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sig = getLevelSignature(level);
    const notes = [
      semitoneToHz(sig.rootHz * 2, sig.scale[0]),
      semitoneToHz(sig.rootHz * 2, sig.scale[2 % sig.scale.length]),
      semitoneToHz(sig.rootHz * 2, sig.scale[4 % sig.scale.length]),
      semitoneToHz(sig.rootHz * 4, sig.scale[0]),
    ];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.095, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      this.autoDisconnect([osc, gain], osc);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  public playStumble(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.18);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    this.autoDisconnect([osc, gain], osc);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playShieldBreak(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.22);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    this.autoDisconnect([osc, gain], osc);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playSirenPulse(dangerLevel: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const nowMs = performance.now();
    const interval = dangerLevel > 68 ? 480 : 880;
    if (nowMs - this.lastSirenTime < interval) return;
    this.lastSirenTime = nowMs;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    const high = Math.floor(nowMs / 460) % 2 === 0;
    osc.frequency.setValueAtTime(high ? 670 : 505, now);
    const vol = Math.min(0.042, 0.012 + (dangerLevel / 100) * 0.03);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    this.autoDisconnect([osc, filter, gain], osc);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playBusted(): void {
    this.stopMusic();
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const whistle = ctx.createOscillator();
    const wGain = ctx.createGain();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(1950, now);
    whistle.frequency.setValueAtTime(1820, now + 0.08);
    whistle.frequency.setValueAtTime(2040, now + 0.16);
    wGain.gain.setValueAtTime(0.08, now);
    wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    whistle.connect(wGain);
    wGain.connect(ctx.destination);
    this.autoDisconnect([whistle, wGain], whistle);
    whistle.start(now);
    whistle.stop(now + 0.37);

    const bass = ctx.createOscillator();
    const bGain = ctx.createGain();
    bass.type = 'sawtooth';
    bass.frequency.setValueAtTime(130, now);
    bass.frequency.exponentialRampToValueAtTime(42, now + 0.35);
    bGain.gain.setValueAtTime(0.12, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    bass.connect(bGain);
    bGain.connect(ctx.destination);
    this.autoDisconnect([bass, bGain], bass);
    bass.start(now);
    bass.stop(now + 0.4);
  }

  public playAchievementUnlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.065;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.085, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      this.autoDisconnect([osc, gain], osc);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}

export const soundEngine = new SoundEngine();

