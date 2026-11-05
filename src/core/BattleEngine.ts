import { BattleLog } from './BattleLog.ts';
import type { Character } from './Character.ts';
import { computeDamage } from './damage.ts';
import { Inventory, ITEMS } from './items.ts';
import { MathRandom, type RandomSource } from './random.ts';
import {
  isDirectDamage,
  type Ability,
  type ActionResult,
  type ActiveEffect,
  type BattleAction,
  type BattleEvent,
  type BattleEventPayload,
  type CombatContext,
  type CombatStatistics,
  type DamageKind,
  type DamageOptions,
  type DamageOutcome,
  type EffectTemplate,
  type ItemId,
  type LogTone,
  type Side,
} from './types.ts';

export type BattlePhase = 'not-started' | 'awaiting-action' | 'finished';

export interface BattleSetup {
  player: Character;
  enemy: Character;
  random?: RandomSource;
  loadout?: Partial<Record<ItemId, number>>;
}

export interface ActionOption {
  action: BattleAction;
  label: string;
  available: boolean;
  reason?: string;
}

export type ValidationResult = { valid: true } | { valid: false; reason: string };

interface Combatant {
  side: Side;
  character: Character;
  inventory: Inventory;
  stats: CombatStatistics;
}

type TurnStartResult = 'ready' | 'stunned' | 'over';

const NO_DAMAGE = (kind: DamageKind): DamageOutcome => ({
  kind,
  amount: 0,
  critical: false,
  dodged: false,
  guarded: false,
});

function emptyStatistics(): CombatStatistics {
  return {
    damageDealt: 0,
    damageTaken: 0,
    healing: 0,
    biggestHit: 0,
    criticalHits: 0,
    dodges: 0,
    abilitiesUsed: 0,
    itemsUsed: 0,
    actions: 0,
  };
}

export function otherSide(side: Side): Side {
  return side === 'player' ? 'enemy' : 'player';
}

/**
 * Motor de regras do combate por turnos. Não conhece o DOM: recebe ações,
 * valida, resolve e devolve a lista de eventos ocorridos para quem quiser exibi-los.
 */
export class BattleEngine implements CombatContext {
  readonly random: RandomSource;
  readonly log = new BattleLog();

  private readonly combatants: Record<Side, Combatant>;
  private phase: BattlePhase = 'not-started';
  private turnNumber = 0;
  private activeSide: Side = 'player';
  private winnerSide: Side | null = null;
  private pendingEvents: BattleEvent[] = [];
  private dealtDamageThisTurn = false;
  private actionCounter = 0;
  private actionDirectDamage = 0;

  constructor(setup: BattleSetup) {
    if (setup.player === setup.enemy) {
      throw new Error('Os dois lados precisam de instâncias diferentes de personagem.');
    }
    this.random = setup.random ?? new MathRandom();
    this.combatants = {
      player: this.createCombatant('player', setup.player, setup.loadout),
      enemy: this.createCombatant('enemy', setup.enemy, setup.loadout),
    };
  }

  /** O mais rápido começa; em caso de empate, o jogador. */
  static firstSide(player: Character, enemy: Character): Side {
    return player.speed >= enemy.speed ? 'player' : 'enemy';
  }

  /* Leitura de estado ----------------------------------------------- */

  get turn(): number {
    return this.turnNumber;
  }

  get active(): Side {
    return this.activeSide;
  }

  get actionId(): number {
    return this.actionCounter;
  }

  get currentPhase(): BattlePhase {
    return this.phase;
  }

  get isOver(): boolean {
    return this.phase === 'finished';
  }

  get winner(): Side | null {
    return this.winnerSide;
  }

  character(side: Side): Character {
    return this.combatants[side].character;
  }

  inventory(side: Side): Inventory {
    return this.combatants[side].inventory;
  }

  statistics(side: Side): Readonly<CombatStatistics> {
    return this.combatants[side].stats;
  }

  sideOf(character: Character): Side {
    if (this.combatants.player.character === character) return 'player';
    if (this.combatants.enemy.character === character) return 'enemy';
    throw new Error(`${character.name} não participa deste combate.`);
  }

  opponentOf(character: Character): Character {
    return this.character(otherSide(this.sideOf(character)));
  }

  /* Ciclo do combate ------------------------------------------------- */

  start(): BattleEvent[] {
    if (this.phase !== 'not-started') throw new Error('O combate já foi iniciado.');
    const player = this.character('player');
    const enemy = this.character('enemy');
    const first = BattleEngine.firstSide(player, enemy);
    const starter = this.character(first);
    this.emit(
      { type: 'battle-start', first },
      `${player.name} enfrenta ${enemy.name}! ${starter.name} é mais veloz e começa.`,
      'system',
    );
    this.runTurnsFrom(first);
    return this.flush();
  }

  validate(side: Side, action: BattleAction): ValidationResult {
    if (this.phase === 'not-started') return invalid('O combate ainda não começou.');
    if (this.phase === 'finished') return invalid('O combate já terminou.');
    if (side !== this.activeSide) return invalid('Aguarde o seu turno.');

    const actor = this.character(side);
    if (actor.isDefeated) return invalid(`${actor.name} foi derrotado e não pode agir.`);

    switch (action.type) {
      case 'attack':
      case 'defend':
        return { valid: true };
      case 'ability': {
        const ability = actor.getAbility(action.abilityId);
        if (!ability) return invalid('Habilidade desconhecida.');
        const check = actor.checkAbility(ability);
        if (check.usable) return { valid: true };
        if (check.reason === 'restricted') return invalid(check.message);
        if (check.reason === 'cooldown') {
          const turns = actor.getCooldown(ability.id);
          return invalid(`${ability.name} está em recarga por mais ${turns} ${turns === 1 ? 'turno' : 'turnos'}.`);
        }
        if (check.reason === 'energy') {
          return invalid(`${actor.resourceName} insuficiente: ${ability.name} custa ${ability.cost}.`);
        }
        return invalid(`${actor.name} não pode agir.`);
      }
      case 'item': {
        if (!(action.itemId in ITEMS)) return invalid('Item desconhecido.');
        if (!this.inventory(side).has(action.itemId)) return invalid(`Não há mais ${ITEMS[action.itemId].name}.`);
        return { valid: true };
      }
      default:
        return invalid('Ação inválida.');
    }
  }

  availableActions(side: Side): ActionOption[] {
    const actor = this.character(side);
    const candidates: { action: BattleAction; label: string }[] = [
      { action: { type: 'attack' }, label: 'Atacar' },
      ...actor.abilities.map((ability) => ({
        action: { type: 'ability', abilityId: ability.id } as const,
        label: ability.name,
      })),
      { action: { type: 'defend' }, label: 'Defender' },
      ...this.inventory(side)
        .entries()
        .map(({ item }) => ({ action: { type: 'item', itemId: item.id } as const, label: item.name })),
    ];
    return candidates.map((option) => {
      const result = this.validate(side, option.action);
      return result.valid
        ? { ...option, available: true }
        : { ...option, available: false, reason: result.reason };
    });
  }

  perform(side: Side, action: BattleAction): ActionResult {
    const validation = this.validate(side, action);
    if (!validation.valid) return { accepted: false, reason: validation.reason };

    const combatant = this.combatants[side];
    const actor = combatant.character;
    const target = this.opponentOf(actor);
    let usedAbility: Ability | null = null;
    this.actionCounter += 1;
    this.actionDirectDamage = 0;
    this.dealtDamageThisTurn = false;
    combatant.stats.actions += 1;

    switch (action.type) {
      case 'attack':
        this.emit({ type: 'action', side, action, label: 'Ataque básico' }, `${actor.name} ataca!`, 'action');
        this.dealDamage(actor, target, 1, 'basic');
        break;
      case 'defend': {
        actor.startGuard();
        this.emit({ type: 'action', side, action, label: 'Defender' });
        this.emit({ type: 'guard', side }, `${actor.name} assume postura defensiva.`, 'action');
        this.restoreEnergy(actor, actor.defendEnergyGain);
        break;
      }
      case 'ability': {
        const ability = actor.getAbility(action.abilityId);
        if (!ability) break;
        actor.spendEnergy(ability.cost);
        if (ability.cost > 0) this.emitEnergy(actor, -ability.cost);
        combatant.stats.abilitiesUsed += 1;
        usedAbility = ability;
        this.emit({ type: 'action', side, action, label: ability.name }, `${actor.name} usa ${ability.name}!`, 'action');
        ability.execute(this, actor, target);
        break;
      }
      case 'item': {
        const item = ITEMS[action.itemId];
        combatant.inventory.consume(item.id);
        combatant.stats.itemsUsed += 1;
        this.emit({ type: 'action', side, action, label: item.name }, `${actor.name} usa ${item.name}.`, 'action');
        item.use(this, actor);
        break;
      }
    }

    const summary = {
      action,
      ability: usedAbility,
      dealtDamage: this.dealtDamageThisTurn,
      directDamage: this.actionDirectDamage,
    };
    if (!this.isOver) actor.onActionResolved(this, summary);
    if (!this.isOver) this.finishTurnAndContinue(side, summary);
    return { accepted: true, events: this.flush() };
  }

  /* Operações do CombatContext ------------------------------------- */

  dealDamage(
    source: Character,
    target: Character,
    power: number,
    kind: DamageKind,
    options: DamageOptions = {},
  ): DamageOutcome {
    if (this.isOver || source.isDefeated || target.isDefeated) return NO_DAMAGE(kind);
    const isBasic = kind === 'basic';

    // Esquiva ampliada: consumida pelo próximo ataque direto, básico ou habilidade.
    const evasion = isBasic || kind === 'ability' ? target.evasionEffect : undefined;
    if (evasion) this.consumeEffect(target, evasion);

    if (isBasic || evasion) {
      const chance = target.dodgeChanceAgainst(source, evasion?.dodgeBonus ?? 0);
      if (this.random.next() < chance) {
        const outcome: DamageOutcome = { ...NO_DAMAGE(kind), dodged: true };
        this.combatants[this.sideOf(target)].stats.dodges += 1;
        this.emit(
          { type: 'dodge', source: this.sideOf(source), target: this.sideOf(target) },
          `${target.name} esquivou do golpe de ${source.name}!`,
          'miss',
        );
        target.onAttacked(this, source, outcome);
        if (evasion) this.resolveEvasion(target, source, evasion, true);
        return outcome;
      }
    }

    const critical = isBasic && this.random.next() < source.critChance;
    const varianceRoll = isBasic ? this.random.next() : 0.5;
    const guarded = target.isGuarding && isDirectDamage(kind);
    const ignore = Math.min(1, Math.max(0, options.defenseIgnore ?? 0));
    const amount = computeDamage({
      attack: source.attack,
      defense: target.defense * (1 - ignore),
      power,
      varianceRoll,
      critical,
      guarded,
      dealtModifier: source.outgoingDamageModifier(kind),
      takenModifier: target.incomingDamageModifier(kind),
      applyVariance: isBasic,
    });

    // Escudos de próximo golpe são consumidos depois de reduzirem este dano.
    for (const shield of target.effects.filter((effect) => effect.consumeOn === 'direct-damage')) {
      this.consumeEffect(target, shield);
    }

    const outcome = this.inflict(source, target, amount, kind, critical, guarded);
    if (evasion) this.resolveEvasion(target, source, evasion, false);
    return outcome;
  }

  heal(target: Character, amount: number, reason?: string): number {
    if (this.isOver) return 0;
    const healed = target.heal(amount);
    if (healed <= 0) return 0;
    const side = this.sideOf(target);
    this.combatants[side].stats.healing += healed;
    const suffix = reason ? ` (${reason})` : '';
    this.emit(
      { type: 'heal', target: side, amount: healed, hpAfter: target.hp },
      `${target.name} recupera ${healed} de vida${suffix}.`,
      'heal',
    );
    return healed;
  }

  restoreEnergy(target: Character, amount: number, reason?: string): number {
    if (this.isOver) return 0;
    const restored = target.restoreEnergy(amount);
    if (restored <= 0) return 0;
    const text = reason
      ? `${target.name} recupera ${restored} de ${target.resourceName.toLowerCase()} (${reason}).`
      : undefined;
    this.emitEnergy(target, restored, text);
    return restored;
  }

  applyEffect(target: Character, template: EffectTemplate, source: Character): void {
    if (this.isOver || target.isDefeated) return;
    const targetSide = this.sideOf(target);
    target.addEffect(template, source, targetSide === this.activeSide);
    const turns = `${template.duration} ${template.duration === 1 ? 'turno' : 'turnos'}`;
    const text =
      template.kind === 'buff'
        ? `${target.name} ganha ${template.name} por ${turns}.`
        : `${target.name} sofre ${template.name} por ${turns}.`;
    this.emit(
      {
        type: 'effect-applied',
        target: targetSide,
        effectId: template.id,
        name: template.name,
        kind: template.kind,
        duration: template.duration,
      },
      text,
      'effect',
    );
  }

  removeEffects(target: Character, filter: (effect: ActiveEffect) => boolean, limit = Infinity): string[] {
    if (this.isOver || target.isDefeated) return [];
    const names = target.removeEffectsWhere(filter, limit).map((effect) => effect.name);
    if (names.length > 0) {
      this.emit({ type: 'dispel', target: this.sideOf(target), names }, `${target.name} perde ${names.join(', ')}.`, 'effect');
    }
    return names;
  }

  meterChanged(target: Character): void {
    const meter = target.specialMeter;
    if (!meter) return;
    this.emit({ type: 'meter', target: this.sideOf(target), value: meter.value, max: meter.max });
  }

  formChanged(target: Character, message: string): void {
    this.emit(
      { type: 'form-change', target: this.sideOf(target), form: target.formId, turns: target.formTurns },
      message,
      'effect',
    );
  }

  note(message: string, tone: LogTone = 'system'): void {
    this.emit({ type: 'note' }, message, tone);
  }

  /* Internos --------------------------------------------------------- */

  private createCombatant(
    side: Side,
    character: Character,
    loadout?: Partial<Record<ItemId, number>>,
  ): Combatant {
    return { side, character, inventory: new Inventory(loadout), stats: emptyStatistics() };
  }

  /** Reações ao fim de uma esquiva ampliada: passivas e revides definidos pelo efeito. */
  private resolveEvasion(holder: Character, attacker: Character, effect: ActiveEffect, dodged: boolean): void {
    if (this.isOver || holder.isDefeated) return;
    holder.onEvasionResolved(this, effect, dodged);
    const power = dodged ? effect.counterOnDodge : effect.counterPower;
    if (!power || this.isOver || holder.isDefeated || attacker.isDefeated) return;
    this.note(`${holder.name} revida o golpe!`, 'action');
    this.dealDamage(holder, attacker, power, 'counter');
  }

  private consumeEffect(holder: Character, effect: ActiveEffect): void {
    holder.removeEffect(effect.id);
    this.emit(
      { type: 'effect-expired', target: this.sideOf(holder), effectId: effect.id, name: effect.name, consumed: true },
      `${effect.name} de ${holder.name} foi consumido.`,
      'effect',
    );
  }

  private inflict(
    source: Character,
    target: Character,
    rawAmount: number,
    kind: DamageKind,
    critical: boolean,
    guarded: boolean,
    label?: string,
  ): DamageOutcome {
    const amount = target.takeDamage(rawAmount);
    const outcome: DamageOutcome = { kind, amount, critical, dodged: false, guarded };
    const sourceSide = this.sideOf(source);
    const targetSide = this.sideOf(target);
    const sourceStats = this.combatants[sourceSide].stats;

    sourceStats.damageDealt += amount;
    sourceStats.biggestHit = Math.max(sourceStats.biggestHit, amount);
    if (critical) sourceStats.criticalHits += 1;
    this.combatants[targetSide].stats.damageTaken += amount;
    if (sourceSide === this.activeSide && amount > 0) {
      this.dealtDamageThisTurn = true;
      if (isDirectDamage(kind) && kind !== 'counter') this.actionDirectDamage += amount;
    }

    this.emit(
      { type: 'damage', source: sourceSide, target: targetSide, amount, kind, critical, guarded, hpAfter: target.hp },
      describeDamage(source, target, outcome, label),
      critical ? 'critical' : 'damage',
    );

    source.onDamageDealt(this, outcome, target);
    target.onDamageTaken(this, outcome, source);
    if (critical) source.onCriticalHit(this, target);

    if (target.isDefeated) {
      this.finish(sourceSide);
      return outcome;
    }
    if (isDirectDamage(kind)) target.onAttacked(this, source, outcome);
    return outcome;
  }

  private finish(winner: Side): void {
    if (this.isOver) return;
    this.phase = 'finished';
    this.winnerSide = winner;
    const loserSide = otherSide(winner);
    this.emit({ type: 'defeated', side: loserSide }, `${this.character(loserSide).name} foi derrotado!`, 'victory');
    this.emit({ type: 'battle-end', winner }, `Vitória de ${this.character(winner).name}!`, 'victory');
  }

  /** Encerra o turno atual e inicia os seguintes, pulando turnos de personagens atordoados. */
  private finishTurnAndContinue(side: Side, summary: TurnSummaryInput): void {
    let currentSide = side;
    let currentSummary = summary;

    for (;;) {
      this.endTurn(currentSide, currentSummary);
      if (this.isOver) return;
      const next = otherSide(currentSide);
      const result = this.beginTurn(next);
      if (result !== 'stunned') return;
      currentSide = next;
      currentSummary = { action: null, ability: null, dealtDamage: false, directDamage: 0 };
    }
  }

  private runTurnsFrom(side: Side): void {
    const result = this.beginTurn(side);
    if (result === 'stunned') {
      this.finishTurnAndContinue(side, { action: null, ability: null, dealtDamage: false, directDamage: 0 });
    }
  }

  /**
   * Início do turno, nesta ordem: a guarda termina, o dano periódico e as convocações
   * agem, as passivas de início de turno reagem, a energia é recuperada e, por fim,
   * personagens atordoados perdem a vez.
   */
  private beginTurn(side: Side): TurnStartResult {
    this.turnNumber += 1;
    this.activeSide = side;
    this.dealtDamageThisTurn = false;
    const actor = this.character(side);
    const opponent = this.character(otherSide(side));
    this.emit({ type: 'turn-start', turn: this.turnNumber, side }, `Turno ${this.turnNumber}: vez de ${actor.name}.`, 'turn');

    actor.endGuard();

    for (const effect of [...actor.effects]) {
      if (!effect.periodicDamage) continue;
      this.inflict(effect.source, actor, effect.periodicDamage, 'periodic', false, false, effect.name);
      if (this.isOver) return 'over';
    }

    for (const effect of [...actor.effects]) {
      if (!effect.turretDamage) continue;
      this.inflict(actor, opponent, effect.turretDamage, 'turret', false, false, effect.name);
      if (this.isOver) return 'over';
    }

    actor.onTurnStart(this);
    if (this.isOver) return 'over';

    if (actor.energyRegen > 0) this.restoreEnergy(actor, actor.energyRegen);

    if (actor.isStunned) {
      this.emit({ type: 'stunned', side }, `${actor.name} está atordoado e perde o turno.`, 'effect');
      return 'stunned';
    }

    this.phase = 'awaiting-action';
    return 'ready';
  }

  /**
   * Fim do turno, nesta ordem: passivas de fim de turno, recargas, recarga da habilidade
   * usada, duração dos efeitos do personagem e, por último, efeitos de forma.
   */
  private endTurn(side: Side, summary: TurnSummaryInput): void {
    const actor = this.character(side);
    actor.onTurnEnd(this, summary);
    actor.advanceCooldowns();
    if (summary.ability && !summary.ability.deferCooldown) actor.startCooldown(summary.ability);

    for (const effect of actor.tickEffects()) {
      this.emit(
        { type: 'effect-expired', target: side, effectId: effect.id, name: effect.name, consumed: false },
        `${effect.name} de ${actor.name} terminou.`,
        'effect',
      );
    }
    actor.onTurnFinished(this);
  }

  private emitEnergy(target: Character, amount: number, text?: string): void {
    this.emit(
      { type: 'energy', target: this.sideOf(target), amount, energyAfter: target.energy },
      text,
      'effect',
    );
  }

  private emit(payload: BattleEventPayload, text?: string, tone: LogTone = 'system'): void {
    const event: BattleEvent = { ...payload };
    if (text) event.logId = this.log.add(text, tone, this.turnNumber).id;
    this.pendingEvents.push(event);
  }

  private flush(): BattleEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }
}

type TurnSummaryInput = { action: BattleAction | null; ability: Ability | null; dealtDamage: boolean; directDamage: number };

function invalid(reason: string): ValidationResult {
  return { valid: false, reason };
}

function describeDamage(source: Character, target: Character, outcome: DamageOutcome, label?: string): string {
  const amount = outcome.amount;
  switch (outcome.kind) {
    case 'periodic':
      return `${target.name} sofre ${amount} de dano (${label ?? 'dano contínuo'}).`;
    case 'turret':
      return `${label ?? 'Convocação'} de ${source.name} causa ${amount} de dano em ${target.name}.`;
    case 'counter':
      return `${source.name} revida e causa ${amount} de dano em ${target.name}.`;
    default: {
      const prefix = outcome.critical ? 'Acerto crítico! ' : '';
      const suffix = outcome.guarded ? ' (reduzido pela guarda)' : '';
      return `${prefix}${target.name} recebe ${amount} de dano${suffix}.`;
    }
  }
}
