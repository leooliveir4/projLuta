import { Character, ENERGY_RULES, type StatusBadge } from '../Character.ts';
import { EFFECTS } from '../effects.ts';
import type { Ability, CharacterProfile, CombatContext, DamageKind, DamageOutcome, TurnSummary } from '../types.ts';

const READING_BONUS = 0.2;
const DIMENSIONAL_IGNORE = 0.35;

const PROFILE: CharacterProfile = {
  id: 'kael',
  name: 'Kael',
  role: 'Duelista Arcano',
  description: 'Espadachim disciplinado que combina técnica e fluxo arcano, buscando domínio sobre sua própria força.',
  playstyle: 'O mais veloz do elenco: esquiva, transforma cada esquiva em um contra-ataque mais forte e corta a defesa do alvo.',
  focus: 'Mobilidade e contra-ataque',
  weakness: 'Pouca vida',
  complexity: 4,
  resourceName: 'Energia',
  baseStats: { maxHp: 570, attack: 80, defense: 24, speed: 17, maxEnergy: ENERGY_RULES.max },
  startingEnergy: ENERGY_RULES.starting,
  energyRegen: ENERGY_RULES.regen,
  defendEnergyGain: ENERGY_RULES.defendGain,
  passive: {
    name: 'Leitura de Combate',
    description: 'Depois de esquivar de um ataque, o próximo ataque básico causa +20% de dano (uma vez, sem acumular).',
  },
};

/** Duelista: a passiva reage à esquiva e fortalece o ataque básico seguinte. */
export class Kael extends Character {
  private readied = false;

  constructor(level = 1, displayName?: string) {
    super(PROFILE, level, displayName);
  }

  get hasCombatReading(): boolean {
    return this.readied;
  }

  protected createAbilities(): Ability[] {
    return [
      {
        id: 'arcane-blade',
        name: 'Lâmina Arcana',
        description: 'Corte carregado que aplica Guarda Aberta: defesa do alvo −15% por 2 turnos.',
        cost: 30,
        cooldown: 2,
        target: 'enemy',
        tags: ['damage', 'debuff'],
        estimatePower: () => 1.35,
        hints: { targetEffect: EFFECTS.openGuard },
        execute(ctx, user, target) {
          const hit = ctx.dealDamage(user, target, 1.35, 'ability');
          if (!hit.dodged && !target.isDefeated) ctx.applyEffect(target, EFFECTS.openGuard, user);
        },
      },
      {
        id: 'ethereal-step',
        name: 'Passo Etéreo',
        description: '+35 pontos percentuais de esquiva contra o próximo ataque direto, até o fim do próximo turno (máximo de 50%). Se esquivar, Kael revida na hora.',
        cost: 15,
        cooldown: 3,
        target: 'self',
        tags: ['defensive', 'buff'],
        hints: { selfEffect: EFFECTS.etherealStep },
        execute(ctx, user) {
          ctx.applyEffect(user, EFFECTS.etherealStep, user);
        },
      },
      {
        id: 'perfect-duel',
        name: 'Duelo Perfeito',
        description: 'Ataque +35% e velocidade +20% pelos próximos 3 turnos. A velocidade melhora a esquiva, não dá turnos extras.',
        cost: 20,
        cooldown: 4,
        target: 'self',
        tags: ['buff'],
        hints: { selfEffect: EFFECTS.perfectDuel },
        execute(ctx, user) {
          ctx.applyEffect(user, EFFECTS.perfectDuel, user);
        },
      },
      {
        id: 'dimensional-cut',
        name: 'Corte Dimensional',
        description: 'Golpe que atravessa a guarda: ignora 35% da defesa do alvo neste ataque.',
        cost: 65,
        cooldown: 5,
        target: 'enemy',
        tags: ['damage', 'finisher'],
        defenseIgnore: DIMENSIONAL_IGNORE,
        estimatePower: () => 2,
        execute(ctx, user, target) {
          ctx.dealDamage(user, target, 2, 'ability', { defenseIgnore: DIMENSIONAL_IGNORE });
        },
      },
    ];
  }

  override outgoingDamageModifier(kind: DamageKind): number {
    const bonus = kind === 'basic' && this.readied ? READING_BONUS : 0;
    return super.outgoingDamageModifier(kind) + bonus;
  }

  override onAttacked(ctx: CombatContext, _attacker: Character, outcome: DamageOutcome): void {
    if (!outcome.dodged || this.readied || this.isDefeated) return;
    this.readied = true;
    ctx.note(`${this.name} lê o combate: o próximo ataque básico causa +20% de dano.`, 'effect');
  }

  override onActionResolved(_ctx: CombatContext, summary: TurnSummary): void {
    if (summary.action?.type === 'attack') this.readied = false;
  }

  protected override passiveBadge(): StatusBadge | null {
    if (!this.readied) return null;
    return { id: 'combat-reading', label: this.passive.name, description: 'O próximo ataque básico causa +20% de dano.', kind: 'buff' };
  }
}
