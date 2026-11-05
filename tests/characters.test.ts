import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, scaleStats } from '../src/core/Character.ts';
import type { Vexra } from '../src/core/characters/Vexra.ts';
import { burnEffect, EFFECTS } from '../src/core/effects.ts';
import { SequenceRandom } from '../src/core/random.ts';
import { CHARACTER_IDS, createCharacter, mirrorName } from '../src/core/roster.ts';
import type { BattleEvent, CharacterId, Side } from '../src/core/types.ts';
import { act, createBattle, formulaDamage, pass } from './helpers.ts';

/** Atributos do nível 1 em uso (ver docs/balanceamento.md). */
const LEVEL_ONE: Record<CharacterId, [number, number, number, number]> = {
  lyra: [600, 82, 22, 14],
  vexra: [640, 84, 22, 12],
  dravenor: [780, 57, 34, 7],
  kael: [570, 80, 24, 17],
  nyxara: [580, 84, 18, 16],
  vorath: [820, 61, 34, 6],
};

function damageFrom(events: BattleEvent[], source: Side, kind?: string): number[] {
  return events
    .filter((event) => event.type === 'damage' && event.source === source && (!kind || event.kind === kind))
    .map((event) => (event.type === 'damage' ? event.amount : 0));
}

function heals(events: BattleEvent[], target: Side): number[] {
  return events.filter((event) => event.type === 'heal' && event.target === target).map((event) => (event.type === 'heal' ? event.amount : 0));
}

const BIG_ATTACK = { id: 'test-power', name: 'Teste', description: '', kind: 'buff' as const, duration: 9, statModifiers: { attack: 4 } };

describe('elenco', () => {
  it('seis personagens originais, cada um com quatro habilidades de id estável, custo e recarga', () => {
    expect(CHARACTER_IDS).toEqual(['lyra', 'vexra', 'dravenor', 'kael', 'nyxara', 'vorath']);
    for (const id of CHARACTER_IDS) {
      const character = createCharacter(id);
      expect(character.abilities).toHaveLength(4);
      const ids = character.abilities.map((ability) => ability.id);
      expect(new Set(ids).size).toBe(4);
      for (const ability of character.abilities) {
        expect(ability.cost).toBeGreaterThanOrEqual(0);
        expect(ability.cooldown).toBeGreaterThan(0);
      }
    }
  });

  it('atributos do nível 1 seguem a tabela de balanceamento', () => {
    for (const id of CHARACTER_IDS) {
      const { stats } = createCharacter(id);
      expect([stats.maxHp, stats.attack, stats.defense, stats.speed], id).toEqual(LEVEL_ONE[id]);
      expect(stats.maxEnergy).toBe(100);
    }
  });

  it('níveis 1 e 10 são reproduzíveis e crescem de forma moderada', () => {
    for (const id of CHARACTER_IDS) {
      const a = createCharacter(id, 10);
      const b = createCharacter(id, 10);
      expect(a.stats).toEqual(b.stats);
      const base = createCharacter(id, 1).stats;
      expect(a.stats.maxHp).toBe(Math.round(base.maxHp * 1.54));
      expect(a.stats.attack).toBe(Math.round(base.attack * 1.45));
      expect(a.stats.defense).toBe(Math.round(base.defense * 1.45));
      expect(a.stats.speed).toBe(base.speed);
      expect(a.stats.maxEnergy).toBe(100);
    }
    expect(scaleStats(createCharacter('lyra').stats, 99)).toEqual(createCharacter('lyra', MAX_LEVEL).stats);
  });

  it('habilidades inválidas são recusadas pelo motor', () => {
    const engine = createBattle('lyra', 'kael');
    expect(engine.perform('enemy', { type: 'ability', abilityId: 'nao-existe' })).toEqual({ accepted: false, reason: 'Habilidade desconhecida.' });
    expect(engine.perform('enemy', { type: 'ability', abilityId: 'astral-orb' })).toEqual({ accepted: false, reason: 'Habilidade desconhecida.' });
  });

  it('no confronto espelho o adversário recebe outro nome e mantém o kit', () => {
    const shadow = createCharacter('lyra', 1, mirrorName('Lyra'));
    expect(shadow.name).toBe('Sombra de Lyra');
    expect(shadow.id).toBe('lyra');
    expect(shadow.abilities.map((a) => a.id)).toEqual(createCharacter('lyra').abilities.map((a) => a.id));
  });
});

describe('Lyra', () => {
  it('Ressonância Astral cura 12% do dano da habilidade', () => {
    const engine = createBattle('lyra', 'dravenor');
    const lyra = engine.character('player');
    const dravenor = engine.character('enemy');
    lyra.takeDamage(200);
    const dealt = formulaDamage(lyra.attack, dravenor.defense, 1.35);
    const events = act(engine, 'player', { type: 'ability', abilityId: 'astral-orb' });
    expect(damageFrom(events, 'player')).toEqual([dealt]);
    expect(heals(events, 'player')).toEqual([Math.round(dealt * 0.12)]);
  });

  it('a cura é limitada a 35 por ação e não vem de ataques básicos', () => {
    const engine = createBattle('lyra', 'vorath');
    const lyra = engine.character('player');
    lyra.takeDamage(300);
    lyra.addEffect(BIG_ATTACK, lyra);
    const events = act(engine, 'player', { type: 'ability', abilityId: 'supernova' });
    expect(damageFrom(events, 'player')[0] * 0.12).toBeGreaterThan(35);
    expect(heals(events, 'player')).toEqual([35]);

    pass(engine);
    expect(heals(act(engine, 'player', { type: 'attack' }), 'player')).toEqual([]);
  });

  it('Barreira Arcana reduz em 35% todo dano direto nos 2 turnos seguintes do adversário', () => {
    const engine = createBattle('lyra', 'dravenor');
    const lyra = engine.character('player');
    const dravenor = engine.character('enemy');
    const reduced = formulaDamage(dravenor.attack, lyra.defense, 1, 0.65);
    act(engine, 'player', { type: 'ability', abilityId: 'arcane-barrier' });
    expect(damageFrom(act(engine, 'enemy', { type: 'attack' }), 'enemy')).toEqual([reduced]);
    expect(lyra.hasEffect('astral-shield')).toBe(true);
    act(engine, 'player', { type: 'attack' });
    expect(damageFrom(act(engine, 'enemy', { type: 'attack' }), 'enemy')).toEqual([reduced]);
    act(engine, 'player', { type: 'attack' });
    expect(lyra.hasEffect('astral-shield')).toBe(false);
    expect(damageFrom(act(engine, 'enemy', { type: 'attack' }), 'enemy')).toEqual([formulaDamage(dravenor.attack, lyra.defense, 1)]);
  });

  it('Supernova remove um bônus de defesa do alvo antes do dano', () => {
    const engine = createBattle('lyra', 'dravenor');
    const lyra = engine.character('player');
    const dravenor = engine.character('enemy');
    const baseDefense = dravenor.defense;
    pass(engine);
    act(engine, 'enemy', { type: 'ability', abilityId: 'iron-skin' });
    expect(dravenor.defense).toBeGreaterThan(baseDefense);
    const events = act(engine, 'player', { type: 'ability', abilityId: 'supernova' });
    expect(events.find((event) => event.type === 'dispel')).toMatchObject({ names: ['Pele de Ferro'] });
    expect(damageFrom(events, 'player')).toEqual([formulaDamage(lyra.attack, baseDefense, 2.15)]);
  });
});

describe('Vexra', () => {
  it('Mecanismo Aquecido: o segundo básico seguido causa +15%, depois a sequência reinicia', () => {
    const engine = createBattle('vexra', 'dravenor');
    const vexra = engine.character('player') as Vexra;
    const dravenor = engine.character('enemy');
    const normal = formulaDamage(vexra.attack, dravenor.defense, 1);
    const heated = formulaDamage(vexra.attack, dravenor.defense, 1, 1.15);

    const hits: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      hits.push(...damageFrom(act(engine, 'player', { type: 'attack' }), 'player', 'basic'));
      act(engine, 'enemy', { type: 'attack' });
    }
    expect(hits).toEqual([normal, heated, normal]);

    act(engine, 'player', { type: 'ability', abilityId: 'overload' });
    expect(vexra.isHeated).toBe(false);
  });

  it('Rajada Perfurante: dois impactos de poder 0,65 sem o bônus da passiva', () => {
    const engine = createBattle('vexra', 'dravenor');
    const vexra = engine.character('player') as Vexra;
    const dravenor = engine.character('enemy');
    act(engine, 'player', { type: 'attack' });
    act(engine, 'enemy', { type: 'attack' });
    expect(vexra.isHeated).toBe(true);
    const shot = formulaDamage(vexra.attack, dravenor.defense, 0.65);
    expect(damageFrom(act(engine, 'player', { type: 'ability', abilityId: 'piercing-burst' }), 'player')).toEqual([shot, shot]);
    expect(vexra.isHeated).toBe(false);
  });

  it('Torre Automática dispara 30 no início dos 3 turnos seguintes de Vexra e some', () => {
    const engine = createBattle('vexra', 'dravenor');
    const vexra = engine.character('player');
    const turret: number[] = [];
    act(engine, 'player', { type: 'ability', abilityId: 'auto-turret' });
    for (let round = 0; round < 4; round += 1) {
      turret.push(...damageFrom(act(engine, 'enemy', { type: 'defend' }), 'player', 'turret'));
      act(engine, 'player', { type: 'defend' });
    }
    expect(turret).toEqual([30, 30, 30]);
    expect(vexra.hasEffect('auto-turret')).toBe(false);
  });

  it('Sobrecarga dá ataque +40% nos 3 turnos seguintes de Vexra', () => {
    const engine = createBattle('vexra', 'dravenor');
    const vexra = engine.character('player');
    const dravenor = engine.character('enemy');
    const base = vexra.stats.attack;
    act(engine, 'player', { type: 'ability', abilityId: 'overload' });
    for (let round = 0; round < 3; round += 1) {
      act(engine, 'enemy', { type: 'attack' });
      expect(vexra.attack).toBe(Math.round(base * 1.4));
      const shots = damageFrom(act(engine, 'player', { type: 'attack' }), 'player');
      if (round === 0) expect(shots).toEqual([formulaDamage(Math.round(base * 1.4), dravenor.defense, 1)]);
    }
    expect(vexra.hasEffect('overload')).toBe(false);
    expect(vexra.attack).toBe(base);
  });

  it('reaplicar a torre não cria uma segunda torre', () => {
    const engine = createBattle('vexra', 'dravenor');
    const vexra = engine.character('player');
    engine.applyEffect(vexra, EFFECTS.autoTurret, vexra);
    engine.applyEffect(vexra, EFFECTS.autoTurret, vexra);
    expect(vexra.effects.filter((effect) => effect.turretDamage)).toHaveLength(1);
    act(engine, 'player', { type: 'defend' });
    expect(damageFrom(act(engine, 'enemy', { type: 'defend' }), 'player', 'turret')).toEqual([30]);
  });
});

describe('Dravenor', () => {
  it('Vigor Ancestral cura 16 no início do turno abaixo de 45%, depois do dano contínuo', () => {
    const engine = createBattle('vexra', 'dravenor');
    const vexra = engine.character('player');
    const dravenor = engine.character('enemy');
    dravenor.takeDamage(dravenor.maxHp - (Math.ceil(dravenor.maxHp * 0.45) + 10));
    engine.applyEffect(dravenor, burnEffect(18), vexra);
    const events = act(engine, 'player', { type: 'defend' });
    const order = events.filter((event) => event.type === 'damage' || event.type === 'heal').map((event) => event.type);
    expect(order).toEqual(['damage', 'heal']);
    expect(heals(events, 'enemy')).toEqual([16]);
  });

  it('não cura com 45% de vida ou mais', () => {
    const engine = createBattle('kael', 'dravenor');
    expect(heals(act(engine, 'player', { type: 'attack' }), 'enemy')).toEqual([]);
  });

  it('Fúria Ancestral cura 65, dá ataque +20% e não remove efeitos negativos', () => {
    const engine = createBattle('lyra', 'dravenor');
    const dravenor = engine.character('enemy');
    act(engine, 'player', { type: 'ability', abilityId: 'astral-orb' });
    dravenor.takeDamage(200);
    const attack = dravenor.attack;
    const before = dravenor.hp;
    act(engine, 'enemy', { type: 'ability', abilityId: 'ancestral-fury' });
    expect(dravenor.hp - before).toBe(65);
    expect(dravenor.attack).toBe(Math.round(dravenor.stats.attack * 1.2));
    expect(attack).toBe(dravenor.stats.attack);
    expect(dravenor.hasEffect('star-fissure')).toBe(true);
  });

  it('Ruptura da Terra só atordoa quando a rolagem fica abaixo de 40%', () => {
    const engine = createBattle('dravenor', 'vorath', { random: new SequenceRandom([0.9]) });
    const events = act(engine, 'player', { type: 'ability', abilityId: 'earth-rupture' });
    expect(events.some((event) => event.type === 'stunned')).toBe(false);
    expect(engine.active).toBe('enemy');

    const stun = createBattle('dravenor', 'vorath', { random: new SequenceRandom([0.35]) });
    const stunEvents = act(stun, 'player', { type: 'ability', abilityId: 'earth-rupture' });
    expect(stunEvents.some((event) => event.type === 'stunned' && event.side === 'enemy')).toBe(true);
    expect(stun.active).toBe('player');
  });
});

describe('Kael', () => {
  it('Leitura de Combate: depois de esquivar, o próximo básico causa +20% uma única vez', () => {
    const engine = createBattle('dravenor', 'kael', { random: new SequenceRandom([0, 0.5]) });
    const kael = engine.character('enemy');
    const dravenor = engine.character('player');
    act(engine, 'enemy', { type: 'defend' });
    const dodge = act(engine, 'player', { type: 'attack' });
    expect(dodge.some((event) => event.type === 'dodge' && event.target === 'enemy')).toBe(true);

    const boosted = damageFrom(act(engine, 'enemy', { type: 'attack' }), 'enemy');
    expect(boosted).toEqual([formulaDamage(kael.attack, dravenor.defense, 1, 1.2)]);
    act(engine, 'player', { type: 'attack' });
    expect(damageFrom(act(engine, 'enemy', { type: 'attack' }), 'enemy')).toEqual([formulaDamage(kael.attack, dravenor.defense, 1)]);
  });

  it('Passo Etéreo dá +35 pontos de esquiva contra o próximo ataque direto e revida se esquivar', () => {
    const engine = createBattle('dravenor', 'kael', { random: new SequenceRandom([0.3, 0.3]) });
    const kael = engine.character('enemy');
    const dravenor = engine.character('player');
    act(engine, 'enemy', { type: 'ability', abilityId: 'ethereal-step' });
    expect(kael.dodgeChanceAgainst(dravenor)).toBeCloseTo(0.15);
    expect(kael.dodgeChanceAgainst(dravenor, 0.35)).toBeCloseTo(0.5);

    const events = act(engine, 'player', { type: 'ability', abilityId: 'devastating-blow' });
    expect(events.some((event) => event.type === 'dodge' && event.target === 'enemy')).toBe(true);
    expect(damageFrom(events, 'enemy', 'counter')).toEqual([formulaDamage(kael.attack, dravenor.defense, 1)]);
    expect(kael.hasEffect('ethereal-step')).toBe(false);

    act(engine, 'enemy', { type: 'defend' });
    const unguarded = act(engine, 'player', { type: 'attack' });
    expect(unguarded.some((event) => event.type === 'damage' && event.target === 'enemy')).toBe(true);
    expect(damageFrom(unguarded, 'enemy', 'counter')).toEqual([]);
  });

  it('Passo Etéreo não revida quando o golpe acerta, mas o efeito é consumido', () => {
    const engine = createBattle('dravenor', 'kael', { random: new SequenceRandom([0.9]) });
    const kael = engine.character('enemy');
    act(engine, 'enemy', { type: 'ability', abilityId: 'ethereal-step' });
    const events = act(engine, 'player', { type: 'attack' });
    expect(events.some((event) => event.type === 'damage' && event.target === 'enemy')).toBe(true);
    expect(damageFrom(events, 'enemy', 'counter')).toEqual([]);
    expect(kael.hasEffect('ethereal-step')).toBe(false);
  });

  it('Duelo Perfeito dá ataque +35% e velocidade +20% nos 3 turnos seguintes de Kael', () => {
    const engine = createBattle('kael', 'vorath');
    const kael = engine.character('player');
    const base = kael.stats;
    act(engine, 'player', { type: 'ability', abilityId: 'perfect-duel' });
    for (let round = 0; round < 3; round += 1) {
      act(engine, 'enemy', { type: 'defend' });
      expect(kael.attack).toBe(Math.round(base.attack * 1.35));
      expect(kael.speed).toBe(Math.round(base.speed * 1.2));
      act(engine, 'player', { type: 'defend' });
    }
    expect(kael.hasEffect('perfect-duel')).toBe(false);
    expect(kael.attack).toBe(base.attack);
  });
});

describe('Vorath', () => {
  it('Núcleo Voraz cura 10 no início do turno só se sofreu dano desde o turno anterior', () => {
    const engine = createBattle('kael', 'vorath');
    expect(heals(act(engine, 'player', { type: 'attack' }), 'enemy')).toEqual([10]);
    act(engine, 'enemy', { type: 'defend' });
    expect(heals(act(engine, 'player', { type: 'defend' }), 'enemy')).toEqual([]);
  });

  it('Assimilação cura 35% do dano causado, até 60', () => {
    const engine = createBattle('nyxara', 'vorath');
    const vorath = engine.character('enemy');
    const nyxara = engine.character('player');
    vorath.takeDamage(300);
    act(engine, 'player', { type: 'item', itemId: 'strength-tonic' });
    const dealt = formulaDamage(vorath.attack, nyxara.defense, 0.9);
    const events = act(engine, 'enemy', { type: 'ability', abilityId: 'assimilation' });
    expect(heals(events, 'enemy')).toEqual([Math.round(dealt * 0.35)]);

    const capped = createBattle('nyxara', 'vorath');
    const bigVorath = capped.character('enemy');
    bigVorath.takeDamage(300);
    bigVorath.addEffect(BIG_ATTACK, bigVorath);
    act(capped, 'player', { type: 'item', itemId: 'strength-tonic' });
    expect(heals(act(capped, 'enemy', { type: 'ability', abilityId: 'assimilation' }), 'enemy')).toEqual([60]);
  });

  it('Massa Instável dá defesa +25% e cura 25 na hora', () => {
    const engine = createBattle('kael', 'vorath');
    const vorath = engine.character('enemy');
    vorath.takeDamage(100);
    act(engine, 'player', { type: 'defend' });
    const before = vorath.hp;
    act(engine, 'enemy', { type: 'ability', abilityId: 'unstable-mass' });
    expect(vorath.hp - before).toBe(25);
    expect(vorath.defense).toBe(Math.round(vorath.stats.defense * 1.25));
  });
});
