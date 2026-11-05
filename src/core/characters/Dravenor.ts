import { Character, ENERGY_RULES } from '../Character.ts';
import { EFFECTS } from '../effects.ts';
import type { Ability, CharacterProfile, CombatContext } from '../types.ts';

const VIGOR_HEAL = 16;
const VIGOR_THRESHOLD = 0.45;
const FURY_HEAL = 65;
const RUPTURE_STUN_CHANCE = 0.4;

const PROFILE: CharacterProfile = {
  id: 'dravenor',
  name: 'Dravenor',
  role: 'Guerreiro Bestial',
  description: 'Guardião das Terras Selvagens, luta para proteger seu povo e resistir às forças que ameaçam a fronteira.',
  playstyle: 'Muita vida e defesa, regeneração quando ferido e golpes pesados que podem atordoar. Sempre age por último.',
  focus: 'Resistência e regeneração',
  weakness: 'Baixa velocidade',
  complexity: 2,
  resourceName: 'Energia',
  baseStats: { maxHp: 780, attack: 57, defense: 34, speed: 7, maxEnergy: ENERGY_RULES.max },
  startingEnergy: ENERGY_RULES.starting,
  energyRegen: ENERGY_RULES.regen,
  defendEnergyGain: ENERGY_RULES.defendGain,
  passive: {
    name: 'Vigor Ancestral',
    description: `Ao começar o turno com menos de ${Math.round(VIGOR_THRESHOLD * 100)}% de vida, recupera ${VIGOR_HEAL} de vida (uma vez por turno, depois do dano contínuo).`,
  },
};

/** Guerreiro: a passiva age no início do turno, depois do dano periódico. */
export class Dravenor extends Character {
  constructor(level = 1, displayName?: string) {
    super(PROFILE, level, displayName);
  }

  protected createAbilities(): Ability[] {
    return [
      {
        id: 'devastating-blow',
        name: 'Golpe Devastador',
        description: 'Golpe pesado que aplica Armadura Rachada: defesa do alvo −15% por 2 turnos.',
        cost: 30,
        cooldown: 2,
        target: 'enemy',
        tags: ['damage', 'debuff'],
        estimatePower: () => 1.35,
        hints: { targetEffect: EFFECTS.sundered },
        execute(ctx, user, target) {
          const hit = ctx.dealDamage(user, target, 1.35, 'ability');
          if (!hit.dodged && !target.isDefeated) ctx.applyEffect(target, EFFECTS.sundered, user);
        },
      },
      {
        id: 'iron-skin',
        name: 'Pele de Ferro',
        description: 'Defesa +35% pelos próximos 2 turnos.',
        cost: 25,
        cooldown: 3,
        target: 'self',
        tags: ['defensive', 'buff'],
        hints: { selfEffect: EFFECTS.ironSkin },
        execute(ctx, user) {
          ctx.applyEffect(user, EFFECTS.ironSkin, user);
        },
      },
      {
        id: 'ancestral-fury',
        name: 'Fúria Ancestral',
        description: `Recupera ${FURY_HEAL} de vida e ganha ataque +20% pelos próximos 2 turnos. Não remove efeitos negativos.`,
        cost: 45,
        cooldown: 4,
        target: 'self',
        tags: ['heal', 'buff'],
        hints: { selfEffect: EFFECTS.ancestralFury, selfHeal: () => FURY_HEAL },
        execute(ctx, user) {
          ctx.heal(user, FURY_HEAL);
          ctx.applyEffect(user, EFFECTS.ancestralFury, user);
        },
      },
      {
        id: 'earth-rupture',
        name: 'Ruptura da Terra',
        description: `Golpe que racha o chão: dano alto e ${Math.round(RUPTURE_STUN_CHANCE * 100)}% de chance de atordoar o alvo por 1 turno.`,
        cost: 60,
        cooldown: 5,
        target: 'enemy',
        tags: ['damage', 'control'],
        estimatePower: () => 1.8,
        hints: { targetEffect: EFFECTS.stunned, stunChance: RUPTURE_STUN_CHANCE },
        execute(ctx, user, target) {
          const hit = ctx.dealDamage(user, target, 1.8, 'ability');
          if (hit.dodged || target.isDefeated) return;
          if (ctx.random.next() < RUPTURE_STUN_CHANCE) ctx.applyEffect(target, EFFECTS.stunned, user);
        },
      },
    ];
  }

  override onTurnStart(ctx: CombatContext): void {
    if (!this.isDefeated && this.hpRatio < VIGOR_THRESHOLD) ctx.heal(this, VIGOR_HEAL, this.passive.name);
  }
}
