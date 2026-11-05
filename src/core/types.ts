import type { Character } from './Character.ts';
import type { RandomSource } from './random.ts';

export type CharacterId = 'lyra' | 'vexra' | 'dravenor' | 'kael' | 'nyxara' | 'vorath';
export type Side = 'player' | 'enemy';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface BaseStats {
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  maxEnergy: number;
}

export type ModifiableStat = 'attack' | 'defense' | 'speed';

export interface CharacterProfile {
  id: CharacterId;
  name: string;
  role: string;
  /** História curta exibida na seleção. */
  description: string;
  playstyle: string;
  focus: string;
  weakness: string;
  /** Complexidade de uso, de 1 a 5. */
  complexity: number;
  resourceName: string;
  baseStats: BaseStats;
  startingEnergy: number;
  energyRegen: number;
  defendEnergyGain: number;
  passive: { name: string; description: string };
}

/* Efeitos ----------------------------------------------------------------- */

export interface EffectTemplate {
  id: string;
  name: string;
  description: string;
  kind: 'buff' | 'debuff';
  /**
   * Duração em turnos próprios de quem recebe o efeito. A contagem avança no fim de
   * cada turno do portador; o turno em que o efeito foi criado não conta.
   */
  duration: number;
  statModifiers?: Partial<Record<ModifiableStat, number>>;
  damageDealtModifier?: number;
  /** Modificador do dano direto recebido (negativo reduz). */
  damageTakenModifier?: number;
  /** Dano fixo no início de cada turno do portador. Ignora defesa e guarda. */
  periodicDamage?: number;
  /** Dano fixo causado ao oponente no início de cada turno do portador (convocações). */
  turretDamage?: number;
  /** Pontos percentuais de esquiva somados contra o próximo ataque direto. */
  dodgeBonus?: number;
  /** Revide automático, com este poder, se o ataque que consumiu o efeito não for esquivado. */
  counterPower?: number;
  /** Revide automático, com este poder, se o ataque que consumiu o efeito for esquivado. */
  counterOnDodge?: number;
  /** O efeito some ao ser usado: no próximo ataque direto recebido ou no próximo dano direto sofrido. */
  consumeOn?: 'direct-attack' | 'direct-damage';
  stun?: boolean;
}

export interface ActiveEffect extends EffectTemplate {
  remaining: number;
  source: Character;
  /** Verdadeiro quando criado no turno do próprio portador; esse turno não conta na duração. */
  fresh: boolean;
}

/* Habilidades e itens ----------------------------------------------------- */

export type AbilityTag = 'damage' | 'heal' | 'buff' | 'debuff' | 'control' | 'finisher' | 'defensive' | 'summon' | 'ultimate';

/** Informações que a IA usa para avaliar efeitos secundários sem conhecer cada habilidade. */
export interface AbilityHints {
  targetEffect?: EffectTemplate;
  selfEffect?: EffectTemplate;
  /** Cura esperada para quem usa a habilidade. */
  selfHeal?(user: Character, target: Character): number;
  stunChance?: number;
  removesDefenseBuff?: boolean;
  transformation?: boolean;
  /** Influência ganha se a esquiva concedida pela habilidade funcionar. */
  influenceOnDodge?: number;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  cost: number;
  cooldown: number;
  target: 'enemy' | 'self';
  tags: readonly AbilityTag[];
  /** Fração da defesa do alvo ignorada pelo golpe principal. */
  defenseIgnore?: number;
  /** A recarga não começa no uso: o personagem a inicia depois (ex.: fim da transformação). */
  deferCooldown?: boolean;
  /** Restrição própria da habilidade. Devolve o motivo do bloqueio ou null. */
  restriction?(user: Character): string | null;
  /** Multiplicador de dano direto total esperado, usado pela IA e pela interface. */
  estimatePower?(user: Character, target: Character): number;
  hints?: AbilityHints;
  execute(ctx: CombatContext, user: Character, target: Character): void;
}

export type ItemId = 'health-potion' | 'energy-elixir' | 'strength-tonic';

export interface ItemDefinition {
  id: ItemId;
  name: string;
  description: string;
  use(ctx: CombatContext, user: Character): void;
}

/* Ações e resultados ------------------------------------------------------ */

export type BattleAction =
  | { type: 'attack' }
  | { type: 'defend' }
  | { type: 'ability'; abilityId: string }
  | { type: 'item'; itemId: ItemId };

export type ActionResult =
  | { accepted: true; events: BattleEvent[] }
  | { accepted: false; reason: string };

/** basic, ability e counter são dano direto; periodic e turret são dano fixo. */
export type DamageKind = 'basic' | 'ability' | 'periodic' | 'counter' | 'turret';

export function isDirectDamage(kind: DamageKind): boolean {
  return kind === 'basic' || kind === 'ability' || kind === 'counter';
}

export interface DamageOptions {
  /** Fração da defesa efetiva ignorada neste golpe (0 a 1). */
  defenseIgnore?: number;
}

export interface DamageOutcome {
  kind: DamageKind;
  amount: number;
  critical: boolean;
  dodged: boolean;
  guarded: boolean;
}

export type BattleEventPayload =
  | { type: 'battle-start'; first: Side }
  | { type: 'turn-start'; turn: number; side: Side }
  | { type: 'action'; side: Side; action: BattleAction; label: string }
  | {
      type: 'damage';
      source: Side;
      target: Side;
      amount: number;
      kind: DamageKind;
      critical: boolean;
      guarded: boolean;
      hpAfter: number;
    }
  | { type: 'dodge'; source: Side; target: Side }
  | { type: 'heal'; target: Side; amount: number; hpAfter: number }
  | { type: 'energy'; target: Side; amount: number; energyAfter: number }
  | { type: 'effect-applied'; target: Side; effectId: string; name: string; kind: 'buff' | 'debuff'; duration: number }
  | { type: 'effect-expired'; target: Side; effectId: string; name: string; consumed: boolean }
  | { type: 'dispel'; target: Side; names: string[] }
  | { type: 'meter'; target: Side; value: number; max: number }
  | { type: 'form-change'; target: Side; form: string; turns: number }
  | { type: 'guard'; side: Side }
  | { type: 'stunned'; side: Side }
  | { type: 'defeated'; side: Side }
  | { type: 'battle-end'; winner: Side }
  | { type: 'note' };

export type BattleEvent = BattleEventPayload & { logId?: number };

export type LogTone =
  | 'system'
  | 'turn'
  | 'action'
  | 'damage'
  | 'critical'
  | 'heal'
  | 'effect'
  | 'miss'
  | 'victory';

/** Operações que habilidades, itens e passivas podem realizar durante o combate. */
export interface CombatContext {
  readonly random: RandomSource;
  /** Identificador da ação em andamento; muda a cada ação aceita pelo motor. */
  readonly actionId: number;
  opponentOf(character: Character): Character;
  dealDamage(source: Character, target: Character, power: number, kind: DamageKind, options?: DamageOptions): DamageOutcome;
  heal(target: Character, amount: number, reason?: string): number;
  restoreEnergy(target: Character, amount: number, reason?: string): number;
  applyEffect(target: Character, template: EffectTemplate, source: Character): void;
  /** Remove efeitos do alvo que atendem ao filtro (até `limit`) e registra a remoção. */
  removeEffects(target: Character, filter: (effect: ActiveEffect) => boolean, limit?: number): string[];
  /** Avisa a interface e o histórico de que um medidor especial mudou. */
  meterChanged(target: Character): void;
  /** Avisa a interface e o histórico de que o personagem mudou de forma. */
  formChanged(target: Character, message: string): void;
  note(message: string, tone?: LogTone): void;
}

/** Resumo de uma ação concluída, entregue aos personagens. */
export interface TurnSummary {
  action: BattleAction | null;
  ability: Ability | null;
  dealtDamage: boolean;
  /** Dano direto efetivo causado pelo personagem durante a ação. */
  directDamage: number;
}

export interface CombatStatistics {
  damageDealt: number;
  damageTaken: number;
  healing: number;
  biggestHit: number;
  criticalHits: number;
  dodges: number;
  abilitiesUsed: number;
  itemsUsed: number;
  actions: number;
}
