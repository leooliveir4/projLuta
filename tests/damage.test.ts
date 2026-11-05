import { describe, expect, it } from 'vitest';
import { COMBAT_RULES, computeDamage, dodgeChance, mitigationFactor } from '../src/core/damage.ts';
import { EFFECTS } from '../src/core/effects.ts';
import { SequenceRandom } from '../src/core/random.ts';
import { act, createBattle, formulaDamage } from './helpers.ts';

const base = {
  attack: 100,
  defense: 0,
  power: 1,
  varianceRoll: 0.5,
  critical: false,
  guarded: false,
  dealtModifier: 0,
  takenModifier: 0,
  applyVariance: true,
};

describe('cálculo de dano', () => {
  it('usa ataque × poder reduzido proporcionalmente pela defesa', () => {
    expect(computeDamage(base)).toBe(100);
    expect(computeDamage({ ...base, defense: 100 })).toBe(50);
    expect(computeDamage({ ...base, power: 1.5, defense: 25 })).toBe(120);
    expect(mitigationFactor(0)).toBe(1);
    expect(mitigationFactor(-50)).toBe(1);
  });

  it('aplica variação moderada de ±10% apenas quando solicitada', () => {
    expect(computeDamage({ ...base, varianceRoll: 0 })).toBe(90);
    expect(computeDamage({ ...base, varianceRoll: 0.999 })).toBe(110);
    expect(computeDamage({ ...base, varianceRoll: 0, applyVariance: false })).toBe(100);
  });

  it('multiplica o crítico por 1,5 e reduz pela metade com guarda', () => {
    expect(computeDamage({ ...base, critical: true })).toBe(150);
    expect(computeDamage({ ...base, guarded: true })).toBe(50);
    expect(computeDamage({ ...base, critical: true, guarded: true })).toBe(75);
  });

  it('considera modificadores de dano causado e recebido', () => {
    expect(computeDamage({ ...base, dealtModifier: 0.15 })).toBe(115);
    expect(computeDamage({ ...base, takenModifier: 0.1 })).toBe(110);
    expect(computeDamage({ ...base, takenModifier: -0.3 })).toBe(70);
  });

  it('a redução de dano recebido fora da guarda não passa de 60%', () => {
    expect(computeDamage({ ...base, takenModifier: -0.9 })).toBe(40);
    expect(computeDamage({ ...base, takenModifier: -0.9, guarded: true })).toBe(20);
  });

  it('nunca causa menos de 1 de dano', () => {
    expect(computeDamage({ ...base, attack: 1, defense: 1000 })).toBe(1);
  });

  it('esquiva entre 2% e 20%; com bônus, até 50%', () => {
    expect(dodgeChance(10, 10)).toBeCloseTo(0.05);
    expect(dodgeChance(10, 13)).toBeCloseTo(0.08);
    expect(dodgeChance(50, 1)).toBe(COMBAT_RULES.minDodgeChance);
    expect(dodgeChance(1, 50)).toBe(COMBAT_RULES.maxDodgeChance);
    expect(dodgeChance(10, 10, 0.2)).toBeCloseTo(0.25);
    expect(dodgeChance(1, 50, 0.4)).toBe(0.5);
  });
});

describe('dano dentro do combate', () => {
  it('ataque básico segue a fórmula global sem aleatoriedade', () => {
    const engine = createBattle('kael', 'dravenor');
    const kael = engine.character('player');
    const dravenor = engine.character('enemy');
    act(engine, 'player', { type: 'attack' });
    expect(dravenor.maxHp - dravenor.hp).toBe(formulaDamage(kael.attack, dravenor.defense, 1));
  });

  it('crítico causa 1,5× o dano e a esquiva anula o golpe', () => {
    const crit = createBattle('kael', 'dravenor', { random: new SequenceRandom([0.99, 0, 0.5]) });
    const kael = crit.character('player');
    const dravenor = crit.character('enemy');
    act(crit, 'player', { type: 'attack' });
    expect(dravenor.maxHp - dravenor.hp).toBe(formulaDamage(kael.attack, dravenor.defense, 1, 1.5));
    expect(crit.statistics('player').criticalHits).toBe(1);

    const dodge = createBattle('kael', 'dravenor', { random: new SequenceRandom([0]) });
    const events = act(dodge, 'player', { type: 'attack' });
    expect(dodge.character('enemy').hp).toBe(dodge.character('enemy').maxHp);
    expect(events.some((event) => event.type === 'dodge')).toBe(true);
  });

  it('habilidades não variam, não são críticas e não podem ser esquivadas sem efeito de esquiva', () => {
    const engine = createBattle('kael', 'dravenor', { random: new SequenceRandom([0]) });
    const kael = engine.character('player');
    const dravenor = engine.character('enemy');
    const defense = dravenor.defense;
    act(engine, 'player', { type: 'ability', abilityId: 'arcane-blade' });
    expect(dravenor.maxHp - dravenor.hp).toBe(formulaDamage(kael.attack, defense, 1.35));
  });

  it('Corte Dimensional ignora 35% da defesa efetiva só naquele golpe', () => {
    const engine = createBattle('kael', 'vorath');
    const kael = engine.character('player');
    const vorath = engine.character('enemy');
    const defense = vorath.defense;
    const events = act(engine, 'player', { type: 'ability', abilityId: 'dimensional-cut' });
    const hit = events.find((event) => event.type === 'damage');
    expect(hit).toMatchObject({ amount: formulaDamage(kael.attack, defense * 0.65, 2) });
    expect(vorath.defense).toBe(defense);
  });

  it('reduções de dano somadas são limitadas a 60%', () => {
    const engine = createBattle('kael', 'lyra');
    const kael = engine.character('player');
    const lyra = engine.character('enemy');
    lyra.addEffect({ id: 'test-reduction', name: 'Teste', description: '', kind: 'buff', duration: 3, damageTakenModifier: -0.5 }, lyra);
    lyra.addEffect(EFFECTS.astralShield, lyra);
    act(engine, 'player', { type: 'attack' });
    expect(lyra.maxHp - lyra.hp).toBe(formulaDamage(kael.attack, lyra.defense, 1, 0.4));
    expect(lyra.hasEffect('astral-shield')).toBe(true);
    expect(lyra.hasEffect('test-reduction')).toBe(true);
  });
});
