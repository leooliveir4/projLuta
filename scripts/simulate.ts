/**
 * Simulação de balanceamento: IA contra IA em todos os pares de personagens, com
 * aleatoriedade controlada por semente e alternando quem ocupa cada lado.
 *
 * Uso: npm run simulate -- [combates por par] [dificuldade] [deslocamento da semente]
 * Exemplo: npm run simulate -- 200 hard
 * O deslocamento (padrão 0) troca o conjunto de sementes, útil para validar um ajuste
 * em combates diferentes dos usados para calibrá-lo: npm run simulate -- 150 normal 1000
 */
import { BattleAI } from '../src/core/BattleAI.ts';
import { BattleEngine } from '../src/core/BattleEngine.ts';
import { Nyxara } from '../src/core/characters/Nyxara.ts';
import { SeededRandom } from '../src/core/random.ts';
import { CHARACTER_IDS, createCharacter } from '../src/core/roster.ts';
import type { CharacterId, Difficulty, Side } from '../src/core/types.ts';

const battlesPerPair = Number(process.argv[2] ?? 100);
const difficulty = (process.argv[3] ?? 'normal') as Difficulty;
const seedOffset = Number(process.argv[4] ?? 0);

interface Totals {
  battles: number;
  wins: number;
  firstMoverBattles: number;
  firstMoverWins: number;
  damage: number;
  healing: number;
  turns: number;
  actions: Map<string, number>;
  transformations: number;
}

const totals = new Map<CharacterId, Totals>();
for (const id of CHARACTER_IDS) {
  totals.set(id, { battles: 0, wins: 0, firstMoverBattles: 0, firstMoverWins: 0, damage: 0, healing: 0, turns: 0, actions: new Map(), transformations: 0 });
}
const pairRates: { a: CharacterId; b: CharacterId; rate: number; turns: number; maxTurns: number }[] = [];

function fight(playerId: CharacterId, enemyId: CharacterId, index: number) {
  const seed = index + seedOffset;
  const engine = new BattleEngine({
    player: createCharacter(playerId),
    enemy: createCharacter(enemyId),
    random: new SeededRandom(seed),
  });
  const ais: Record<Side, BattleAI> = {
    player: new BattleAI(difficulty, new SeededRandom(seed * 7 + 1)),
    enemy: new BattleAI(difficulty, new SeededRandom(seed * 13 + 5)),
  };
  const used: Record<Side, string[]> = { player: [], enemy: [] };
  const transformed: Record<Side, number> = { player: 0, enemy: 0 };
  const first: Side = BattleEngine.firstSide(engine.character('player'), engine.character('enemy'));
  engine.start();
  let guard = 0;
  while (!engine.isOver && guard < 500) {
    const side = engine.active;
    const action = ais[side].chooseAction(engine, side);
    const result = engine.perform(side, action);
    if (!result.accepted) throw new Error(`Ação inválida escolhida pela IA: ${result.reason}`);
    used[side].push(action.type === 'ability' ? action.abilityId : action.type === 'item' ? action.itemId : action.type);
    for (const event of result.events) {
      if (event.type === 'form-change' && event.form === 'eclipse') transformed[event.target] += 1;
    }
    guard += 1;
  }
  return { engine, used, transformed, first };
}

for (let i = 0; i < CHARACTER_IDS.length; i += 1) {
  for (let j = i + 1; j < CHARACTER_IDS.length; j += 1) {
    const a = CHARACTER_IDS[i];
    const b = CHARACTER_IDS[j];
    let aWins = 0;
    let pairTurns = 0;
    let maxTurns = 0;
    for (let seed = 1; seed <= battlesPerPair; seed += 1) {
      const aIsPlayer = seed % 2 === 1;
      const { engine, used, transformed, first } = aIsPlayer ? fight(a, b, seed) : fight(b, a, seed);
      pairTurns += engine.turn;
      maxTurns = Math.max(maxTurns, engine.turn);
      for (const side of ['player', 'enemy'] as const) {
        const character = engine.character(side);
        const t = totals.get(character.id)!;
        const won = engine.winner === side;
        t.battles += 1;
        t.turns += engine.turn;
        t.damage += engine.statistics(side).damageDealt;
        t.healing += engine.statistics(side).healing;
        if (won) t.wins += 1;
        if (first === side) {
          t.firstMoverBattles += 1;
          if (won) t.firstMoverWins += 1;
        }
        if (character instanceof Nyxara) t.transformations += transformed[side];
        for (const key of used[side]) t.actions.set(key, (t.actions.get(key) ?? 0) + 1);
      }
      if (engine.winner === (aIsPlayer ? 'player' : 'enemy')) aWins += 1;
    }
    pairRates.push({ a, b, rate: aWins / battlesPerPair, turns: pairTurns / battlesPerPair, maxTurns });
  }
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const seeds = `sementes ${seedOffset + 1} a ${seedOffset + battlesPerPair}`;
console.log(`# Simulação: ${battlesPerPair} combates por par, dificuldade ${difficulty}, ${seeds}\n`);
console.log('| Personagem | Vitórias | Vitórias agindo primeiro | Turnos médios | Dano médio | Cura média | Eclipses por luta |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const id of CHARACTER_IDS) {
  const t = totals.get(id)!;
  const firstRate = t.firstMoverBattles > 0 ? pct(t.firstMoverWins / t.firstMoverBattles) : '–';
  const eclipse = id === 'nyxara' ? (t.transformations / t.battles).toFixed(2) : '–';
  console.log(
    `| ${id} | ${pct(t.wins / t.battles)} | ${firstRate} | ${(t.turns / t.battles).toFixed(1)} | ${Math.round(t.damage / t.battles)} | ${Math.round(t.healing / t.battles)} | ${eclipse} |`,
  );
}

console.log('\n| Confronto | Vitórias do primeiro | Turnos médios | Turnos (máximo) |');
console.log('|---|---:|---:|---:|');
for (const pair of pairRates) {
  console.log(`| ${pair.a} × ${pair.b} | ${pct(pair.rate)} | ${pair.turns.toFixed(1)} | ${pair.maxTurns} |`);
}
const extremes = pairRates.filter((pair) => pair.rate < 0.25 || pair.rate > 0.75);
const all = [...totals.values()];
const average = all.reduce((sum, t) => sum + t.turns, 0) / all.reduce((sum, t) => sum + t.battles, 0);
console.log(`\nTurnos médios no geral: ${average.toFixed(1)}.`);
console.log(`Confrontos fora da faixa de 25% a 75%: ${extremes.map((p) => `${p.a} × ${p.b} (${pct(p.rate)})`).join(', ') || 'nenhum'}.`);

console.log('\n| Personagem | Uso das ações |');
console.log('|---|---|');
for (const id of CHARACTER_IDS) {
  const t = totals.get(id)!;
  const sum = [...t.actions.values()].reduce((x, y) => x + y, 0);
  const list = [...t.actions.entries()].sort((x, y) => y[1] - x[1]).map(([key, value]) => `${key} ${pct(value / sum)}`);
  console.log(`| ${id} | ${list.join(', ')} |`);
}
