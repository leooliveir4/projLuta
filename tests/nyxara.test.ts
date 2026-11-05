import { describe, expect, it } from 'vitest';
import type { BattleEngine } from '../src/core/BattleEngine.ts';
import { ECLIPSE_COOLDOWN, ECLIPSE_ID, INFLUENCE_ON_VEIL_DODGE, Nyxara } from '../src/core/characters/Nyxara.ts';
import { SequenceRandom } from '../src/core/random.ts';
import { createCharacter } from '../src/core/roster.ts';
import type { BattleEvent } from '../src/core/types.ts';
import { act, createBattle, formulaDamage, pass } from './helpers.ts';

/** Nyxara (jogador, mais veloz) contra Vorath (lento e resistente, para lutas longas). */
function setup(): { engine: BattleEngine; nyx: Nyxara } {
  const engine = createBattle('nyxara', 'vorath');
  return { engine, nyx: engine.character('player') as Nyxara };
}

/** Ataca até a influência chegar a 100, com o Vorath apenas defendendo. */
function fillInfluence(engine: BattleEngine, nyx: Nyxara): void {
  let guard = 0;
  while (nyx.influence < 100 && guard < 20) {
    act(engine, 'player', { type: 'attack' });
    act(engine, 'enemy', { type: 'defend' });
    guard += 1;
  }
}

function transform(engine: BattleEngine, nyx: Nyxara): BattleEvent[] {
  fillInfluence(engine, nyx);
  const events = act(engine, 'player', { type: 'ability', abilityId: ECLIPSE_ID });
  expect(nyx.isTransformed).toBe(true);
  return events;
}

describe('Nyxara: influência', () => {
  it('começa em 0 e a Ultimate fica indisponível antes de 100', () => {
    const { engine, nyx } = setup();
    expect(nyx.influence).toBe(0);
    expect(engine.perform('player', { type: 'ability', abilityId: ECLIPSE_ID })).toEqual({
      accepted: false,
      reason: 'Influência insuficiente: 0/100.',
    });
    const option = engine.availableActions('player').find((o) => o.action.type === 'ability' && o.action.abilityId === ECLIPSE_ID);
    expect(option?.available).toBe(false);
  });

  it('+15 por dano direto, +10 por dano direto recebido e +10 por habilidade normal', () => {
    const { engine, nyx } = setup();
    act(engine, 'player', { type: 'attack' });
    expect(nyx.influence).toBe(15);
    act(engine, 'enemy', { type: 'attack' });
    expect(nyx.influence).toBe(25);
    act(engine, 'player', { type: 'ability', abilityId: 'shadow-blade' });
    expect(nyx.influence).toBe(50);
    act(engine, 'enemy', { type: 'defend' });
    expect(nyx.influence).toBe(50);
    act(engine, 'player', { type: 'ability', abilityId: 'abyss-mark' });
    expect(nyx.influence).toBe(60);
  });

  it('não acumula por acerto múltiplo nem por dano periódico', () => {
    const engine = createBattle('vexra', 'nyxara');
    const nyx = engine.character('enemy') as Nyxara;
    act(engine, 'enemy', { type: 'defend' });
    act(engine, 'player', { type: 'ability', abilityId: 'piercing-burst' });
    expect(nyx.influence).toBe(10);

    const bleeding = setup();
    act(bleeding.engine, 'player', { type: 'ability', abilityId: 'shadow-blade' });
    const afterBlade = bleeding.nyx.influence;
    act(bleeding.engine, 'enemy', { type: 'defend' });
    expect(bleeding.nyx.influence).toBe(afterBlade);
  });

  it('para em 100 e permanece lá até a Ultimate ser usada', () => {
    const { engine, nyx } = setup();
    fillInfluence(engine, nyx);
    expect(nyx.influence).toBe(100);
    act(engine, 'player', { type: 'attack' });
    act(engine, 'enemy', { type: 'attack' });
    expect(nyx.influence).toBe(100);
  });
});

describe('Nyxara: Eclipse de Vaelith', () => {
  it('consome a influência e muda atributos e habilidades na mesma instância', () => {
    const { engine, nyx } = setup();
    fillInfluence(engine, nyx);
    nyx.takeDamage(100);
    nyx.addEffect({ id: 'marker', name: 'Marcador', description: '', kind: 'debuff', duration: 9 }, engine.character('enemy'));
    const hp = nyx.hp;
    const energy = nyx.energy;
    const base = { ...nyx.stats };

    const events = act(engine, 'player', { type: 'ability', abilityId: ECLIPSE_ID });
    expect(events.find((event) => event.type === 'form-change')).toMatchObject({ target: 'player', form: 'eclipse', turns: 3 });
    expect(engine.character('player')).toBe(nyx);
    expect(nyx.influence).toBe(0);
    expect(nyx.formTurns).toBe(3);
    expect(nyx.hp).toBeGreaterThanOrEqual(hp);
    expect(nyx.energy).toBeGreaterThanOrEqual(energy);
    expect(nyx.hasEffect('marker')).toBe(true);
    expect(nyx.attack).toBe(Math.round(base.attack * 1.3));
    expect(nyx.speed).toBe(Math.round(base.speed * 1.1));
    expect(nyx.defense).toBe(Math.round(base.defense * 0.85));
    expect(nyx.abilities.map((a) => a.name)).toEqual([
      'Lâmina Dilacerante',
      'Marca Profana',
      'Véu do Massacre',
      'Vaelith no controle — 3 turnos',
    ]);
    expect(nyx.abilities.map((a) => a.id)).toEqual(['shadow-blade', 'abyss-mark', 'nyx-veil', ECLIPSE_ID]);
    expect(engine.perform('player', { type: 'ability', abilityId: ECLIPSE_ID }).accepted).toBe(false);
  });

  it('dura 3 turnos próprios completos depois da ativação e então retorna', () => {
    const { engine, nyx } = setup();
    transform(engine, nyx);
    const base = createCharacter('nyxara').stats;

    for (let turn = 3; turn >= 1; turn -= 1) {
      act(engine, 'enemy', { type: 'defend' });
      expect(nyx.isTransformed).toBe(true);
      expect(nyx.formTurns).toBe(turn);
      expect(engine.perform('player', { type: 'ability', abilityId: ECLIPSE_ID })).toEqual({
        accepted: false,
        reason: `Vaelith no controle — ${turn} ${turn === 1 ? 'turno' : 'turnos'}`,
      });
      const events = act(engine, 'player', { type: 'attack' });
      if (turn === 1) expect(events.find((event) => event.type === 'form-change')).toMatchObject({ form: 'base' });
    }

    expect(nyx.isTransformed).toBe(false);
    expect(nyx.attack).toBe(base.attack);
    expect(nyx.defense).toBe(base.defense);
    expect(nyx.abilities[0].name).toBe('Lâmina Sombria');
    expect(nyx.influence).toBe(0);
    expect(nyx.getCooldown(ECLIPSE_ID)).toBe(ECLIPSE_COOLDOWN);
  });

  it('a influência não cresce durante a transformação e volta a crescer depois', () => {
    const { engine, nyx } = setup();
    transform(engine, nyx);
    for (let i = 0; i < 3; i += 1) {
      act(engine, 'enemy', { type: 'attack' });
      act(engine, 'player', { type: 'attack' });
      expect(nyx.influence).toBe(0);
    }
    act(engine, 'enemy', { type: 'defend' });
    act(engine, 'player', { type: 'attack' });
    expect(nyx.influence).toBe(15);
  });

  it('formas normal e bestial compartilham as recargas pelo id', () => {
    const { engine, nyx } = setup();
    let guard = 0;
    while (nyx.influence < 75 && guard < 10) {
      act(engine, 'player', { type: 'attack' });
      act(engine, 'enemy', { type: 'defend' });
      guard += 1;
    }
    act(engine, 'player', { type: 'ability', abilityId: 'shadow-blade' });
    expect(nyx.influence).toBe(100);
    act(engine, 'enemy', { type: 'defend' });
    act(engine, 'player', { type: 'ability', abilityId: ECLIPSE_ID });
    expect(nyx.getCooldown('shadow-blade')).toBe(1);
    act(engine, 'enemy', { type: 'defend' });
    expect(engine.perform('player', { type: 'ability', abilityId: 'shadow-blade' })).toEqual({
      accepted: false,
      reason: 'Lâmina Dilacerante está em recarga por mais 1 turno.',
    });
  });

  it('Lâmina Dilacerante causa mais dano, sangra 22 e cura 15% do dano causado', () => {
    const { engine, nyx } = setup();
    transform(engine, nyx);
    const vorath = engine.character('enemy');
    act(engine, 'enemy', { type: 'attack' });
    const defense = vorath.defense;
    const events = act(engine, 'player', { type: 'ability', abilityId: 'shadow-blade' });
    const dealt = formulaDamage(nyx.attack, defense, 1.6);
    expect(events.find((event) => event.type === 'damage' && event.source === 'player')).toMatchObject({ amount: dealt });
    expect(events.find((event) => event.type === 'heal' && event.target === 'player')).toMatchObject({ amount: Math.round(dealt * 0.15) });
    expect(vorath.getEffect('bleed')?.periodicDamage).toBe(22);
  });

  it('Marca Profana substitui a Marca do Abismo sem acumular', () => {
    const { engine, nyx } = setup();
    const vorath = engine.character('enemy');
    act(engine, 'player', { type: 'ability', abilityId: 'abyss-mark' });
    expect(vorath.defense).toBe(Math.round(vorath.stats.defense * 0.75));
    act(engine, 'enemy', { type: 'defend' });
    transform(engine, nyx);
    act(engine, 'enemy', { type: 'defend' });
    act(engine, 'player', { type: 'ability', abilityId: 'abyss-mark' });
    expect(vorath.effects.filter((effect) => effect.id === 'abyss-mark')).toHaveLength(1);
    expect(vorath.defense).toBe(Math.round(vorath.stats.defense * 0.7));
    expect(vorath.incomingDamageModifier('basic')).toBeCloseTo(0.1);
  });

  it('Véu do Massacre revida uma vez, com força total, quando o golpe não é esquivado', () => {
    const engine = createBattle('nyxara', 'vorath', { random: new SequenceRandom([0.9]) });
    const nyx = engine.character('player') as Nyxara;
    const vorath = engine.character('enemy');
    transform(engine, nyx);
    act(engine, 'enemy', { type: 'defend' });
    act(engine, 'player', { type: 'ability', abilityId: 'nyx-veil' });
    expect(nyx.getEffect('nyx-veil')?.dodgeBonus).toBe(0.35);
    const events = act(engine, 'enemy', { type: 'attack' });
    const counters = events.filter((event) => event.type === 'damage' && event.kind === 'counter');
    expect(counters).toHaveLength(1);
    expect(counters[0]).toMatchObject({ source: 'player', amount: formulaDamage(nyx.attack, vorath.defense, 1) });
    expect(nyx.hasEffect('nyx-veil')).toBe(false);
  });

  it('ser derrotada durante a transformação encerra a batalha normalmente', () => {
    const { engine, nyx } = setup();
    transform(engine, nyx);
    nyx.takeDamage(nyx.hp - 1);
    act(engine, 'enemy', { type: 'attack' });
    expect(nyx.isDefeated).toBe(true);
    expect(engine.isOver).toBe(true);
    expect(engine.winner).toBe('enemy');
    expect(engine.perform('player', { type: 'attack' }).accepted).toBe(false);
  });

  it('um novo combate sempre começa na forma normal', () => {
    const { engine, nyx } = setup();
    transform(engine, nyx);
    const next = createCharacter('nyxara') as Nyxara;
    expect(next.isTransformed).toBe(false);
    expect(next.influence).toBe(0);
    expect(next.formId).toBe('base');
    pass(engine);
  });
});

describe('Nyxara: revisão da transformação e do Véu', () => {
  it(`Véu Espectral: se a esquiva funcionar, Vaelith ganha +${INFLUENCE_ON_VEIL_DODGE} de influência`, () => {
    const engine = createBattle('nyxara', 'vorath', { random: new SequenceRandom([0.01]) });
    const nyx = engine.character('player') as Nyxara;
    act(engine, 'player', { type: 'ability', abilityId: 'nyx-veil' });
    expect(nyx.influence).toBe(10);
    const events = act(engine, 'enemy', { type: 'attack' });
    expect(events.some((event) => event.type === 'dodge' && event.target === 'player')).toBe(true);
    expect(nyx.influence).toBe(10 + INFLUENCE_ON_VEIL_DODGE);
    expect(events.some((event) => event.type === 'damage' && event.kind === 'counter')).toBe(false);
  });

  it('Véu Espectral sem esquiva só dá a influência normal do dano recebido', () => {
    const engine = createBattle('nyxara', 'vorath', { random: new SequenceRandom([0.9]) });
    const nyx = engine.character('player') as Nyxara;
    act(engine, 'player', { type: 'ability', abilityId: 'nyx-veil' });
    act(engine, 'enemy', { type: 'attack' });
    expect(nyx.influence).toBe(20);
    expect(nyx.hasEffect('nyx-veil')).toBe(false);
  });

  it('não existe transformação simultânea: com Eclipse ativo, a Ultimate fica bloqueada', () => {
    const { engine, nyx } = setup();
    transform(engine, nyx);
    act(engine, 'enemy', { type: 'defend' });
    const option = engine.availableActions('player').find((o) => o.action.type === 'ability' && o.action.abilityId === ECLIPSE_ID);
    expect(option?.available).toBe(false);
    expect(engine.perform('player', { type: 'ability', abilityId: ECLIPSE_ID }).accepted).toBe(false);
    expect(nyx.formTurns).toBe(3);
  });

  it('influência cheia não ignora a recarga do Eclipse depois do retorno', () => {
    const { engine, nyx } = setup();
    transform(engine, nyx);
    for (let i = 0; i < 3; i += 1) {
      act(engine, 'enemy', { type: 'defend' });
      act(engine, 'player', { type: 'attack' });
    }
    expect(nyx.isTransformed).toBe(false);
    let guard = 0;
    while (nyx.influence < 100 && guard < 10) {
      act(engine, 'enemy', { type: 'attack' });
      act(engine, 'player', nyx.getCooldown('shadow-blade') === 0 ? { type: 'ability', abilityId: 'shadow-blade' } : { type: 'attack' });
      guard += 1;
    }
    act(engine, 'enemy', { type: 'defend' });
    expect(nyx.influence).toBe(100);
    expect(nyx.getCooldown(ECLIPSE_ID)).toBeGreaterThan(0);
    expect(engine.perform('player', { type: 'ability', abilityId: ECLIPSE_ID }).accepted).toBe(false);
  });

  it('ao voltar à forma normal preserva vida, energia, efeitos e recargas', () => {
    const { engine, nyx } = setup();
    transform(engine, nyx);
    nyx.addEffect({ id: 'marker', name: 'Marcador', description: '', kind: 'debuff', duration: 9 }, engine.character('enemy'));
    act(engine, 'enemy', { type: 'attack' });
    act(engine, 'player', { type: 'attack' });
    act(engine, 'enemy', { type: 'attack' });
    act(engine, 'player', { type: 'ability', abilityId: 'abyss-mark' });
    act(engine, 'enemy', { type: 'defend' });

    expect(nyx.formTurns).toBe(1);
    const hp = nyx.hp;
    const energy = nyx.energy;
    const marker = nyx.getEffect('marker')!.remaining;
    const events = act(engine, 'player', { type: 'attack' });
    expect(events.find((event) => event.type === 'form-change')).toMatchObject({ form: 'base' });
    expect(nyx.isTransformed).toBe(false);
    expect(nyx.hp).toBe(hp);
    expect(nyx.energy).toBe(energy);
    expect(nyx.getEffect('marker')?.remaining).toBe(marker - 1);
    expect(nyx.getCooldown('abyss-mark')).toBe(2);
    expect(engine.perform('player', { type: 'ability', abilityId: 'abyss-mark' }).accepted).toBe(false);
    expect(nyx.abilities[1].name).toBe('Marca do Abismo');
  });

  it('vencer durante o Eclipse encerra a batalha sem eventos depois do fim', () => {
    const { engine, nyx } = setup();
    transform(engine, nyx);
    act(engine, 'enemy', { type: 'defend' });
    act(engine, 'player', { type: 'attack' });
    const vorath = engine.character('enemy');
    vorath.takeDamage(vorath.hp - 1);
    act(engine, 'enemy', { type: 'attack' });
    const events = act(engine, 'player', { type: 'attack' });
    expect(engine.isOver).toBe(true);
    expect(engine.winner).toBe('player');
    expect(events[events.length - 1]).toMatchObject({ type: 'battle-end', winner: 'player' });
    expect(events.some((event) => event.type === 'form-change')).toBe(false);
    expect(engine.perform('enemy', { type: 'attack' }).accepted).toBe(false);
    expect(engine.perform('player', { type: 'ability', abilityId: ECLIPSE_ID }).accepted).toBe(false);
  });
});
