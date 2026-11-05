import { COMBAT_RULES, clamp, dodgeChance } from './damage.ts';
import {
  isDirectDamage,
  type Ability,
  type ActiveEffect,
  type BaseStats,
  type CharacterId,
  type CharacterProfile,
  type CombatContext,
  type DamageKind,
  type DamageOutcome,
  type EffectTemplate,
  type ModifiableStat,
  type TurnSummary,
} from './types.ts';

export const MAX_LEVEL = 10;

/** Energia igual para todo o elenco: começa cheia, recupera por turno e ao defender. */
export const ENERGY_RULES = {
  max: 100,
  starting: 100,
  regen: 12,
  defendGain: 15,
} as const;

/** Crescimento por nível acima do 1: moderado para não desequilibrar o combate. */
const GROWTH_PER_LEVEL = { maxHp: 0.06, attack: 0.05, defense: 0.05 } as const;

export function scaleStats(base: BaseStats, level: number): BaseStats {
  const steps = clamp(Math.floor(level), 1, MAX_LEVEL) - 1;
  return {
    maxHp: Math.round(base.maxHp * (1 + GROWTH_PER_LEVEL.maxHp * steps)),
    attack: Math.round(base.attack * (1 + GROWTH_PER_LEVEL.attack * steps)),
    defense: Math.round(base.defense * (1 + GROWTH_PER_LEVEL.defense * steps)),
    speed: base.speed,
    maxEnergy: base.maxEnergy,
  };
}

export type AbilityAvailability =
  | { usable: true }
  | { usable: false; reason: 'cooldown' | 'energy' | 'defeated' }
  | { usable: false; reason: 'restricted'; message: string };

export interface StatusBadge {
  id: string;
  label: string;
  description: string;
  kind: 'buff' | 'debuff' | 'neutral';
  turns?: number;
}

/** Medidor exibido além de vida e energia (ex.: influência da Nyxara). */
export interface SpecialMeter {
  label: string;
  value: number;
  max: number;
}

let instanceCounter = 0;

/**
 * Base de todos os personagens. Concentra vida, energia, recargas e efeitos;
 * as subclasses definem habilidades e sobrescrevem os ganchos de combate
 * quando têm uma passiva com comportamento próprio.
 */
export abstract class Character {
  readonly uid: string;
  readonly id: CharacterId;
  readonly name: string;
  readonly role: string;
  readonly description: string;
  readonly playstyle: string;
  readonly focus: string;
  readonly weakness: string;
  readonly complexity: number;
  readonly resourceName: string;
  readonly passive: { name: string; description: string };
  readonly level: number;
  readonly stats: BaseStats;

  private readonly profile: CharacterProfile;
  private currentHp: number;
  private currentEnergy: number;
  private guarding = false;
  private readonly cooldowns = new Map<string, number>();
  private activeEffects: ActiveEffect[] = [];
  private abilityList: readonly Ability[] | null = null;

  protected constructor(profile: CharacterProfile, level = 1, displayName?: string) {
    instanceCounter += 1;
    this.uid = `${profile.id}-${instanceCounter}`;
    this.profile = profile;
    this.id = profile.id;
    this.name = displayName ?? profile.name;
    this.role = profile.role;
    this.description = profile.description;
    this.playstyle = profile.playstyle;
    this.focus = profile.focus;
    this.weakness = profile.weakness;
    this.complexity = profile.complexity;
    this.resourceName = profile.resourceName;
    this.passive = profile.passive;
    this.level = clamp(Math.floor(level), 1, MAX_LEVEL);
    this.stats = scaleStats(profile.baseStats, this.level);
    this.currentHp = this.stats.maxHp;
    this.currentEnergy = clamp(profile.startingEnergy, 0, this.stats.maxEnergy);
  }

  /** Cada personagem declara suas habilidades exclusivas. */
  protected abstract createAbilities(): Ability[];

  get abilities(): readonly Ability[] {
    this.abilityList ??= this.createAbilities();
    return this.abilityList;
  }

  /** Forma atual do personagem. Personagens sem transformação ficam sempre em 'base'. */
  get formId(): string {
    return 'base';
  }

  /** Turnos restantes da forma atual (0 quando não há transformação ativa). */
  get formTurns(): number {
    return 0;
  }

  get specialMeter(): SpecialMeter | null {
    return null;
  }

  /* Recursos ------------------------------------------------------------- */

  get hp(): number {
    return this.currentHp;
  }

  get maxHp(): number {
    return this.stats.maxHp;
  }

  get energy(): number {
    return this.currentEnergy;
  }

  get maxEnergy(): number {
    return this.stats.maxEnergy;
  }

  get hpRatio(): number {
    return this.currentHp / this.stats.maxHp;
  }

  get isDefeated(): boolean {
    return this.currentHp <= 0;
  }

  /** Aplica dano já calculado. A vida nunca fica negativa. Retorna o dano efetivo. */
  takeDamage(amount: number): number {
    const value = Math.max(0, Math.round(amount));
    const applied = Math.min(value, this.currentHp);
    this.currentHp -= applied;
    return applied;
  }

  /** Cura sem ultrapassar a vida máxima. Personagens derrotados não são curados. */
  heal(amount: number): number {
    if (this.isDefeated) return 0;
    const value = Math.max(0, Math.round(amount));
    const applied = Math.min(value, this.stats.maxHp - this.currentHp);
    this.currentHp += applied;
    return applied;
  }

  restoreEnergy(amount: number): number {
    const value = Math.max(0, Math.round(amount));
    const applied = Math.min(value, this.stats.maxEnergy - this.currentEnergy);
    this.currentEnergy += applied;
    return applied;
  }

  spendEnergy(amount: number): boolean {
    if (amount > this.currentEnergy) return false;
    this.currentEnergy -= amount;
    return true;
  }

  get energyRegen(): number {
    return this.profile.energyRegen;
  }

  get defendEnergyGain(): number {
    return this.profile.defendEnergyGain;
  }

  /* Atributos com modificadores ---------------------------------------- */

  get attack(): number {
    return Math.round(this.stats.attack * this.statMultiplier('attack'));
  }

  get defense(): number {
    return Math.round(this.stats.defense * this.statMultiplier('defense'));
  }

  get speed(): number {
    return Math.round(this.stats.speed * this.statMultiplier('speed'));
  }

  get critChance(): number {
    return COMBAT_RULES.baseCritChance;
  }

  /** Modificador do dano causado. Passivas podem acrescentar bônus por tipo de golpe. */
  outgoingDamageModifier(_kind: DamageKind): number {
    return this.activeEffects.reduce((sum, effect) => sum + (effect.damageDealtModifier ?? 0), 0);
  }

  /** Modificador do dano direto recebido (o teto de redução é aplicado no cálculo). */
  incomingDamageModifier(kind: DamageKind): number {
    if (!isDirectDamage(kind)) return 0;
    return this.activeEffects.reduce((sum, effect) => sum + (effect.damageTakenModifier ?? 0), 0);
  }

  /** Bônus permanentes de forma ou passiva somados aos modificadores dos efeitos. */
  protected statBonus(_stat: ModifiableStat): number {
    return 0;
  }

  protected statMultiplier(stat: ModifiableStat): number {
    const fromEffects = this.activeEffects.reduce((sum, effect) => sum + (effect.statModifiers?.[stat] ?? 0), 0);
    return Math.max(COMBAT_RULES.minStatMultiplier, 1 + fromEffects + this.statBonus(stat));
  }

  /** Chance de esquivar um golpe do atacante, com bônus temporário opcional. */
  dodgeChanceAgainst(attacker: Character, bonus = 0): number {
    return dodgeChance(attacker.speed, this.speed, bonus);
  }

  /** Efeito de esquiva ampliada que será consumido pelo próximo ataque direto. */
  get evasionEffect(): ActiveEffect | undefined {
    return this.activeEffects.find((effect) => effect.consumeOn === 'direct-attack' && (effect.dodgeBonus ?? 0) > 0);
  }

  /* Defesa (ação Defender) ------------------------------------------- */

  get isGuarding(): boolean {
    return this.guarding;
  }

  startGuard(): void {
    this.guarding = true;
  }

  endGuard(): void {
    this.guarding = false;
  }

  /* Habilidades e recargas ------------------------------------------ */

  getAbility(abilityId: string): Ability | undefined {
    return this.abilities.find((ability) => ability.id === abilityId);
  }

  getCooldown(abilityId: string): number {
    return this.cooldowns.get(abilityId) ?? 0;
  }

  checkAbility(ability: Ability): AbilityAvailability {
    if (this.isDefeated) return { usable: false, reason: 'defeated' };
    const restriction = ability.restriction?.(this) ?? null;
    if (restriction) return { usable: false, reason: 'restricted', message: restriction };
    if (this.getCooldown(ability.id) > 0) return { usable: false, reason: 'cooldown' };
    if (this.currentEnergy < ability.cost) return { usable: false, reason: 'energy' };
    return { usable: true };
  }

  /** Chamado no fim de cada turno do personagem. */
  advanceCooldowns(): void {
    for (const [abilityId, remaining] of this.cooldowns) {
      if (remaining > 0) this.cooldowns.set(abilityId, remaining - 1);
    }
  }

  /** A habilidade fica indisponível pelos próximos `cooldown` turnos do personagem. */
  startCooldown(ability: Ability): void {
    this.setCooldown(ability.id, ability.cooldown);
  }

  protected setCooldown(abilityId: string, turns: number): void {
    if (turns > 0) this.cooldowns.set(abilityId, turns);
  }

  /* Efeitos --------------------------------------------------------- */

  get effects(): readonly ActiveEffect[] {
    return this.activeEffects;
  }

  hasEffect(effectId: string): boolean {
    return this.activeEffects.some((effect) => effect.id === effectId);
  }

  getEffect(effectId: string): ActiveEffect | undefined {
    return this.activeEffects.find((effect) => effect.id === effectId);
  }

  get isStunned(): boolean {
    return this.activeEffects.some((effect) => effect.stun === true);
  }

  /**
   * Aplica um efeito. Reaplicar o mesmo id substitui os valores e renova a duração,
   * sem acumular. `ownTurn` indica se o portador está no próprio turno.
   */
  addEffect(template: EffectTemplate, source: Character, ownTurn = false): ActiveEffect {
    const effect: ActiveEffect = { ...template, remaining: template.duration, source, fresh: ownTurn };
    const index = this.activeEffects.findIndex((existing) => existing.id === template.id);
    if (index >= 0) this.activeEffects[index] = effect;
    else this.activeEffects.push(effect);
    return effect;
  }

  removeEffect(effectId: string): void {
    this.activeEffects = this.activeEffects.filter((effect) => effect.id !== effectId);
  }

  /** Remove efeitos que atendem ao filtro, até o limite informado. Devolve os removidos. */
  removeEffectsWhere(filter: (effect: ActiveEffect) => boolean, limit = Infinity): ActiveEffect[] {
    const removed: ActiveEffect[] = [];
    this.activeEffects = this.activeEffects.filter((effect) => {
      if (removed.length < limit && filter(effect)) {
        removed.push(effect);
        return false;
      }
      return true;
    });
    return removed;
  }

  /** Remove todos os bônus ativos e devolve os nomes removidos. */
  dispelBuffs(): string[] {
    return this.removeEffectsWhere((effect) => effect.kind === 'buff').map((effect) => effect.name);
  }

  /**
   * Avança a duração dos efeitos do próprio personagem. É chamado no fim de cada turno
   * dele; efeitos criados neste mesmo turno só começam a contar no próximo.
   */
  tickEffects(): ActiveEffect[] {
    const expired: ActiveEffect[] = [];
    for (const effect of this.activeEffects) {
      if (effect.fresh) {
        effect.fresh = false;
        continue;
      }
      effect.remaining -= 1;
      if (effect.remaining <= 0) expired.push(effect);
    }
    if (expired.length > 0) {
      this.activeEffects = this.activeEffects.filter((effect) => !expired.includes(effect));
    }
    return expired;
  }

  /** Estado visível do personagem: efeitos, guarda e passivas com acúmulos. */
  get badges(): StatusBadge[] {
    const badges: StatusBadge[] = this.activeEffects.map((effect) => ({
      id: effect.id,
      label: effect.name,
      description: effect.description,
      kind: effect.kind,
      turns: effect.remaining,
    }));
    if (this.guarding) {
      badges.unshift({
        id: 'guard',
        label: 'Em guarda',
        description: 'Recebe 50% menos dano na próxima ação inimiga.',
        kind: 'buff',
      });
    }
    const passive = this.passiveBadge();
    if (passive) badges.push(passive);
    return badges;
  }

  protected passiveBadge(): StatusBadge | null {
    return null;
  }

  /* Ganchos de combate (sobrescritos pelas passivas) ----------------- */

  /** Início do turno, depois do dano periódico e antes da energia e do atordoamento. */
  onTurnStart(_ctx: CombatContext): void {}

  /** Depois que a ação do personagem foi resolvida, antes do fim do turno. */
  onActionResolved(_ctx: CombatContext, _summary: TurnSummary): void {}

  onDamageDealt(_ctx: CombatContext, _outcome: DamageOutcome, _target: Character): void {}

  onDamageTaken(_ctx: CombatContext, _outcome: DamageOutcome, _source: Character): void {}

  onCriticalHit(_ctx: CombatContext, _target: Character): void {}

  /** Chamado quando este personagem é alvo de um golpe direto, mesmo que esquive. */
  onAttacked(_ctx: CombatContext, _attacker: Character, _outcome: DamageOutcome): void {}

  /** Chamado quando um efeito de esquiva ampliada é consumido, com o resultado da esquiva. */
  onEvasionResolved(_ctx: CombatContext, _effect: ActiveEffect, _dodged: boolean): void {}

  /** Fim do turno, antes de recargas e efeitos avançarem. */
  onTurnEnd(_ctx: CombatContext, _summary: TurnSummary): void {}

  /** Último passo do turno, depois de recargas e efeitos avançarem. */
  onTurnFinished(_ctx: CombatContext): void {}
}
