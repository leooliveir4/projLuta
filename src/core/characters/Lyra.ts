import { Character, ENERGY_RULES } from '../Character.ts';
import { EFFECTS } from '../effects.ts';
import type { Ability, CharacterProfile, CombatContext, TurnSummary } from '../types.ts';

const RESONANCE_RATIO = 0.12;
const RESONANCE_CAP = 35;

const PROFILE: CharacterProfile = {
  id: 'lyra',
  name: 'Lyra',
  role: 'Maga Astral',
  description:
    'Estudiosa de uma linhagem de astrônomos arcanos, protege o equilíbrio entre conhecimento e energia estelar.',
  playstyle: 'Enfraquece o alvo, se protege com escudos e encerra a luta com a Supernova. Recupera vida a cada feitiço.',
  focus: 'Dano mágico e controle',
  weakness: 'Baixa defesa',
  complexity: 3,
  resourceName: 'Energia',
  baseStats: { maxHp: 600, attack: 82, defense: 22, speed: 14, maxEnergy: ENERGY_RULES.max },
  startingEnergy: ENERGY_RULES.starting,
  energyRegen: ENERGY_RULES.regen,
  defendEnergyGain: ENERGY_RULES.defendGain,
  passive: {
    name: 'Ressonância Astral',
    description: 'Ao causar dano com uma habilidade, recupera 12% do dano causado (máximo de 35 por ação).',
  },
};

/** Maga: a passiva converte parte do dano das habilidades em vida, uma vez por ação. */
export class Lyra extends Character {
  constructor(level = 1, displayName?: string) {
    super(PROFILE, level, displayName);
  }

  protected createAbilities(): Ability[] {
    return [
      {
        id: 'astral-orb',
        name: 'Orbe Astral',
        description: 'Causa dano mágico e aplica Fissura Estelar: defesa do alvo −20% por 2 turnos.',
        cost: 30,
        cooldown: 2,
        target: 'enemy',
        tags: ['damage', 'debuff'],
        estimatePower: () => 1.35,
        hints: { targetEffect: EFFECTS.starFissure },
        execute(ctx, user, target) {
          const hit = ctx.dealDamage(user, target, 1.35, 'ability');
          if (!hit.dodged && !target.isDefeated) ctx.applyEffect(target, EFFECTS.starFissure, user);
        },
      },
      {
        id: 'star-field',
        name: 'Campo de Estrelas',
        description: 'Dano leve e Desorientação: ataque do alvo −20% por 2 turnos.',
        cost: 40,
        cooldown: 3,
        target: 'enemy',
        tags: ['damage', 'debuff', 'defensive'],
        estimatePower: () => 0.75,
        hints: { targetEffect: EFFECTS.disorientation },
        execute(ctx, user, target) {
          const hit = ctx.dealDamage(user, target, 0.75, 'ability');
          if (!hit.dodged && !target.isDefeated) ctx.applyEffect(target, EFFECTS.disorientation, user);
        },
      },
      {
        id: 'arcane-barrier',
        name: 'Barreira Arcana',
        description: 'Escudo Astral: todo dano direto sofrido nos próximos 2 turnos do adversário é reduzido em 35%.',
        cost: 20,
        cooldown: 4,
        target: 'self',
        tags: ['defensive', 'buff'],
        hints: { selfEffect: EFFECTS.astralShield },
        execute(ctx, user) {
          ctx.applyEffect(user, EFFECTS.astralShield, user);
        },
      },
      {
        id: 'supernova',
        name: 'Supernova',
        description: 'Remove um bônus de defesa do alvo, se houver, e causa dano devastador.',
        cost: 65,
        cooldown: 5,
        target: 'enemy',
        tags: ['damage', 'finisher'],
        estimatePower: () => 2.15,
        hints: { removesDefenseBuff: true },
        execute(ctx, user, target) {
          ctx.removeEffects(target, (effect) => effect.kind === 'buff' && (effect.statModifiers?.defense ?? 0) > 0, 1);
          ctx.dealDamage(user, target, 2.15, 'ability');
        },
      },
    ];
  }

  override onActionResolved(ctx: CombatContext, summary: TurnSummary): void {
    if (summary.action?.type !== 'ability' || summary.directDamage <= 0) return;
    const amount = Math.min(RESONANCE_CAP, Math.max(1, Math.round(summary.directDamage * RESONANCE_RATIO)));
    ctx.heal(this, amount, this.passive.name);
  }
}
