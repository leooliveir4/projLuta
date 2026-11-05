import fatalityUrl from '../assets/sounds/fatality.mp3';
import punchUrl from '../assets/sounds/punch.mp3';
import type { SettingsStore } from '../progression/Settings.ts';

export type SoundName =
  | 'hit'
  | 'critical'
  | 'ability'
  | 'heal'
  | 'guard'
  | 'dodge'
  | 'buff'
  | 'debuff'
  | 'knockout'
  | 'victory'
  | 'defeat'
  | 'select'
  | 'turn';

type AudioContextConstructor = typeof AudioContext;

/**
 * Efeitos sonoros: os dois sons do projeto original (golpe e fatality)
 * e sons sintetizados com Web Audio para as demais ações.
 */
export class AudioManager {
  private readonly settings: SettingsStore;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly samples = new Map<string, HTMLAudioElement>();

  constructor(settings: SettingsStore) {
    this.settings = settings;
    this.samples.set('punch', this.createSample(punchUrl));
    this.samples.set('fatality', this.createSample(fatalityUrl));
    settings.subscribe(() => this.applyVolume());
  }

  /** Deve ser chamado em resposta a um gesto do usuário para liberar o áudio no navegador. */
  unlock(): void {
    const context = this.ensureContext();
    if (context?.state === 'suspended') void context.resume();
  }

  play(name: SoundName): void {
    const { soundEnabled, volume } = this.settings.value;
    if (!soundEnabled || volume <= 0) return;

    switch (name) {
      case 'hit':
        this.playSample('punch', 0.9);
        break;
      case 'critical':
        this.playSample('punch', 1);
        this.tone(220, 90, 0.22, 'square', 0.18);
        break;
      case 'knockout':
        this.playSample('fatality', 0.9);
        break;
      case 'ability':
        this.noise(0.35, 900, 3200, 0.25);
        this.tone(320, 760, 0.3, 'sawtooth', 0.08);
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

  private createSample(url: string): HTMLAudioElement {
    const audio = new Audio(url);
    audio.preload = 'auto';
    return audio;
  }

  private playSample(key: string, gain: number): void {
    const sample = this.samples.get(key);
    if (!sample) return;
    const instance = sample.cloneNode(true) as HTMLAudioElement;
    instance.volume = Math.min(1, this.settings.value.volume * gain);
    void instance.play().catch(() => undefined);
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    const Ctor: AudioContextConstructor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!Ctor) return null;
    this.context = new Ctor();
    this.master = this.context.createGain();
    this.master.connect(this.context.destination);
    this.applyVolume();
    return this.context;
  }

  private applyVolume(): void {
    if (this.master) this.master.gain.value = this.settings.value.volume;
  }

  private tone(from: number, to: number, duration: number, type: OscillatorType, gain: number, delay = 0): void {
    const context = this.ensureContext();
    if (!context || !this.master || context.state !== 'running') return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  private arpeggio(notes: number[], step: number, type: OscillatorType, gain: number): void {
    notes.forEach((note, index) => this.tone(note, note, step * 2.2, type, gain, index * step));
  }

  private noise(duration: number, fromHz: number, toHz: number, gain: number): void {
    const context = this.ensureContext();
    if (!context || !this.master || context.state !== 'running') return;
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
    source.connect(filter).connect(envelope).connect(this.master);
    source.start(start);
  }
}
