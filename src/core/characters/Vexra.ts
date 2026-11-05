import { Character, ENERGY_RULES, type StatusBadge } from '../Character.ts';
import { burnEffect, EFFECTS } from '../effects.ts';
import type { Ability, CharacterProfile, CombatContext, DamageKind, TurnSummary } from '../types.ts';

const HEATED_BONUS = 0.15;
const GRENADE_BURN = 16;
const TURRET_TEXT = `${EFFECTS.autoTurret.turretDamage} de dano fixo no início dos próximos ${EFFECTS.autoTurret.duration} turnos`;
const OVERLOAD_TEXT = `Ataque +${Math.round(EFFECTS.overload.statModifiers.attack * 100)}% pelos próximos ${EFFECTS.overload.duration} turnos.`;

const PROFILE: CharacterProfile = {
  id: 'vexra',
  name: 'Vexra',
  role: 'Atiradora Mecânica',
  description: 'Inventora impulsiva que transforma engenhos improvisados em armas precisas.',
  playstyle: 'Pressão constante: tiros em sequência, queimaduras e uma torre que dispara sozinha. Pouca cura.',
  focus: 'Pressão e dano continuado',
  weakness: 'Pouca sustentação',
  complexity: 3,
  resourceName: 'Energia',
  baseStats: { maxHp: 640, attack: 84, defense: 22, speed: 12, maxEnergy: ENERGY_RULES.max },
  startingEnergy: ENERGY_RULES.starting,
  energyRegen: ENERGY_RULES.regen,
  defendEnergyGain: ENERGY_RULES.defendGain,
  passive: {
    name: 'Mecanismo Aquecido',
    description:
      'Ao atacar com o ataque básico em dois turnos seguidos, o segundo causa +15% de dano. A sequência reinicia depois do bônus ou de qualquer outra ação.',
  },
};

/** Atiradora: a passiva depende da sequência de ataques básicos. */
export class Vexra extends Character {
  /** Ataques básicos consecutivos sem bônus (0 ou 1). */
  private streak = 0;

  constructor(level = 1, displayName?: string) {
    super(PROFILE, level, displayName);
  }

  get isHeated(): boolean {
    return this.streak === 1;
  }

  protected createAbilities(): Ability[] {
    return [
      {
        id: 'piercing-burst',
        name: 'Rajada Perfurante',
        description: 'Dois tiros rápidos. Cada impacto conta separadamente.',
        cost: 25,
        cooldown: 2,
        target: 'enemy',
        tags: ['damage'],
        estimatePower: () => 1.3,
        execute(ctx, user, target) {
          for (let shot = 0; shot < 2 && !target.isDefeated; shot += 1) {
            ctx.dealDamage(user, target, 0.65, 'ability');
          }
        },
      },
      {
        id: 'explosive-grenade',
        name: 'Granada Explosiva',
        description: `Causa dano e aplica Queimadura: ${GRENADE_BURN} de dano no início de cada turno do alvo por 2 turnos.`,
        cost: 35,
        cooldown: 3,
        target: 'enemy',
        tags: ['damage', 'debuff'],
        estimatePower: () => 0.95,
        hints: { targetEffect: burnEffect(GRENADE_BURN) },
        execute(ctx, user, target) {
          const hit = ctx.dealDamage(user, target, 0.95, 'ability');
          if (!hit.dodged && !target.isDefeated) ctx.applyEffect(target, burnEffect(GRENADE_BURN), user);
        },
      },
      {
        id: 'auto-turret',
        name: 'Torre Automática',
        description: `Implanta uma torre que causa ${TURRET_TEXT} de Vexra. Só uma torre por vez.`,
        cost: 25,
        cooldown: 5,
        target: 'self',
        tags: ['summon'],
        hints: { selfEffect: EFFECTS.autoTurret },
        execute(ctx, user) {
          ctx.applyEffect(user, EFFECTS.autoTurret, user);
        },
      },
      {
        id: 'overload',
        name: 'Sobrecarga',
        description: OVERLOAD_TEXT,
        cost: 20,
        cooldown: 4,
        target: 'self',
        tags: ['buff'],
        hints: { selfEffect: EFFECTS.overload },
        execute(ctx, user) {
          ctx.applyEffect(user, EFFECTS.overload, user);
        },
      },
    ];
  }

  override outgoingDamageModifier(kind: DamageKind): number {
    const bonus = kind === 'basic' && this.isHeated ? HEATED_BONUS : 0;
    return super.outgoingDamageModifier(kind) + bonus;
  }

  override onActionResolved(_ctx: CombatContext, summary: TurnSummary): void {
    if (summary.action?.type === 'attack') this.streak = this.isHeated ? 0 : 1;
    else this.streak = 0;
  }

  override onTurnEnd(_ctx: CombatContext, summary: TurnSummary): void {
    if (summary.action === null) this.streak = 0;
  }

  protected override passiveBadge(): StatusBadge | null {
    if (!this.isHeated) return null;
    return { id: 'heated', label: this.passive.name, description: 'O próximo ataque básico causa +15% de dano.', kind: 'buff' };
  }
}
