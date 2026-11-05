import { Character, ENERGY_RULES } from '../Character.ts';
import { expectedDamage } from '../damage.ts';
import { EFFECTS } from '../effects.ts';
import type { Ability, CharacterProfile, CombatContext, DamageOutcome } from '../types.ts';

const CORE_HEAL = 10;
const ASSIMILATION_RATIO = 0.35;
const ASSIMILATION_CAP = 60;
const MASS_HEAL = 25;

const PROFILE: CharacterProfile = {
  id: 'vorath',
  name: 'Vorath',
  role: 'Colosso Abissal',
  description:
    'Massa viva e mutável criada pela essência do Abismo. Não é humanoide nem tem um corpo estável: membros fluidos, mandíbula luminosa e armadura orgânica.',
  playstyle: 'Absorve dano, se regenera a cada golpe sofrido e deixa o adversário lento. Dano direto baixo.',
  focus: 'Absorção e controle',
  weakness: 'Lento; dano direto baixo',
  complexity: 3,
  resourceName: 'Energia',
  baseStats: { maxHp: 820, attack: 61, defense: 34, speed: 6, maxEnergy: ENERGY_RULES.max },
  startingEnergy: ENERGY_RULES.starting,
  energyRegen: ENERGY_RULES.regen,
  defendEnergyGain: ENERGY_RULES.defendGain,
  passive: {
    name: 'Núcleo Voraz',
    description: `No início de cada turno, recupera ${CORE_HEAL} de vida se tiver sofrido dano desde o turno anterior.`,
  },
};

/** Colosso: a passiva lembra se sofreu dano desde o último turno. */
export class Vorath extends Character {
  private damagedSinceTurn = false;

  constructor(level = 1, displayName?: string) {
    super(PROFILE, level, displayName);
  }

  protected createAbilities(): Ability[] {
    return [
      {
        id: 'abyss-impact',
        name: 'Impacto do Abismo',
        description: 'Esmaga o alvo e aplica Lentidão: velocidade −25% por 2 turnos.',
        cost: 30,
        cooldown: 2,
        target: 'enemy',
        tags: ['damage', 'debuff'],
        estimatePower: () => 1.2,
        hints: { targetEffect: EFFECTS.abyssSlow },
        execute(ctx, user, target) {
          const hit = ctx.dealDamage(user, target, 1.2, 'ability');
          if (!hit.dodged && !target.isDefeated) ctx.applyEffect(target, EFFECTS.abyssSlow, user);
        },
      },
      {
        id: 'assimilation',
        name: 'Assimilação',
        description: `Causa dano e recupera ${Math.round(ASSIMILATION_RATIO * 100)}% do dano causado (máximo de ${ASSIMILATION_CAP}).`,
        cost: 35,
        cooldown: 3,
        target: 'enemy',
        tags: ['damage', 'heal'],
        estimatePower: () => 0.9,
        hints: {
          selfHeal: (user, target) =>
            Math.min(ASSIMILATION_CAP, expectedDamage(user, target, 0.9, 'ability') * ASSIMILATION_RATIO),
        },
        execute(ctx, user, target) {
          const hit = ctx.dealDamage(user, target, 0.9, 'ability');
          if (hit.amount > 0) ctx.heal(user, Math.min(ASSIMILATION_CAP, Math.round(hit.amount * ASSIMILATION_RATIO)));
        },
      },
      {
        id: 'unstable-mass',
        name: 'Massa Instável',
        description: `Defesa +25% pelos próximos 2 turnos e recupera ${MASS_HEAL} de vida na hora.`,
        cost: 25,
        cooldown: 3,
        target: 'self',
        tags: ['defensive', 'heal', 'buff'],
        hints: { selfEffect: EFFECTS.unstableMass, selfHeal: () => MASS_HEAL },
        execute(ctx, user) {
          ctx.applyEffect(user, EFFECTS.unstableMass, user);
          ctx.heal(user, MASS_HEAL);
        },
      },
      {
        id: 'void-rupture',
        name: 'Ruptura do Vazio',
        description: 'Rasga o espaço em volta do alvo: dano alto e Torpor do Vazio, velocidade −35% por 2 turnos.',
        cost: 60,
        cooldown: 5,
        target: 'enemy',
        tags: ['damage', 'debuff', 'finisher'],
        estimatePower: () => 1.75,
        hints: { targetEffect: EFFECTS.voidTorpor },
        execute(ctx, user, target) {
          const hit = ctx.dealDamage(user, target, 1.75, 'ability');
          if (!hit.dodged && !target.isDefeated) ctx.applyEffect(target, EFFECTS.voidTorpor, user);
        },
      },
    ];
  }

  get hungry(): boolean {
    return this.damagedSinceTurn;
  }

  override onDamageTaken(_ctx: CombatContext, outcome: DamageOutcome): void {
    if (outcome.amount > 0) this.damagedSinceTurn = true;
  }

  override onTurnStart(ctx: CombatContext): void {
    const wasDamaged = this.damagedSinceTurn;
    this.damagedSinceTurn = false;
    if (wasDamaged && !this.isDefeated) ctx.heal(this, CORE_HEAL, this.passive.name);
  }
}
