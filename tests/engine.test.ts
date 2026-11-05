import { describe, expect, it } from 'vitest';
import { BattleEngine } from '../src/core/BattleEngine.ts';
import { ENERGY_RULES } from '../src/core/Character.ts';
import { EFFECTS } from '../src/core/effects.ts';
import { SequenceRandom } from '../src/core/random.ts';
import { CHARACTER_IDS, createCharacter } from '../src/core/roster.ts';
import type { BattleEvent } from '../src/core/types.ts';
import { act, createBattle, formulaDamage, neutralRandom, pass } from './helpers.ts';

describe('ordem dos turnos', () => {
  it('o personagem mais veloz começa', () => {
    expect(createBattle('kael', 'lyra').active).toBe('player');
    expect(createBattle('lyra', 'kael').active).toBe('enemy');
    expect(createBattle('dravenor', 'vorath').active).toBe('player');
    expect(createBattle('vorath', 'nyxara').active).toBe('enemy');
  });

  it('empate de velocidade favorece o jogador', () => {
    expect(createBattle('vexra', 'vexra').active).toBe('player');
  });

  it('depois do primeiro turno os lados se alternam e o contador avança', () => {
    const engine = createBattle('kael', 'vorath');
    expect(engine.turn).toBe(1);
    act(engine, 'player', { type: 'defend' });
    expect(engine.active).toBe('enemy');
    expect(engine.turn).toBe(2);
    act(engine, 'enemy', { type: 'defend' });
    expect(engine.active).toBe('player');
    expect(engine.turn).toBe(3);
  });

  it('não permite agir fora do próprio turno nem duas vezes seguidas', () => {
    const engine = createBattle('kael', 'vorath');
    expect(engine.perform('enemy', { type: 'attack' })).toEqual({ accepted: false, reason: 'Aguarde o seu turno.' });
    act(engine, 'player', { type: 'attack' });
    expect(engine.perform('player', { type: 'attack' }).accepted).toBe(false);
  });

  it('não aceita ações antes de o combate começar nem a mesma instância nos dois lados', () => {
    const engine = new BattleEngine({ player: createCharacter('lyra'), enemy: createCharacter('kael'), random: neutralRandom() });
    expect(engine.perform('player', { type: 'attack' }).accepted).toBe(false);
    expect(() => new BattleEngine({ player: engine.character('player'), enemy: engine.character('player') })).toThrow();
  });
});

describe('energia e recargas', () => {
  it('todo o elenco começa com 100 de energia, recupera 12 por turno e 15 ao defender', () => {
    for (const id of CHARACTER_IDS) {
      const character = createCharacter(id);
      expect(character.energy).toBe(ENERGY_RULES.starting);
      expect(character.maxEnergy).toBe(100);
      expect(character.energyRegen).toBe(12);
      expect(character.defendEnergyGain).toBe(15);
    }
  });

  it('habilidades consomem energia e são recusadas sem energia suficiente', () => {
    const engine = createBattle('lyra', 'dravenor');
    const lyra = engine.character('player');
    act(engine, 'player', { type: 'ability', abilityId: 'astral-orb' });
    expect(lyra.energy).toBe(70);
    pass(engine);
    expect(lyra.energy).toBe(82);

    lyra.spendEnergy(lyra.energy - 10);
    expect(engine.perform('player', { type: 'ability', abilityId: 'supernova' })).toEqual({
      accepted: false,
      reason: 'Energia insuficiente: Supernova custa 65.',
    });
  });

  it('a energia não passa do máximo', () => {
    const engine = createBattle('lyra', 'dravenor');
    const lyra = engine.character('player');
    act(engine, 'player', { type: 'defend' });
    pass(engine);
    expect(lyra.energy).toBe(100);
  });

  it('recarga N deixa a habilidade indisponível pelos N turnos seguintes do personagem', () => {
    const engine = createBattle('lyra', 'dravenor');
    const lyra = engine.character('player');
    act(engine, 'player', { type: 'ability', abilityId: 'astral-orb' });
    expect(lyra.getCooldown('astral-orb')).toBe(2);

    pass(engine);
    expect(engine.perform('player', { type: 'ability', abilityId: 'astral-orb' }).accepted).toBe(false);
    act(engine, 'player', { type: 'attack' });
    expect(lyra.getCooldown('astral-orb')).toBe(1);

    pass(engine);
    expect(engine.perform('player', { type: 'ability', abilityId: 'astral-orb' })).toEqual({
      accepted: false,
      reason: 'Orbe Astral está em recarga por mais 1 turno.',
    });
    act(engine, 'player', { type: 'attack' });

    pass(engine);
    expect(engine.perform('player', { type: 'ability', abilityId: 'astral-orb' }).accepted).toBe(true);
  });
});

describe('defesa', () => {
  it('reduz pela metade o dano direto da próxima ação inimiga e recupera energia', () => {
    const engine = createBattle('kael', 'dravenor');
    const kael = engine.character('player');
    const dravenor = engine.character('enemy');
    act(engine, 'player', { type: 'attack' });
    act(engine, 'enemy', { type: 'defend' });
    expect(dravenor.isGuarding).toBe(true);

    const before = dravenor.hp;
    const events = act(engine, 'player', { type: 'attack' });
    const expected = formulaDamage(kael.attack, dravenor.defense, 1, 0.5);
    expect(before - dravenor.hp).toBe(expected);
    expect(events.find((event) => event.type === 'damage')).toMatchObject({ guarded: true, amount: expected });
  });

  it('a guarda termina no início do próximo turno de quem defendeu', () => {
    const engine = createBattle('kael', 'vorath');
    act(engine, 'player', { type: 'defend' });
    expect(engine.character('player').isGuarding).toBe(true);
    act(engine, 'enemy', { type: 'defend' });
    expect(engine.character('player').isGuarding).toBe(false);
  });
});

describe('efeitos temporários', () => {
  it('um debuff dura os turnos próprios do alvo', () => {
    const engine = createBattle('lyra', 'dravenor');
    const dravenor = engine.character('enemy');
    const defense = dravenor.defense;
    act(engine, 'player', { type: 'ability', abilityId: 'astral-orb' });
    expect(dravenor.defense).toBe(Math.round(defense * 0.8));
    expect(dravenor.getEffect('star-fissure')?.remaining).toBe(2);

    pass(engine);
    expect(dravenor.getEffect('star-fissure')?.remaining).toBe(1);
    pass(engine);
    expect(dravenor.hasEffect('star-fissure')).toBe(true);
    pass(engine);
    expect(dravenor.hasEffect('star-fissure')).toBe(false);
    expect(dravenor.defense).toBe(defense);
  });

  it('um bônus próprio não perde duração no turno em que foi criado', () => {
    const engine = createBattle('vexra', 'dravenor');
    const vexra = engine.character('player');
    act(engine, 'player', { type: 'ability', abilityId: 'overload' });
    expect(vexra.getEffect('overload')?.remaining).toBe(3);
    for (const remaining of [2, 1]) {
      pass(engine);
      act(engine, 'player', { type: 'attack' });
      expect(vexra.getEffect('overload')?.remaining).toBe(remaining);
    }
    pass(engine);
    act(engine, 'player', { type: 'attack' });
    expect(vexra.hasEffect('overload')).toBe(false);
  });

  it('reaplicar renova a duração sem acumular; ids diferentes coexistem', () => {
    const vorath = createCharacter('vorath');
    const kael = createCharacter('kael');
    kael.addEffect(EFFECTS.abyssSlow, vorath);
    kael.getEffect('abyss-slow')!.remaining = 1;
    kael.addEffect(EFFECTS.abyssSlow, vorath);
    expect(kael.effects).toHaveLength(1);
    expect(kael.getEffect('abyss-slow')?.remaining).toBe(2);
    expect(kael.speed).toBe(Math.round(17 * 0.75));

    kael.addEffect(EFFECTS.voidTorpor, vorath);
    expect(kael.effects).toHaveLength(2);
    expect(kael.speed).toBe(Math.round(17 * 0.4));
  });

  it('atordoamento faz o alvo perder exatamente um turno e não se repete na recarga', () => {
    const engine = createBattle('dravenor', 'vorath', { random: new SequenceRandom([0.1, 0.5]) });
    const vorath = engine.character('enemy');
    const events = act(engine, 'player', { type: 'ability', abilityId: 'earth-rupture' });
    expect(events.some((event) => event.type === 'stunned' && event.side === 'enemy')).toBe(true);
    expect(engine.active).toBe('player');
    expect(vorath.isStunned).toBe(false);
    expect(engine.perform('player', { type: 'ability', abilityId: 'earth-rupture' }).accepted).toBe(false);

    act(engine, 'player', { type: 'defend' });
    expect(engine.active).toBe('enemy');
  });

  it('queimadura causa dano fixo no início dos 2 turnos seguintes do alvo, ignorando defesa', () => {
    const engine = createBattle('vexra', 'dravenor');
    const ticks: number[] = [];
    const collect = (events: BattleEvent[]) => {
      for (const event of events) if (event.type === 'damage' && event.kind === 'periodic') ticks.push(event.amount);
    };
    collect(act(engine, 'player', { type: 'ability', abilityId: 'explosive-grenade' }));
    for (let round = 0; round < 3; round += 1) {
      collect(act(engine, 'enemy', { type: 'defend' }));
      collect(act(engine, 'player', { type: 'defend' }));
    }
    expect(ticks).toEqual([16, 16]);
    expect(engine.character('enemy').hasEffect('burn')).toBe(false);
  });

  it('golpes de vários impactos contam cada um e param quando o alvo cai', () => {
    const engine = createBattle('vexra', 'dravenor');
    expect(act(engine, 'player', { type: 'ability', abilityId: 'piercing-burst' }).filter((event) => event.type === 'damage')).toHaveLength(2);

    const fresh = createBattle('vexra', 'dravenor');
    const target = fresh.character('enemy');
    target.takeDamage(target.maxHp - 5);
    const events = act(fresh, 'player', { type: 'ability', abilityId: 'piercing-burst' });
    expect(events.filter((event) => event.type === 'damage')).toHaveLength(1);
    expect(fresh.isOver).toBe(true);
  });
});

describe('itens', () => {
  it('o inventário é limitado e a vida nunca passa do máximo', () => {
    const engine = createBattle('kael', 'vorath', { loadout: { 'health-potion': 1 } });
    const kael = engine.character('player');
    act(engine, 'player', { type: 'item', itemId: 'health-potion' });
    expect(kael.hp).toBe(kael.maxHp);
    expect(engine.inventory('player').count('health-potion')).toBe(0);
    pass(engine);
    expect(engine.perform('player', { type: 'item', itemId: 'health-potion' })).toEqual({
      accepted: false,
      reason: 'Não há mais Poção de Vida.',
    });
  });

  it('poção cura 30% da vida máxima', () => {
    const engine = createBattle('kael', 'vorath');
    const kael = engine.character('player');
    kael.takeDamage(300);
    act(engine, 'player', { type: 'item', itemId: 'health-potion' });
    expect(kael.hp).toBe(kael.maxHp - 300 + Math.round(kael.maxHp * 0.3));
  });
});

describe('vitória e derrota', () => {
  it('a vida nunca fica negativa e o combate termina com vitória do jogador', () => {
    const engine = createBattle('kael', 'lyra');
    const lyra = engine.character('enemy');
    lyra.takeDamage(lyra.maxHp - 10);
    const events = act(engine, 'player', { type: 'attack' });
    expect(lyra.hp).toBe(0);
    expect(engine.isOver).toBe(true);
    expect(engine.winner).toBe('player');
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining(['defeated', 'battle-end']));
  });

  it('o jogador pode ser derrotado e nenhuma ação é aceita depois do fim', () => {
    const engine = createBattle('vorath', 'kael');
    engine.character('player').takeDamage(engine.character('player').maxHp - 1);
    act(engine, 'enemy', { type: 'attack' });
    expect(engine.winner).toBe('enemy');
    expect(engine.character('player').isDefeated).toBe(true);
    expect(engine.perform('player', { type: 'attack' })).toEqual({ accepted: false, reason: 'O combate já terminou.' });
    expect(engine.perform('enemy', { type: 'attack' }).accepted).toBe(false);
  });

  it('um personagem derrotado não recebe cura', () => {
    const lyra = createCharacter('lyra');
    lyra.takeDamage(9999);
    expect(lyra.hp).toBe(0);
    expect(lyra.heal(100)).toBe(0);
  });

  it('o histórico registra os acontecimentos com o número do turno', () => {
    const engine = createBattle('kael', 'vorath');
    act(engine, 'player', { type: 'attack' });
    expect(engine.log.ofTurn(1).some((entry) => entry.text.includes('Kael ataca'))).toBe(true);
    expect(engine.log.ofTurn(2).some((entry) => entry.text.includes('vez de Vorath'))).toBe(true);
  });
});
