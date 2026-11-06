import type { SettingsStore } from '../progression/Settings.ts';
import { scheduleClip, type ClipOptions } from './sound/schedule.ts';
import { CLIPS, GENERIC_IMPACT, IMPACT_GAIN_DB, KNOCKOUT, type ClipId } from './sound/soundCatalog.ts';
import { CLIP_URLS } from './sound/soundFiles.ts';

export type SoundName =
  | 'hit'
  | 'critical'
  | 'ability'
  | 'heal'
  | 'guard'
  | 'dodge'
  | 'buff'
  | 'debuff'
  | 'toss'
  | 'knockout'
  | 'victory'
  | 'defeat'
  | 'select'
  | 'turn';

/** O que a apresentação da luta precisa do áudio (permite testar sem Web Audio). */
export interface AudioSink {
  play(name: SoundName): void;
  /**
   * Toca um arquivo. Devolve o instante (relógio `performance.now()`, em ms) em que o momento
   * principal do som vai soar, ou `null` se nada foi tocado (som desligado, arquivo ausente).
   */
  playClip(clip: ClipId, options?: ClipOptions): number | null;
}

export interface AudioManagerOptions {
  /** Cria o AudioContext (nos testes, um substituto). */
  createContext?: () => AudioContext | null;
  /** Baixa um arquivo de som. */
  fetchClip?: (url: string) => Promise<ArrayBuffer>;
  urls?: Readonly<Record<ClipId, string>>;
}

interface Voice {
  clip: ClipId;
  source: AudioBufferSourceNode;
  gain: GainNode;
  startedAt: number;
  offset: number;
}

type AudioContextConstructor = typeof AudioContext;

/** Máximo de arquivos tocando ao mesmo tempo; o mais antigo é encerrado quando passa disso. */
export const MAX_VOICES = 6;
/** O mesmo trecho pedido de novo nesse intervalo (s) é ignorado: evita impacto duplicado. */
const REPEAT_GUARD = 0.05;

function defaultContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor: AudioContextConstructor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

async function defaultFetch(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Som indisponível: ${url}`);
  return response.arrayBuffer();
}

const dbToGain = (db: number): number => 10 ** (db / 20);
const now = (): number => (typeof performance === 'undefined' ? Date.now() : performance.now());

/**
 * Efeitos sonoros do jogo.
 *
 * - Arquivos (habilidades, impacto genérico e nocaute): decodificados uma vez e tocados por
 *   Web Audio, com início, trecho e fade calculados para acompanhar a animação.
 * - Sons sintetizados (menus, defesa, cura, bônus, vitória...): gerados na hora.
 *
 * Tudo passa por um compressor de segurança (evita distorção quando sons se sobrepõem) e
 * pelo volume geral das opções. Com o som desligado, nada toca e o que estiver tocando para.
 */
export class AudioManager implements AudioSink {
  private readonly settings: SettingsStore;
  private readonly createContext: () => AudioContext | null;
  private readonly fetchClip: (url: string) => Promise<ArrayBuffer>;
  private readonly urls: Readonly<Record<ClipId, string>>;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: AudioNode | null = null;
  private readonly buffers = new Map<ClipId, AudioBuffer>();
  private readonly loading = new Map<ClipId, Promise<void>>();
  private voices: Voice[] = [];

  constructor(settings: SettingsStore, options: AudioManagerOptions = {}) {
    this.settings = settings;
    this.createContext = options.createContext ?? defaultContext;
    this.fetchClip = options.fetchClip ?? defaultFetch;
    this.urls = options.urls ?? CLIP_URLS;
    settings.subscribe(() => {
      this.applyVolume();
      if (!this.enabled) this.stopAll();
    });
  }

  /** Deve ser chamado em resposta a um gesto do usuário para liberar o áudio no navegador. */
  unlock(): void {
    const context = this.ensureContext();
    if (context?.state === 'suspended') void context.resume();
  }

  /** Quantos arquivos estão tocando agora. */
  get activeVoices(): number {
    return this.voices.length;
  }

  /** Arquivos já decodificados e prontos. */
  get loadedClips(): ClipId[] {
    return [...this.buffers.keys()];
  }

  /**
   * Prepara os arquivos de uma luta e libera os que não serão usados nela, para não acumular
   * memória ao trocar de personagens.
   */
  async preload(clips: readonly ClipId[]): Promise<void> {
    const keep = new Set<ClipId>(clips);
    for (const clip of this.buffers.keys()) if (!keep.has(clip)) this.buffers.delete(clip);
    if (!this.ensureContext()) return;
    await Promise.all(clips.map((clip) => this.load(clip)));
  }

  /** Toca um arquivo, alinhado com a animação conforme `options`. */
  playClip(clip: ClipId, options: ClipOptions = {}): number | null {
    if (!this.enabled) return null;
    const context = this.ensureContext();
    if (!context || !this.bus || context.state !== 'running') return null;
    const buffer = this.buffers.get(clip);
    if (!buffer) {
      // Ainda não carregado: carrega para as próximas vezes, sem atrasar a luta.
      void this.load(clip);
      return null;
    }
    const plan = scheduleClip(CLIPS[clip], buffer.duration, options);
    if (!plan) return null;

    const startAt = context.currentTime + plan.delay;
    if (this.voices.some((voice) => voice.clip === clip && Math.abs(voice.startedAt - startAt) < REPEAT_GUARD && Math.abs(voice.offset - plan.offset) < REPEAT_GUARD)) {
      return null;
    }
    const hit = options.segment?.hitAt ?? CLIPS[clip].hitAt;
    const hitInMs = (plan.delay + Math.max(0, hit - plan.offset)) * 1000;
    while (this.voices.length >= MAX_VOICES) this.stopVoice(this.voices[0]);

    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    const level = dbToGain((CLIPS[clip].gainDb ?? 0) + (options.gainDb ?? 0));
    gain.gain.setValueAtTime(level, startAt);
    if (plan.fadeOut > 0) {
      const fadeStart = startAt + plan.duration - plan.fadeOut;
      gain.gain.setValueAtTime(level, fadeStart);
      gain.gain.linearRampToValueAtTime(0.0001, startAt + plan.duration);
    }
    source.connect(gain).connect(this.bus);

    const voice: Voice = { clip, source, gain, startedAt: startAt, offset: plan.offset };
    this.voices.push(voice);
    source.onended = () => this.release(voice);
    source.start(startAt, plan.offset, plan.duration);
    return now() + hitInMs;
  }

  /** Para todos os arquivos (fim da luta, troca de tela, som desligado). */
  stopAll(): void {
    for (const voice of [...this.voices]) this.stopVoice(voice);
  }

  play(name: SoundName): void {
    if (!this.enabled) return;

    switch (name) {
      case 'hit':
        this.playClip(GENERIC_IMPACT);
        break;
      case 'critical':
        // Reforço discreto: o mesmo impacto um pouco mais alto e um tom grave curto.
        this.playClip(GENERIC_IMPACT, { gainDb: IMPACT_GAIN_DB.critical });
        this.tone(220, 90, 0.22, 'square', 0.1);
        break;
      case 'knockout':
        this.playClip(KNOCKOUT, { gainDb: -1 });
        break;
      case 'ability':
        this.noise(0.35, 900, 3200, 0.25);
        this.tone(320, 760, 0.3, 'sawtooth', 0.08);
        break;
      case 'toss':
        this.noise(0.22, 600, 2400, 0.16);
        break;
      case 'heal':
        this.arpeggio([523, 659, 784], 0.09, 'sine', 0.16);
        break;
      case 'guard':
        this.tone(660, 640, 0.35, 'triangle', 0.2);
        this.tone(990, 980, 0.25, 'sine', 0.08);
        break;
      case 'dodge':
        this.noise(0.18, 2400, 600, 0.18);
        break;
      case 'buff':
        this.arpeggio([392, 523, 659, 784], 0.06, 'triangle', 0.12);
        break;
      case 'debuff':
        this.tone(330, 140, 0.4, 'sawtooth', 0.09);
        break;
      case 'victory':
        this.arpeggio([392, 523, 659, 784, 1047], 0.11, 'triangle', 0.18);
        break;
      case 'defeat':
        this.arpeggio([392, 330, 262, 196], 0.18, 'sine', 0.18);
        break;
      case 'select':
        this.tone(880, 1180, 0.07, 'sine', 0.08);
        break;
      case 'turn':
        this.tone(523, 523, 0.12, 'triangle', 0.07);
        break;
    }
  }

  /* Internos ------------------------------------------------------------ */

  private get enabled(): boolean {
    const { soundEnabled, volume } = this.settings.value;
    return soundEnabled && volume > 0;
  }

  private load(clip: ClipId): Promise<void> {
    if (this.buffers.has(clip)) return Promise.resolve();
    const pending = this.loading.get(clip);
    if (pending) return pending;
    const context = this.ensureContext();
    if (!context) return Promise.resolve();
    const task = this.fetchClip(this.urls[clip])
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(clip, buffer);
      })
      .catch(() => undefined)
      .finally(() => this.loading.delete(clip));
    this.loading.set(clip, task);
    return task;
  }

  private stopVoice(voice: Voice): void {
    try {
      voice.source.stop();
    } catch {
      // Já tinha terminado.
    }
    this.release(voice);
  }

  private release(voice: Voice): void {
    if (!this.voices.includes(voice)) return;
    this.voices = this.voices.filter((other) => other !== voice);
    voice.source.disconnect();
    voice.gain.disconnect();
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    const context = this.createContext();
    if (!context) return null;
    this.context = context;
    this.master = context.createGain();
    // Compressor de segurança: só age em picos, quando vários sons coincidem.
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    limiter.connect(this.master);
    this.master.connect(context.destination);
    this.bus = limiter;
    this.applyVolume();
    return context;
  }

  private applyVolume(): void {
    if (this.master) this.master.gain.value = this.settings.value.volume;
  }

  private tone(from: number, to: number, duration: number, type: OscillatorType, gain: number, delay = 0): void {
    const context = this.ensureContext();
    if (!context || !this.bus || context.state !== 'running') return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(this.bus);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  private arpeggio(notes: number[], step: number, type: OscillatorType, gain: number): void {
    notes.forEach((note, index) => this.tone(note, note, step * 2.2, type, gain, index * step));
  }

  private noise(duration: number, fromHz: number, toHz: number, gain: number): void {
    const context = this.ensureContext();
    if (!context || !this.bus || context.state !== 'running') return;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    const start = context.currentTime;
    filter.frequency.setValueAtTime(fromHz, start);
    filter.frequency.exponentialRampToValueAtTime(toHz, start + duration);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(envelope).connect(this.bus);
    source.start(start);
  }
}
