import type { BattleEngine } from './BattleEngine.ts';
import type { Character } from './Character.ts';
import { Nyxara } from './characters/Nyxara.ts';
import { Vexra } from './characters/Vexra.ts';
import { COMBAT_RULES, expectedDamage, mitigationFactor } from './damage.ts';
import { EFFECTS } from './effects.ts';
import { ENERGY_ELIXIR_AMOUNT, ITEMS } from './items.ts';
import { MathRandom, type RandomSource } from './random.ts';
import type {
  Ability,
  AbilityHints,
  ActiveEffect,
  BattleAction,
  CharacterId,
  Difficulty,
  EffectTemplate,
  Side,
} from './types.ts';

export interface DifficultySettings {
  label: string;
  /** Chance de ignorar a análise e escolher uma ação válida qualquer. */
  mistakeChance: number;
  /** Ruído multiplicativo aplicado às pontuações. */
  noise: number;
  /** Procura golpes que finalizam o adversário. */
  checksLethal: boolean;
  /** Considera ameaças: guarda, esquiva ampliada, revides e risco de morte no próximo turno. */
  readsThreats: boolean;
  /** Planeja: avalia bônus, debuffs e preparação pela duração restante da luta. */
  plans: boolean;
  /** Peso dado ao uso de itens (0 a 1). */
  itemSense: number;
}

export const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySettings> = {
  easy: { label: 'Fácil', mistakeChance: 0.35, noise: 0.45, checksLethal: false, readsThreats: false, plans: false, itemSense: 0.4 },
  normal: { label: 'Normal', mistakeChance: 0.1, noise: 0.15, checksLethal: true, readsThreats: true, plans: true, itemSense: 0.8 },
  hard: { label: 'Difícil', mistakeChance: 0, noise: 0.02, checksLethal: true, readsThreats: true, plans: true, itemSense: 1 },
};

/** Tendências estratégicas de cada personagem. */
interface Personality {
  aggression: number;
  caution: number;
  spellFocus: number;
}

const PERSONALITIES: Record<CharacterId, Personality> = {
  lyra: { aggression: 1, caution: 1.05, spellFocus: 1.15 },
  vexra: { aggression: 1.15, caution: 0.9, spellFocus: 1 },
  dravenor: { aggression: 1, caution: 1.1, spellFocus: 1 },
  kael: { aggression: 1.05, caution: 1, spellFocus: 1.05 },
  nyxara: { aggression: 1.15, caution: 0.9, spellFocus: 1.1 },
  vorath: { aggression: 0.95, caution: 1.15, spellFocus: 1 },
};

export interface ScoredAction {
  action: BattleAction;
  label: string;
  score: number;
}

const LETHAL_BONUS = 1000;
const SURVIVAL_BONUS = 300;
const ENERGY_VALUE = 0.3;
const INFLUENCE_POINT_VALUE = 0.6;
/** Fração do golpe forte adiado (não perdido) creditada às ações sem dano. */
const DELAY_CREDIT = 0.8;

/** Leitura do combate usada para pontuar as ações. */
interface Situation {
  me: Character;
  foe: Character;
  /** Dano esperado do ataque básico agora (considera guarda e esquiva atuais). */
  myBasic: number;
  /** Dano típico por ação própria nas próximas rodadas. */
  myRate: number;
  /** Dano típico por ação do adversário nas próximas rodadas. */
  foeRate: number;
  /** Maior dano que o adversário pode causar na próxima ação. */
  incoming: number;
  /** Dano esperado das próximas ações próprias, na ordem provável (habilidades prontas primeiro). */
  plan: number[];
  /** Ações próprias estimadas até derrotar o adversário. */
  myHorizon: number;
  /** Ações do adversário estimadas até derrotar este personagem. */
  foeHorizon: number;
  foeEvasion: ActiveEffect | undefined;
  personality: Personality;
}

/**
 * Decide as ações do adversário controlado pelo computador, sem APIs externas.
 * Cada ação válida recebe uma pontuação. Os efeitos das habilidades são avaliados
 * pelos metadados (`hints`) e pela duração restante estimada da luta, então a IA
 * funciona para qualquer personagem e não depende só do dano imediato.
 */
export class BattleAI {
  readonly difficulty: Difficulty;
  private readonly settings: DifficultySettings;
  private readonly random: RandomSource;
  private lastAction: BattleAction['type'] | null = null;

  constructor(difficulty: Difficulty, random: RandomSource = new MathRandom()) {
    this.difficulty = difficulty;
    this.settings = DIFFICULTY_SETTINGS[difficulty];
    this.random = random;
  }

  chooseAction(engine: BattleEngine, side: Side): BattleAction {
    const options = engine.availableActions(side).filter((option) => option.available);
    if (options.length === 0) return { type: 'attack' };

    const action =
      this.random.next() < this.settings.mistakeChance
        ? this.randomAction(options.map((option) => option.action))
        : this.bestAction(engine, side);
    this.lastAction = action.type;
    return action;
  }

  private bestAction(engine: BattleEngine, side: Side): BattleAction {
    const scored = this.evaluate(engine, side).map((entry) => ({
      ...entry,
      score: entry.score * (1 + (this.random.next() * 2 - 1) * this.settings.noise),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.action ?? { type: 'attack' };
  }

  /** Pontua todas as ações disponíveis, sem aleatoriedade. Maior pontuação = melhor ação. */
  evaluate(engine: BattleEngine, side: Side): ScoredAction[] {
    const situation = this.readSituation(engine, side);
    const scored = engine
      .availableActions(side)
      .filter((option) => option.available)
      .map((option) => ({ action: option.action, label: option.label, score: this.score(option.action, situation, engine, side) }));
    return this.creditDelay(scored, situation);
  }

  /**
   * Com recargas, uma ação sem dano (bônus, defesa, item) não perde o golpe forte que está
   * pronto: apenas o adia um turno. O custo real é uma ação comum no fim da luta. Por isso,
   * quando a IA planeja e a luta ainda vai durar, essas ações recebem a diferença entre o
   * melhor golpe disponível e o ataque básico. Assim, usar Sobrecarga antes do golpe
   * forte vence "golpe forte agora" quando o bônus vale mais que um ataque básico.
   */
  private creditDelay(scored: ScoredAction[], s: Situation): ScoredAction[] {
    if (!this.settings.plans || s.myHorizon < 3) return scored;
    const dealsDamage = (action: BattleAction): boolean =>
      action.type === 'attack' || (action.type === 'ability' && Boolean(s.me.getAbility(action.abilityId)?.estimatePower));
    const damaging = scored.filter((entry) => dealsDamage(entry.action));
    const attack = scored.find((entry) => entry.action.type === 'attack')?.score ?? 0;
    const best = Math.max(attack, ...damaging.map((entry) => entry.score));
    const credit = Math.max(0, best - attack) * DELAY_CREDIT;
    if (credit <= 0) return scored;
    return scored.map((entry) => (dealsDamage(entry.action) ? entry : { ...entry, score: entry.score + credit }));
  }

  private readSituation(engine: BattleEngine, side: Side): Situation {
    const me = engine.character(side);
    const foe = engine.opponentOf(me);
    const myRate = typicalRate(me, foe);
    const foeRate = typicalRate(foe, me);
    return {
      me,
      foe,
      myBasic: expectedDamage(me, foe, 1, 'basic'),
      myRate,
      foeRate,
      incoming: this.estimateIncoming(foe, me),
      plan: plannedDamage(me, foe),
      myHorizon: Math.max(1, Math.ceil(foe.hp / Math.max(1, myRate))),
      foeHorizon: Math.max(1, Math.ceil(me.hp / Math.max(1, foeRate))),
      foeEvasion: foe.evasionEffect,
      personality: PERSONALITIES[me.id],
    };
  }

  private score(action: BattleAction, s: Situation, engine: BattleEngine, side: Side): number {
    switch (action.type) {
      case 'attack':
        return this.scoreAttack(s);
      case 'defend':
        return this.scoreDefend(s);
      case 'ability': {
        const ability = s.me.getAbility(action.abilityId);
        return ability ? this.scoreAbility(ability, s) : -Infinity;
      }
      case 'item':
        return this.scoreItem(action.itemId, s, engine, side);
    }
  }

  private scoreAttack(s: Situation): number {
    const { me, foe } = s;
    let score = s.myBasic * s.personality.aggression;
    if (this.settings.readsThreats) score -= this.counterRisk(s);
    if (me instanceof Vexra && !me.isHeated) score += s.myBasic * 0.15 * 0.5;
    if (this.settings.checksLethal) {
      const minimum = expectedDamage(me, foe, 1, 'basic', { pessimistic: true });
      const evasionBonus = s.foeEvasion?.dodgeBonus ?? 0;
      if (minimum >= foe.hp) score += LETHAL_BONUS * (1 - foe.dodgeChanceAgainst(me, evasionBonus));
    }
    return score;
  }

  private scoreAbility(ability: Ability, s: Situation): number {
    const { me, foe, personality } = s;
    let score = -ability.cost * ENERGY_VALUE;

    if (ability.estimatePower) {
      const power = ability.estimatePower(me, foe);
      const damage = expectedDamage(me, foe, power, 'ability', { defenseIgnore: ability.defenseIgnore });
      score += damage * personality.spellFocus * personality.aggression;
      if (this.settings.readsThreats) score -= this.counterRisk(s);
      if (me.id === 'lyra') score += Math.min(35, damage * 0.12) * this.healUrgency(s);

      if (this.settings.checksLethal && !s.foeEvasion) {
        const certain = expectedDamage(me, foe, power, 'ability', { pessimistic: true, defenseIgnore: ability.defenseIgnore });
        if (certain >= foe.hp) score += LETHAL_BONUS;
      }
    }

    score += this.hintValue(ability.hints, s);
    if (me instanceof Nyxara && !me.isTransformed && !ability.hints?.transformation) {
      const gain = (ability.estimatePower ? 15 : 0) + 10;
      score += Math.min(gain, 100 - me.influence) * INFLUENCE_POINT_VALUE;
    }
    return score;
  }

  /** Valor estimado dos efeitos secundários descritos nos metadados da habilidade. */
  private hintValue(hints: AbilityHints | undefined, s: Situation): number {
    if (!hints) return 0;
    const { me, foe } = s;
    let value = 0;
    if (hints.targetEffect) value += this.targetEffectValue(hints.targetEffect, s, hints.stunChance ?? 1);
    if (hints.selfEffect) value += this.selfEffectValue(hints.selfEffect, s, hints);
    if (hints.selfHeal) value += Math.min(hints.selfHeal(me, foe), me.maxHp - me.hp) * this.healUrgency(s);
    if (hints.removesDefenseBuff && foe.effects.some((effect) => effect.kind === 'buff' && (effect.statModifiers?.defense ?? 0) > 0)) {
      value += s.myRate * 0.3;
    }
    if (hints.transformation) value += this.transformationValue(s);
    return value;
  }

  /** Quantas ações futuras um efeito pode aproveitar; sem planejamento, só a próxima. */
  private uses(turns: number, horizon: number): number {
    if (!this.settings.plans) return Math.min(1, turns);
    return Math.max(0, Math.min(turns, horizon));
  }

  private targetEffectValue(effect: EffectTemplate, s: Situation, chance: number): number {
    const { foe, myRate, foeRate, personality } = s;
    if (this.settings.plans && s.myHorizon <= 1) return 0;
    const turns = effect.duration;
    // A duração conta os turnos do alvo: entre eles, o personagem age turns − 1 vezes (pelo menos uma).
    const myUses = this.uses(Math.max(1, turns - 1), s.myHorizon - 1);
    const foeUses = this.uses(turns, s.foeHorizon);
    let value = 0;
    const defense = effect.statModifiers?.defense ?? 0;
    const attack = effect.statModifiers?.attack ?? 0;
    const speed = effect.statModifiers?.speed ?? 0;
    if (defense < 0) value += damageGainFromDefense(foe.defense, defense) * planned(s, myUses);
    if (attack < 0) value += -attack * foeRate * foeUses * personality.caution;
    if (speed < 0) value += myRate * 0.03 * turns;
    if ((effect.damageTakenModifier ?? 0) > 0) value += (effect.damageTakenModifier ?? 0) * planned(s, myUses);
    if (effect.periodicDamage) value += Math.min(effect.periodicDamage * this.uses(turns, s.myHorizon + 1), foe.hp);
    if (effect.stun) value += (foeRate * personality.caution + myRate * 0.3) * chance;

    const existing = foe.getEffect(effect.id);
    if (existing && existing.remaining >= turns) return value * 0.1;
    return existing ? value * 0.4 : value;
  }

  private selfEffectValue(effect: EffectTemplate, s: Situation, hints: AbilityHints): number {
    const { me, foe, foeRate, incoming, personality } = s;
    if (me.hasEffect(effect.id)) return -40;
    const turns = effect.duration;
    const myUses = this.uses(turns, s.myHorizon - 1);
    const foeUses = this.uses(turns, s.foeHorizon);
    let value = 0;
    let survives = false;
    const attack = effect.statModifiers?.attack ?? 0;
    const defense = effect.statModifiers?.defense ?? 0;
    const speed = effect.statModifiers?.speed ?? 0;
    const reduction = -(effect.damageTakenModifier ?? 0);

    if (attack > 0) value += attack * planned(s, myUses);
    if (defense > 0) {
      const cut = damageCutFromDefense(me.defense, defense);
      value += cut * foeRate * foeUses * personality.caution;
      survives ||= incoming * (1 - cut) < me.hp;
    }
    if (speed > 0) value += foeRate * 0.02 * turns;
    if (reduction > 0) {
      const covered = effect.consumeOn === 'direct-damage' ? incoming : foeRate * foeUses;
      value += reduction * covered * personality.caution;
      survives ||= incoming * (1 - reduction) < me.hp;
    }
    if (effect.dodgeBonus) {
      const before = me.dodgeChanceAgainst(foe);
      const after = me.dodgeChanceAgainst(foe, effect.dodgeBonus);
      value += (after - before) * incoming * personality.caution;
      if (effect.counterOnDodge) value += after * expectedDamage(me, foe, effect.counterOnDodge, 'counter', { ignoreGuard: true });
      if (effect.counterPower) value += (1 - after) * expectedDamage(me, foe, effect.counterPower, 'counter', { ignoreGuard: true });
      if (hints.influenceOnDodge && me instanceof Nyxara && !me.isTransformed) {
        value += after * Math.min(hints.influenceOnDodge, 100 - me.influence) * INFLUENCE_POINT_VALUE;
      }
      if (this.settings.readsThreats && incoming >= me.hp) value += SURVIVAL_BONUS * after * 0.8;
    }
    if (effect.turretDamage) value += Math.min(effect.turretDamage * this.uses(turns, s.myHorizon), foe.hp);
    if (this.settings.readsThreats && incoming >= me.hp && survives) value += SURVIVAL_BONUS * 0.8;
    return value;
  }

  /**
   * Três turnos com ataque maior e habilidades mais fortes, em troca de um turno sem dano.
   * Vale mais cedo do que tarde; perto de finalizar o adversário, não compensa.
   */
  private transformationValue(s: Situation): number {
    const unguarded = s.me.attack * mitigationFactor(s.foe.defense);
    if (s.foe.hp <= unguarded * 1.5) return -unguarded;
    return unguarded * 2.2;
  }

  private scoreDefend(s: Situation): number {
    const { me, foe, incoming, personality } = s;
    if (foe.isStunned) return me.defendEnergyGain * ENERGY_VALUE * 0.5;

    let score = incoming * COMBAT_RULES.guardReduction * personality.caution * 0.45;
    score += me.defendEnergyGain * ENERGY_VALUE * (me.energy < me.maxEnergy * 0.5 ? 1.5 : 0.5);
    const survives = incoming * COMBAT_RULES.guardReduction < me.hp;
    if (this.lastAction === 'defend') {
      score *= 0.3;
    } else if (this.settings.readsThreats && incoming >= me.hp && survives) {
      score += SURVIVAL_BONUS;
    }
    return score;
  }

  private scoreItem(itemId: keyof typeof ITEMS, s: Situation, engine: BattleEngine, side: Side): number {
    const { me, incoming } = s;
    let score = 0;
    switch (itemId) {
      case 'health-potion': {
        const healed = Math.min(Math.round(me.maxHp * 0.3), me.maxHp - me.hp);
        score = healed * this.healUrgency(s) * 1.2;
        const survives = me.hp + healed > incoming;
        if (this.settings.readsThreats && incoming >= me.hp && survives) score += SURVIVAL_BONUS * 0.9;
        break;
      }
      case 'energy-elixir':
        score = this.elixirValue(s);
        break;
      case 'strength-tonic':
        score = this.selfEffectValue(EFFECTS.strength, s, {});
        break;
    }
    const remainingAfter = engine.inventory(side).count(itemId) - 1;
    if (remainingAfter > 0) score += 5;
    return score * this.settings.itemSense;
  }

  /**
   * O elixir vale pela habilidade que ele libera: se uma habilidade pronta (ou pronta no
   * próximo turno) não cabe na energia do próximo turno e passa a caber com o elixir,
   * o ganho é a diferença entre ela e o ataque básico.
   */
  private elixirValue(s: Situation): number {
    const { me, foe } = s;
    const restored = Math.min(ENERGY_ELIXIR_AMOUNT, me.maxEnergy - me.energy);
    if (restored <= 0) return -10;
    const nextEnergy = Math.min(me.maxEnergy, me.energy + me.energyRegen);
    let gap = 0;
    for (const ability of me.abilities) {
      if (ability.cost <= nextEnergy || ability.cost > Math.min(me.maxEnergy, nextEnergy + restored)) continue;
      if (me.getCooldown(ability.id) > 1 || ability.restriction?.(me)) continue;
      const damage = ability.estimatePower
        ? expectedDamage(me, foe, ability.estimatePower(me, foe), 'ability', { defenseIgnore: ability.defenseIgnore, ignoreGuard: true })
        : 0;
      const support = ability.hints ? this.hintValue(ability.hints, s) : 0;
      gap = Math.max(gap, damage + support - s.myBasic);
    }
    if (this.settings.plans && s.myHorizon <= 1) gap = 0;
    return gap * 0.8 + restored * ENERGY_VALUE;
  }

  /** Maior dano que o adversário pode causar no próximo turno dele, incluindo convocações. */
  private estimateIncoming(foe: Character, me: Character): number {
    if (foe.isStunned) return 0;
    let best = expectedDamage(foe, me, 1, 'basic', { ignoreGuard: true });
    const nextEnergy = Math.min(foe.maxEnergy, foe.energy + foe.energyRegen);
    for (const ability of foe.abilities) {
      if (!ability.estimatePower || foe.getCooldown(ability.id) > 0 || nextEnergy < ability.cost) continue;
      if (ability.restriction?.(foe)) continue;
      const power = ability.estimatePower(foe, me);
      best = Math.max(best, expectedDamage(foe, me, power, 'ability', { defenseIgnore: ability.defenseIgnore, ignoreGuard: true }));
    }
    const fixed = foe.effects.reduce((sum, effect) => sum + (effect.turretDamage ?? 0), 0);
    return best + fixed;
  }

  /** Dano esperado de um revide quando o adversário está com um efeito que revida. */
  private counterRisk(s: Situation): number {
    const veil = s.foeEvasion;
    if (!veil || (!veil.counterPower && !veil.counterOnDodge)) return 0;
    const dodge = s.foe.dodgeChanceAgainst(s.me, veil.dodgeBonus ?? 0);
    const onHit = veil.counterPower ? expectedDamage(s.foe, s.me, veil.counterPower, 'counter', { ignoreGuard: true }) * (1 - dodge) : 0;
    const onDodge = veil.counterOnDodge ? expectedDamage(s.foe, s.me, veil.counterOnDodge, 'counter', { ignoreGuard: true }) * dodge : 0;
    return onHit + onDodge;
  }

  /** Urgência de cura: alta com pouca vida ou quando o adversário pode vencer em poucas ações. */
  private healUrgency(s: Situation): number {
    if (s.me.hpRatio < 0.35 || (this.settings.plans && s.foeHorizon <= 2)) return 1.5;
    if (s.me.hpRatio < 0.6) return 0.8;
    return 0.15;
  }

  private randomAction(actions: BattleAction[]): BattleAction {
    const weights = actions.map((action) => (action.type === 'attack' ? 3 : 1));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = this.random.next() * total;
    for (let i = 0; i < actions.length; i += 1) {
      roll -= weights[i];
      if (roll < 0) return actions[i];
    }
    return actions[actions.length - 1];
  }
}

/** Soma do dano das próximas `uses` ações planejadas (ataque básico depois que o plano acaba). */
function planned(s: Situation, uses: number): number {
  let total = 0;
  for (let i = 0; i < uses; i += 1) total += s.plan[i] ?? s.plan[s.plan.length - 1] ?? s.myRate;
  return total;
}

/**
 * Próximas ações de dano prováveis: habilidades prontas (ou prontas no turno seguinte)
 * que a energia permite, da mais forte para a mais fraca, seguidas do ataque básico.
 */
function plannedDamage(me: Character, foe: Character): number[] {
  const basic = expectedDamage(me, foe, 1, 'basic', { ignoreGuard: true });
  const options = me.abilities
    .filter((ability) => ability.estimatePower && !ability.restriction?.(me) && me.getCooldown(ability.id) <= 1)
    .map((ability) => ({
      cost: ability.cost,
      damage: expectedDamage(me, foe, ability.estimatePower?.(me, foe) ?? 0, 'ability', {
        defenseIgnore: ability.defenseIgnore,
        ignoreGuard: true,
      }),
    }))
    .filter((option) => option.damage > basic)
    .sort((a, b) => b.damage - a.damage);
  const plan: number[] = [];
  let energy = me.energy;
  for (const option of options) {
    energy += me.energyRegen;
    if (option.cost > energy) continue;
    energy -= option.cost;
    plan.push(option.damage);
  }
  plan.push(basic);
  return plan;
}

/** Dano típico por ação: mistura do básico com a melhor habilidade de dano, sem guarda. */
function typicalRate(source: Character, target: Character): number {
  const basic = expectedDamage(source, target, 1, 'basic', { ignoreGuard: true });
  let best = basic;
  for (const ability of source.abilities) {
    if (!ability.estimatePower || ability.restriction?.(source)) continue;
    const damage = expectedDamage(source, target, ability.estimatePower(source, target), 'ability', {
      defenseIgnore: ability.defenseIgnore,
      ignoreGuard: true,
    });
    best = Math.max(best, damage);
  }
  return basic * 0.65 + best * 0.35;
}

/** Aumento relativo do dano causado quando a defesa do alvo cai pela fração informada. */
function damageGainFromDefense(defense: number, modifier: number): number {
  const reduced = Math.max(0, defense * (1 + modifier));
  return mitigationFactor(reduced) / mitigationFactor(defense) - 1;
}

/** Fração do dano recebido que deixa de passar quando a própria defesa sobe. */
function damageCutFromDefense(defense: number, modifier: number): number {
  const raised = defense * (1 + modifier);
  return 1 - mitigationFactor(raised) / mitigationFactor(defense);
}
