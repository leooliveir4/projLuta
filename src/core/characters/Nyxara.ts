import { Character, ENERGY_RULES, type SpecialMeter, type StatusBadge } from '../Character.ts';
import { expectedDamage } from '../damage.ts';
import { bleedEffect, EFFECTS } from '../effects.ts';
import {
  isDirectDamage,
  type Ability,
  type ActiveEffect,
  type CharacterProfile,
  type CombatContext,
  type DamageOutcome,
  type ModifiableStat,
  type TurnSummary,
} from '../types.ts';

export const INFLUENCE_MAX = 100;
const INFLUENCE_ON_DAMAGE_DEALT = 15;
const INFLUENCE_ON_DAMAGE_TAKEN = 10;
const INFLUENCE_ON_SKILL = 10;
/** Influência extra quando o Véu Espectral faz Nyxara esquivar. */
export const INFLUENCE_ON_VEIL_DODGE = 20;

export const ECLIPSE_ID = 'eclipse';
export const ECLIPSE_TURNS = 3;
export const ECLIPSE_COOLDOWN = 5;
const ECLIPSE_BONUS: Record<ModifiableStat, number> = { attack: 0.3, speed: 0.1, defense: -0.15 };
const percent = (value: number) => `${value > 0 ? '+' : '−'}${Math.round(Math.abs(value) * 100)}%`;
const ECLIPSE_TEXT = `ataque ${percent(ECLIPSE_BONUS.attack)}, velocidade ${percent(ECLIPSE_BONUS.speed)}, defesa ${percent(ECLIPSE_BONUS.defense)}`;

const SHADOW_BLEED = 16;
const RENDING_BLEED = 22;
const RENDING_HEAL_RATIO = 0.15;

type Form = 'base' | 'eclipse';

const PROFILE: CharacterProfile = {
  id: 'nyxara',
  name: 'Nyxara',
  role: 'Portadora do Eclipse',
  description:
    'Assassina parcialmente corrompida pela arma consciente Vaelith. No Eclipse, Vaelith assume o controle numa forma demoníaca por 3 turnos; depois, Nyxara retoma o corpo.',
  playstyle: 'Acumula influência lutando, aplica sangramento e, no Eclipse, troca as habilidades por versões mais violentas.',
  focus: 'Sangramento e transformação',
  weakness: 'Defesa frágil; exige gestão da influência',
  complexity: 5,
  resourceName: 'Energia',
  baseStats: { maxHp: 580, attack: 84, defense: 18, speed: 16, maxEnergy: ENERGY_RULES.max },
  startingEnergy: ENERGY_RULES.starting,
  energyRegen: ENERGY_RULES.regen,
  defendEnergyGain: ENERGY_RULES.defendGain,
  passive: {
    name: 'Corrupção do Eclipse',
    description:
      'Influência de 0 a 100: +15 ao causar dano direto em uma ação, +10 ao sofrer dano direto de uma ação inimiga e +10 ao usar uma habilidade normal. Com 100, o Eclipse de Vaelith fica disponível.',
  },
};

/**
 * Nyxara troca de forma sem criar outra instância: vida, energia, efeitos, itens e
 * recargas continuam os mesmos. O Eclipse muda atributos e o conjunto de habilidades,
 * que compartilham os ids (e portanto as recargas) com a forma normal.
 */
export class Nyxara extends Character {
  private form: Form = 'base';
  private turnsLeft = 0;
  private activatedThisTurn = false;
  private influenceValue = 0;
  private lastHitActionId = -1;
  private bestial: readonly Ability[] | null = null;

  constructor(level = 1, displayName?: string) {
    super(PROFILE, level, displayName);
  }

  get influence(): number {
    return this.influenceValue;
  }

  get isTransformed(): boolean {
    return this.form === 'eclipse';
  }

  override get formId(): string {
    return this.form;
  }

  override get formTurns(): number {
    return this.isTransformed ? this.turnsLeft : 0;
  }

  override get specialMeter(): SpecialMeter {
    return { label: 'Influência', value: this.influenceValue, max: INFLUENCE_MAX };
  }

  override get abilities(): readonly Ability[] {
    if (!this.isTransformed) return super.abilities;
    this.bestial ??= this.createBestialAbilities();
    return this.bestial;
  }

  protected override statBonus(stat: ModifiableStat): number {
    return this.isTransformed ? ECLIPSE_BONUS[stat] : 0;
  }

  protected createAbilities(): Ability[] {
    return [
      {
        id: 'shadow-blade',
        name: 'Lâmina Sombria',
        description: `Corte que aplica Sangramento: ${SHADOW_BLEED} de dano no início de cada turno do alvo por 2 turnos.`,
        cost: 25,
        cooldown: 2,
        target: 'enemy',
        tags: ['damage', 'debuff'],
        estimatePower: () => 1.25,
        hints: { targetEffect: bleedEffect(SHADOW_BLEED) },
        execute(ctx, user, target) {
          const hit = ctx.dealDamage(user, target, 1.25, 'ability');
          if (!hit.dodged && !target.isDefeated) ctx.applyEffect(target, bleedEffect(SHADOW_BLEED), user);
        },
      },
      {
        id: 'abyss-mark',
        name: 'Marca do Abismo',
        description: 'Sem causar dano, reduz a defesa do alvo em 25% por 2 turnos.',
        cost: 30,
        cooldown: 3,
        target: 'enemy',
        tags: ['debuff'],
        hints: { targetEffect: EFFECTS.abyssMark },
        execute(ctx, user, target) {
          ctx.applyEffect(target, EFFECTS.abyssMark, user);
        },
      },
      {
        id: 'nyx-veil',
        name: 'Véu Espectral',
        description: `+35 pontos percentuais de esquiva contra o próximo ataque direto, até o fim do próximo turno (máximo de 50%). Se esquivar, ganha ${INFLUENCE_ON_VEIL_DODGE} de influência.`,
        cost: 15,
        cooldown: 3,
        target: 'self',
        tags: ['defensive', 'buff'],
        hints: { selfEffect: EFFECTS.spectralVeil, influenceOnDodge: INFLUENCE_ON_VEIL_DODGE },
        execute(ctx, user) {
          ctx.applyEffect(user, EFFECTS.spectralVeil, user);
        },
      },
      {
        id: ECLIPSE_ID,
        name: 'Eclipse de Vaelith',
        description: `Exige 100 de influência. Vaelith assume o controle por ${ECLIPSE_TURNS} turnos: ${ECLIPSE_TEXT} e habilidades novas. A recarga de ${ECLIPSE_COOLDOWN} turnos começa quando Nyxara retoma o controle.`,
        cost: 0,
        cooldown: ECLIPSE_COOLDOWN,
        deferCooldown: true,
        target: 'self',
        tags: ['ultimate', 'buff'],
        hints: { transformation: true },
        restriction: () => {
          if (this.isTransformed) return this.controlLabel();
          if (this.influenceValue < INFLUENCE_MAX) return `Influência insuficiente: ${this.influenceValue}/${INFLUENCE_MAX}.`;
          return null;
        },
        execute: (ctx) => this.transform(ctx),
      },
    ];
  }

  private createBestialAbilities(): Ability[] {
    const self = this;
    return [
      {
        id: 'shadow-blade',
        name: 'Lâmina Dilacerante',
        description: `Corte que aplica Sangramento de ${RENDING_BLEED} por 2 turnos e cura Nyxara em 15% do dano causado.`,
        cost: 25,
        cooldown: 2,
        target: 'enemy',
        tags: ['damage', 'debuff', 'heal'],
        estimatePower: () => 1.6,
        hints: {
          targetEffect: bleedEffect(RENDING_BLEED),
          selfHeal: (user, target) => expectedDamage(user, target, 1.6, 'ability') * RENDING_HEAL_RATIO,
        },
        execute(ctx, user, target) {
          const hit = ctx.dealDamage(user, target, 1.6, 'ability');
          if (hit.amount > 0) ctx.heal(user, Math.max(1, Math.round(hit.amount * RENDING_HEAL_RATIO)), 'Lâmina Dilacerante');
          if (!hit.dodged && !target.isDefeated) ctx.applyEffect(target, bleedEffect(RENDING_BLEED), user);
        },
      },
      {
        id: 'abyss-mark',
        name: 'Marca Profana',
        description: 'Sem causar dano: defesa do alvo −30% e dano direto recebido +10% por 2 turnos. Substitui a Marca do Abismo.',
        cost: 30,
        cooldown: 3,
        target: 'enemy',
        tags: ['debuff'],
        hints: { targetEffect: EFFECTS.profaneMark },
        execute(ctx, user, target) {
          ctx.applyEffect(target, EFFECTS.profaneMark, user);
        },
      },
      {
        id: 'nyx-veil',
        name: 'Véu do Massacre',
        description: '+35 pontos percentuais de esquiva contra o próximo ataque direto; se ele acertar, Nyxara revida uma vez com força total.',
        cost: 15,
        cooldown: 3,
        target: 'self',
        tags: ['defensive', 'buff'],
        hints: { selfEffect: EFFECTS.massacreVeil },
        execute(ctx, user) {
          ctx.applyEffect(user, EFFECTS.massacreVeil, user);
        },
      },
      {
        id: ECLIPSE_ID,
        get name() {
          return self.controlLabel();
        },
        description: 'Vaelith está no controle. O Eclipse termina sozinho quando os turnos acabam.',
        cost: 0,
        cooldown: ECLIPSE_COOLDOWN,
        deferCooldown: true,
        target: 'self',
        tags: ['ultimate'],
        restriction: () => self.controlLabel(),
        execute() {},
      },
    ];
  }

  private controlLabel(): string {
    const turns = this.turnsLeft;
    return `Vaelith no controle — ${turns} ${turns === 1 ? 'turno' : 'turnos'}`;
  }

  private gainInfluence(ctx: CombatContext, amount: number): void {
    if (this.isTransformed || this.isDefeated || this.influenceValue >= INFLUENCE_MAX || amount <= 0) return;
    this.influenceValue = Math.min(INFLUENCE_MAX, this.influenceValue + amount);
    ctx.meterChanged(this);
    if (this.influenceValue >= INFLUENCE_MAX) {
      ctx.note(`A influência de Vaelith sobre ${this.name} chegou a 100: o Eclipse está pronto.`, 'effect');
    }
  }

  private transform(ctx: CombatContext): void {
    this.form = 'eclipse';
    this.turnsLeft = ECLIPSE_TURNS;
    this.activatedThisTurn = true;
    this.influenceValue = 0;
    ctx.meterChanged(this);
    ctx.formChanged(this, `Vaelith assume o controle de ${this.name}! O Eclipse dura ${ECLIPSE_TURNS} turnos.`);
  }

  private revert(ctx: CombatContext): void {
    this.form = 'base';
    this.turnsLeft = 0;
    this.setCooldown(ECLIPSE_ID, ECLIPSE_COOLDOWN);
    ctx.formChanged(this, `${this.name} retoma o controle. O Eclipse terminou.`);
  }

  override onActionResolved(ctx: CombatContext, summary: TurnSummary): void {
    if (this.isTransformed) return;
    let gain = 0;
    if (summary.directDamage > 0) gain += INFLUENCE_ON_DAMAGE_DEALT;
    if (summary.ability && summary.ability.id !== ECLIPSE_ID) gain += INFLUENCE_ON_SKILL;
    this.gainInfluence(ctx, gain);
  }

  override onDamageTaken(ctx: CombatContext, outcome: DamageOutcome): void {
    if (!isDirectDamage(outcome.kind) || outcome.kind === 'counter' || outcome.amount <= 0) return;
    if (ctx.actionId === this.lastHitActionId) return;
    this.lastHitActionId = ctx.actionId;
    this.gainInfluence(ctx, INFLUENCE_ON_DAMAGE_TAKEN);
  }

  override onEvasionResolved(ctx: CombatContext, effect: ActiveEffect, dodged: boolean): void {
    if (dodged && effect.name === EFFECTS.spectralVeil.name && !this.isTransformed) {
      ctx.note(`${this.name} se desfaz em sombra e Vaelith se fortalece.`, 'effect');
      this.gainInfluence(ctx, INFLUENCE_ON_VEIL_DODGE);
    }
  }

  override onTurnFinished(ctx: CombatContext): void {
    if (!this.isTransformed) return;
    if (this.activatedThisTurn) {
      this.activatedThisTurn = false;
      return;
    }
    this.turnsLeft -= 1;
    if (this.turnsLeft <= 0) this.revert(ctx);
  }

  protected override passiveBadge(): StatusBadge | null {
    if (!this.isTransformed) return null;
    return {
      id: 'form',
      label: 'Eclipse de Vaelith',
      description: `${ECLIPSE_TEXT[0].toUpperCase()}${ECLIPSE_TEXT.slice(1)}. Habilidades da forma demoníaca.`,
      kind: 'buff',
      turns: this.turnsLeft,
    };
  }
}
