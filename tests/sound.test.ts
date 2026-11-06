import { describe, expect, it } from 'vitest';
import { ECLIPSE_ID, Nyxara } from '../src/core/characters/Nyxara.ts';
import { CHARACTER_IDS, createCharacter } from '../src/core/roster.ts';
import type { BattleEvent, Side } from '../src/core/types.ts';
import { SettingsStore } from '../src/progression/Settings.ts';
import { AudioManager, MAX_VOICES, type AudioSink, type SoundName } from '../src/ui/AudioManager.ts';
import { actionOutcome, BattleSound, NO_DELAY, SYNC_SLACK_MS } from '../src/ui/sound/BattleSound.ts';
import { scheduleClip, type ClipOptions } from '../src/ui/sound/schedule.ts';
import { CLIP_URLS } from '../src/ui/sound/soundFiles.ts';
import {
  ABILITY_CUES,
  abilityCue,
  CLIPS,
  clipsFor,
  FORM_CLIPS,
  GENERIC_IMPACT,
  TURRET_SHOT_CUE,
  type ClipId,
} from '../src/ui/sound/soundCatalog.ts';
import { act, createBattle } from './helpers.ts';

/* Apoio -------------------------------------------------------------------- */

type Call = { kind: 'clip'; clip: ClipId; options: ClipOptions } | { kind: 'synth'; name: SoundName };

class RecordingSink implements AudioSink {
  calls: Call[] = [];
  play(name: SoundName): void {
    this.calls.push({ kind: 'synth', name });
  }
  playClip(clip: ClipId, options: ClipOptions = {}): number {
    this.calls.push({ kind: 'clip', clip, options });
    return 1000 + (options.alignInMs ?? 0);
  }
  clips(): ClipId[] {
    return this.calls.flatMap((call) => (call.kind === 'clip' ? [call.clip] : []));
  }
  synths(): SoundName[] {
    return this.calls.flatMap((call) => (call.kind === 'synth' ? [call.name] : []));
  }
  clear(): void {
    this.calls = [];
  }
}

const TIMING = { launchMs: 300, impactMs: 600 };

function damage(source: Side, kind: 'basic' | 'ability' | 'periodic' | 'counter' | 'turret', critical = false): Extract<BattleEvent, { type: 'damage' }> {
  return { type: 'damage', source, target: source === 'player' ? 'enemy' : 'player', amount: 10, kind, critical, guarded: false, hpAfter: 100 };
}

/** Repete, na ordem, o que a BattleUI faz com o som a cada evento. */
function feed(sound: BattleSound, events: readonly BattleEvent[]): void {
  events.forEach((event, index) => {
    switch (event.type) {
      case 'turn-start':
        sound.endAction();
        break;
      case 'action': {
        const outcome = actionOutcome(events, index);
        const action =
          event.action.type === 'attack'
            ? ({ type: 'attack' } as const)
            : event.action.type === 'ability'
              ? ({ type: 'ability', abilityId: event.action.abilityId } as const)
              : ({ type: 'other' } as const);
        sound.action(event.side, action, outcome, NO_DELAY);
        break;
      }
      case 'damage':
        sound.beforeHit(event, NO_DELAY);
        sound.impact(event);
        break;
      case 'dodge':
        sound.dodge(event);
        break;
      case 'form-change':
        sound.formChange(event.target, event.form, 0);
        break;
      case 'defeated':
        sound.knockout();
        break;
      default:
        break;
    }
  });
}

/* Catálogo ------------------------------------------------------------------ */

describe('catálogo sonoro', () => {
  it('associa cada arquivo à habilidade pedida', () => {
    const expected: [string, string, ClipId][] = [
      ['astral-orb', 'base', 'lyra-astral-orb'],
      ['supernova', 'base', 'lyra-supernova'],
      ['piercing-burst', 'base', 'vexra-piercing-burst'],
      ['explosive-grenade', 'base', 'vexra-explosive-grenade'],
      ['devastating-blow', 'base', 'dravenor-devastating-blow'],
      ['earth-rupture', 'base', 'dravenor-earth-rupture'],
      ['arcane-blade', 'base', 'kael-arcane-blade'],
      ['dimensional-cut', 'base', 'kael-dimensional-cut'],
      ['shadow-blade', 'base', 'nyxara-shadow-blade'],
      ['shadow-blade', 'eclipse', 'vaelith-shadow-blade'],
      ['abyss-impact', 'base', 'vorath-abyss-impact'],
      ['void-rupture', 'base', 'vorath-void-rupture'],
    ];
    for (const [ability, form, clip] of expected) expect(abilityCue(ability, form)?.clip, `${ability}@${form}`).toBe(clip);
    expect(TURRET_SHOT_CUE.clip).toBe('vexra-auto-turret-shot');
    expect(FORM_CLIPS.eclipse).toBe('nyxara-eclipse');
    expect(GENERIC_IMPACT).toBe('general-combat-impact');
  });

  it('cada som pertence a uma habilidade real do personagem indicado', () => {
    for (const [key, cue] of Object.entries(ABILITY_CUES)) {
      const abilityId = key.split('@')[0];
      const ids = createCharacter(cue.character).abilities.map((ability) => ability.id);
      expect(ids, key).toContain(abilityId);
    }
    expect(createCharacter('vexra').abilities.map((ability) => ability.id)).toContain('auto-turret');
  });

  it('todos os arquivos existem e o ponto principal fica dentro deles', () => {
    for (const [clip, info] of Object.entries(CLIPS) as [ClipId, (typeof CLIPS)[ClipId]][]) {
      // O Vite só resolve a importação se o arquivo existir; um arquivo faltando quebra o teste.
      const file = clip === 'knockout' ? 'fatality.mp3' : `${clip}.mp3`;
      expect(CLIP_URLS[clip], clip).toContain(file);
      expect(info.hitAt, clip).toBeGreaterThanOrEqual(0);
      expect(info.hitAt, clip).toBeLessThan(info.duration);
    }
  });

  it('pré-carrega só os sons dos dois lutadores', () => {
    const clips = clipsFor(['lyra', 'vorath']);
    expect(clips).toEqual(expect.arrayContaining(['lyra-supernova', 'vorath-void-rupture', GENERIC_IMPACT, 'knockout']));
    expect(clips).not.toContain('kael-arcane-blade');
    expect(clips).not.toContain('nyxara-eclipse');
    expect(clipsFor(['nyxara', 'kael'])).toEqual(expect.arrayContaining(['nyxara-eclipse', 'vaelith-shadow-blade']));
    expect(clipsFor(['vexra', 'kael'])).toContain('vexra-auto-turret-shot');
    for (const id of CHARACTER_IDS) expect(clipsFor([id])).toContain(GENERIC_IMPACT);
  });
});

/* Agendamento ---------------------------------------------------------------- */

describe('agendamento dos arquivos', () => {
  const info = { duration: 2.5, hitAt: 0.9 };

  it('atrasa o início quando há tempo até o acontecimento visual', () => {
    const plan = scheduleClip(info, 2.5, { alignInMs: 1200 })!;
    expect(plan.delay).toBeCloseTo(0.3);
    expect(plan.offset).toBe(0);
    expect(plan.delay + (info.hitAt - plan.offset)).toBeCloseTo(1.2);
  });

  it('pula parte da preparação quando falta tempo', () => {
    const plan = scheduleClip(info, 2.5, { alignInMs: 500 })!;
    expect(plan.delay).toBe(0);
    expect(plan.offset).toBeCloseTo(0.4);
    expect(info.hitAt - plan.offset).toBeCloseTo(0.5);
  });

  it('sem antecedência, mantém só um ataque mínimo antes do golpe', () => {
    const plan = scheduleClip(info, 2.5, { alignInMs: 0 })!;
    expect(plan.offset).toBeCloseTo(0.87);
  });

  it('num golpe que erra, termina antes do momento principal', () => {
    const plan = scheduleClip(info, 2.5, { alignInMs: 1000, cutBeforeHit: true })!;
    expect(plan.offset + plan.duration).toBeLessThan(info.hitAt);
    expect(plan.fadeOut).toBeGreaterThan(0);
  });

  it('respeita trechos (golpes múltiplos)', () => {
    const plan = scheduleClip({ duration: 1.6, hitAt: 0.01 }, 1.6, { alignInMs: 0, segment: { from: 0.22, hitAt: 0.26 } })!;
    expect(plan.offset).toBeGreaterThanOrEqual(0.22);
    expect(plan.offset + plan.duration).toBeCloseTo(1.6);
  });
});

/* Decisões da luta ------------------------------------------------------------- */

describe('som das ações', () => {
  it('habilidade com som próprio: arquivo alinhado e sem impacto genérico por cima', () => {
    const sink = new RecordingSink();
    const sound = new BattleSound(sink);
    const sync = sound.action('player', { type: 'ability', abilityId: 'supernova' }, { hits: 1, dodged: false }, TIMING);
    // O som é agendado com uma folga, e a animação espera por ele no impacto.
    expect(sink.calls).toEqual([{ kind: 'clip', clip: 'lyra-supernova', options: { alignInMs: 600 + SYNC_SLACK_MS, segment: undefined } }]);
    expect(sync).toEqual({ moment: 'impact', at: 1000 + 600 + SYNC_SLACK_MS });
    sound.beforeHit(damage('player', 'ability'));
    sound.impact(damage('player', 'ability'));
    expect(sink.synths()).toEqual([]);
    expect(sink.clips()).toEqual(['lyra-supernova']);
  });

  it('sons de disparo alinham com a saída do projétil', () => {
    const sink = new RecordingSink();
    const sync = new BattleSound(sink).action('player', { type: 'ability', abilityId: 'astral-orb' }, { hits: 1, dodged: false }, TIMING);
    expect(sink.calls[0]).toMatchObject({ clip: 'lyra-astral-orb', options: { alignInMs: 300 + SYNC_SLACK_MS } });
    expect(sync?.moment).toBe('launch');
  });

  it('habilidade sem arquivo usa o som sintetizado e o impacto genérico', () => {
    const sink = new RecordingSink();
    const sound = new BattleSound(sink);
    sound.action('player', { type: 'ability', abilityId: 'star-field' }, { hits: 1, dodged: false }, TIMING);
    sound.beforeHit(damage('player', 'ability'));
    sound.impact(damage('player', 'ability'));
    expect(sink.synths()).toEqual(['ability', 'hit']);
    expect(sink.clips()).toEqual([]);
  });

  it('ataque básico usa o impacto genérico; o crítico ganha reforço', () => {
    const sink = new RecordingSink();
    const sound = new BattleSound(sink);
    sound.action('player', { type: 'attack' }, { hits: 1, dodged: false }, TIMING);
    sound.impact(damage('player', 'basic'));
    sound.action('player', { type: 'attack' }, { hits: 1, dodged: false }, TIMING);
    sound.impact(damage('player', 'basic', true));
    expect(sink.synths()).toEqual(['hit', 'critical']);
  });

  it('dano contínuo usa o impacto genérico mais baixo', () => {
    const sink = new RecordingSink();
    new BattleSound(sink).impact(damage('enemy', 'periodic'));
    expect(sink.calls).toEqual([{ kind: 'clip', clip: GENERIC_IMPACT, options: { gainDb: -9 } }]);
  });

  it('esquiva não toca impacto confirmado', () => {
    const sink = new RecordingSink();
    const sound = new BattleSound(sink);
    // Preparação longa: soa só até antes do golpe.
    sound.action('player', { type: 'ability', abilityId: 'shadow-blade' }, { hits: 0, dodged: true }, TIMING);
    expect(sink.calls[0]).toMatchObject({ clip: 'nyxara-shadow-blade', options: { cutBeforeHit: true } });
    sound.dodge({ type: 'dodge', source: 'player', target: 'enemy' });
    // Golpe seco: na esquiva, nada do arquivo toca.
    sound.action('player', { type: 'ability', abilityId: 'arcane-blade' }, { hits: 0, dodged: true }, TIMING);
    sound.dodge({ type: 'dodge', source: 'player', target: 'enemy' });
    // Ataque básico esquivado: só o som de esquiva.
    sound.action('player', { type: 'attack' }, { hits: 0, dodged: true }, TIMING);
    sound.dodge({ type: 'dodge', source: 'player', target: 'enemy' });
    expect(sink.clips()).toEqual(['nyxara-shadow-blade']);
    expect(sink.synths()).toEqual(['dodge', 'dodge', 'dodge']);
  });

  it('disparos tocam mesmo quando o alvo esquiva', () => {
    const sink = new RecordingSink();
    new BattleSound(sink).action('player', { type: 'ability', abilityId: 'astral-orb' }, { hits: 0, dodged: true }, TIMING);
    expect(sink.calls[0]).toMatchObject({ clip: 'lyra-astral-orb' });
    expect(sink.calls[0]).not.toMatchObject({ options: { cutBeforeHit: true } });
  });

  it('Rajada Perfurante: um trecho do arquivo por tiro', () => {
    const sink = new RecordingSink();
    const sound = new BattleSound(sink);
    sound.action('player', { type: 'ability', abilityId: 'piercing-burst' }, { hits: 2, dodged: false }, TIMING);
    sound.beforeHit(damage('player', 'ability'));
    sound.impact(damage('player', 'ability'));
    sound.beforeHit(damage('player', 'ability'));
    sound.impact(damage('player', 'ability'));
    const segments = sink.calls.map((call) => (call.kind === 'clip' ? call.options.segment?.from : call.name));
    expect(segments).toEqual([0, 0.22]);
  });
});

describe('torre automática', () => {
  it('cada dano da torre toca um disparo; a implantação usa o som sintetizado', () => {
    const sink = new RecordingSink();
    const sound = new BattleSound(sink);
    sound.action('player', { type: 'ability', abilityId: 'auto-turret' }, { hits: 0, dodged: false }, NO_DELAY);
    expect(sink.synths()).toEqual(['ability']);
    for (let i = 0; i < 3; i += 1) {
      sound.endAction();
      sound.beforeHit(damage('player', 'turret'));
      sound.impact(damage('player', 'turret'));
    }
    expect(sink.clips()).toEqual(['vexra-auto-turret-shot', 'vexra-auto-turret-shot', 'vexra-auto-turret-shot']);
    expect(sink.synths()).toEqual(['ability']);
  });

  it('numa luta real, o número de tiros ouvidos é o de disparos registrados pelo motor', () => {
    const engine = createBattle('vexra', 'dravenor');
    const events: BattleEvent[] = [...act(engine, 'player', { type: 'ability', abilityId: 'auto-turret' })];
    for (let turn = 0; turn < 3 && !engine.isOver; turn += 1) {
      events.push(...act(engine, 'enemy', { type: 'defend' }));
      if (!engine.isOver) events.push(...act(engine, 'player', { type: 'defend' }));
    }
    const shots = events.filter((event) => event.type === 'damage' && event.kind === 'turret').length;
    expect(shots).toBeGreaterThan(0);
    const sink = new RecordingSink();
    feed(new BattleSound(sink), events);
    expect(sink.clips().filter((clip) => clip === 'vexra-auto-turret-shot')).toHaveLength(shots);
  });
});

describe('Nyxara e Vaelith', () => {
  it('a mesma habilidade soa diferente conforme a forma ativa', () => {
    const sink = new RecordingSink();
    const sound = new BattleSound(sink);
    sound.action('player', { type: 'ability', abilityId: 'shadow-blade' }, { hits: 1, dodged: false }, TIMING);
    sound.formChange('player', 'eclipse', 620);
    sound.action('player', { type: 'ability', abilityId: 'shadow-blade' }, { hits: 1, dodged: false }, TIMING);
    sound.formChange('player', 'base', 0);
    sound.action('player', { type: 'ability', abilityId: 'shadow-blade' }, { hits: 1, dodged: false }, TIMING);
    expect(sink.clips()).toEqual(['nyxara-shadow-blade', 'nyxara-eclipse', 'vaelith-shadow-blade', 'nyxara-shadow-blade']);
  });

  it('a forma do adversário não interfere', () => {
    const sink = new RecordingSink();
    const sound = new BattleSound(sink, { player: 'base', enemy: 'eclipse' });
    sound.action('player', { type: 'ability', abilityId: 'shadow-blade' }, { hits: 1, dodged: false }, TIMING);
    expect(sink.clips()).toEqual(['nyxara-shadow-blade']);
  });

  it('a transformação toca uma única vez, sem o som genérico de habilidade', () => {
    const sink = new RecordingSink();
    const sound = new BattleSound(sink);
    sound.action('player', { type: 'ability', abilityId: ECLIPSE_ID }, { hits: 0, dodged: false }, NO_DELAY);
    expect(sound.formChange('player', 'eclipse', 620)).toEqual({ moment: 'flash', at: 1000 + 620 + SYNC_SLACK_MS });
    expect(sound.formChange('player', 'eclipse', 620)).toBeNull();
    expect(sink.calls).toEqual([{ kind: 'clip', clip: 'nyxara-eclipse', options: { alignInMs: 620 + SYNC_SLACK_MS } }]);
    sound.formChange('player', 'base', 0);
    expect(sink.synths()).toEqual(['buff']);
  });

  it('numa luta real: um som de Eclipse por transformação e a lâmina certa em cada forma', () => {
    const engine = createBattle('nyxara', 'vorath');
    const nyx = engine.character('player') as Nyxara;
    const events: BattleEvent[] = [];
    while (nyx.influence < 100) {
      events.push(...act(engine, 'player', { type: 'attack' }));
      events.push(...act(engine, 'enemy', { type: 'defend' }));
    }
    events.push(...act(engine, 'player', { type: 'ability', abilityId: ECLIPSE_ID }));
    events.push(...act(engine, 'enemy', { type: 'defend' }));
    events.push(...act(engine, 'player', { type: 'ability', abilityId: 'shadow-blade' }));
    const sink = new RecordingSink();
    feed(new BattleSound(sink), events);
    expect(sink.clips().filter((clip) => clip === 'nyxara-eclipse')).toHaveLength(1);
    expect(sink.clips()).toContain('vaelith-shadow-blade');
    expect(sink.clips()).not.toContain('nyxara-shadow-blade');
    // Nenhum som genérico de habilidade junto com o Eclipse.
    expect(sink.synths()).not.toContain('ability');
  });
});

describe('leitura do resultado da ação', () => {
  it('conta os danos da ação e para no próximo turno', () => {
    const events: BattleEvent[] = [
      { type: 'action', side: 'player', action: { type: 'ability', abilityId: 'piercing-burst' }, label: 'Rajada' },
      damage('player', 'ability'),
      damage('player', 'ability'),
      { type: 'turn-start', turn: 2, side: 'enemy' },
      damage('player', 'turret'),
    ];
    expect(actionOutcome(events, 0)).toEqual({ hits: 2, dodged: false });
    expect(actionOutcome([events[0], { type: 'dodge', source: 'player', target: 'enemy' }], 0)).toEqual({ hits: 0, dodged: true });
  });
});

/* AudioManager ------------------------------------------------------------------- */

class FakeParam {
  value = 1;
  events: string[] = [];
  setValueAtTime(value: number): void {
    this.events.push(`set:${value.toFixed(2)}`);
  }
  linearRampToValueAtTime(): void {
    this.events.push('ramp');
  }
  exponentialRampToValueAtTime(): void {
    this.events.push('exp');
  }
}

class FakeNode {
  gain = new FakeParam();
  threshold = new FakeParam();
  knee = new FakeParam();
  ratio = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  type = '';
  connect<T>(target: T): T {
    return target;
  }
  disconnect(): void {}
}

class FakeSource extends FakeNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  started: { when: number; offset?: number; duration?: number } | null = null;
  stopped = false;
  start(when = 0, offset?: number, duration?: number): void {
    this.started = { when, offset, duration };
  }
  stop(): void {
    this.stopped = true;
    this.onended?.();
  }
}

class FakeContext {
  state: AudioContextState = 'running';
  currentTime = 10;
  sampleRate = 48000;
  destination = new FakeNode();
  sources: FakeSource[] = [];
  oscillators = 0;
  createGain() {
    return new FakeNode();
  }
  createDynamicsCompressor() {
    return new FakeNode();
  }
  createBiquadFilter() {
    return new FakeNode();
  }
  createOscillator() {
    this.oscillators += 1;
    return new FakeSource();
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  decodeAudioData(data: ArrayBuffer) {
    return Promise.resolve({ duration: new Uint8Array(data)[0] / 10 });
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

function createManager(settings: Partial<{ soundEnabled: boolean; volume: number }> = {}) {
  const store = new SettingsStore(null);
  store.update({ soundEnabled: true, volume: 0.6, ...settings });
  const context = new FakeContext();
  const urls = Object.fromEntries(Object.entries(CLIPS).map(([clip, info]) => [clip, String(Math.round(info.duration * 10))])) as Record<ClipId, string>;
  const manager = new AudioManager(store, {
    createContext: () => context as unknown as AudioContext,
    fetchClip: (url) => Promise.resolve(new Uint8Array([Number(url)]).buffer),
    urls,
  });
  return { manager, context, store };
}

describe('AudioManager', () => {
  it('toca o arquivo no trecho e no instante calculados', async () => {
    const { manager, context } = createManager();
    await manager.preload(['lyra-supernova']);
    manager.playClip('lyra-supernova', { alignInMs: 1200 });
    expect(context.sources).toHaveLength(1);
    const started = context.sources[0].started!;
    expect(started.when).toBeCloseTo(10.3);
    expect(started.offset).toBe(0);
  });

  it('não toca nada com o som desligado ou volume zero', async () => {
    for (const settings of [{ soundEnabled: false }, { volume: 0 }]) {
      const { manager, context } = createManager(settings);
      await manager.preload(['general-combat-impact']);
      manager.playClip('general-combat-impact');
      manager.play('hit');
      manager.play('heal');
      expect(context.sources, JSON.stringify(settings)).toHaveLength(0);
      expect(context.oscillators).toBe(0);
    }
  });

  it('desligar o som interrompe o que está tocando', async () => {
    const { manager, context, store } = createManager();
    await manager.preload(['vorath-void-rupture']);
    manager.playClip('vorath-void-rupture');
    expect(manager.activeVoices).toBe(1);
    store.update({ soundEnabled: false });
    expect(context.sources[0].stopped).toBe(true);
    expect(manager.activeVoices).toBe(0);
  });

  it('não repete o mesmo impacto pedido duas vezes no mesmo instante', async () => {
    const { manager, context } = createManager();
    await manager.preload(['general-combat-impact']);
    manager.play('hit');
    manager.play('hit');
    expect(context.sources).toHaveLength(1);
  });

  it('limita os sons simultâneos', async () => {
    const { manager, context } = createManager();
    await manager.preload(['vexra-auto-turret-shot']);
    for (let i = 0; i < MAX_VOICES + 3; i += 1) {
      context.currentTime += 0.1;
      manager.playClip('vexra-auto-turret-shot');
    }
    expect(manager.activeVoices).toBe(MAX_VOICES);
    expect(context.sources.filter((source) => source.stopped)).toHaveLength(3);
  });

  it('libera os arquivos que a próxima luta não usa', async () => {
    const { manager } = createManager();
    await manager.preload(clipsFor(['lyra', 'kael']));
    expect(manager.loadedClips).toContain('kael-arcane-blade');
    await manager.preload(clipsFor(['vorath', 'vexra']));
    expect(manager.loadedClips).not.toContain('kael-arcane-blade');
    expect(manager.loadedClips).toContain('vorath-void-rupture');
  });

  it('o volume das opções vai para a saída geral', async () => {
    const { manager, store } = createManager({ volume: 0.4 });
    await manager.preload([]);
    const master = (manager as unknown as { master: FakeNode }).master;
    expect(master.gain.value).toBe(0.4);
    store.update({ volume: 0.9 });
    expect(master.gain.value).toBe(0.9);
  });
});
