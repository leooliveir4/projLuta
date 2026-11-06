import type { BattleEvent, Side } from '../../core/types.ts';
import type { AudioSink } from '../AudioManager.ts';
import {
  abilityCue,
  CLIPS,
  FORM_CHANGE_ABILITIES,
  FORM_CLIPS,
  GENERIC_IMPACT,
  IMPACT_GAIN_DB,
  TURRET_SHOT_CUE,
  type SoundCue,
} from './soundCatalog.ts';

/** Quanto falta, a partir de agora, para o disparo e para o contato com o alvo (ms). */
export interface MoveTiming {
  launchMs: number;
  impactMs: number;
}

export const NO_DELAY: MoveTiming = { launchMs: 0, impactMs: 0 };

/**
 * Folga (ms) somada ao instante previsto do golpe. A animação acumula pequenos atrasos de
 * quadro; com a folga, o som marca o instante e a animação espera por ele (alguns quadros,
 * no máximo), em vez de o som chegar antes do golpe.
 */
export const SYNC_SLACK_MS = 110;

/** Instante (relógio `performance.now()`, ms) em que um acontecimento visual deve ocorrer para coincidir com o som. */
export interface SyncPoint {
  /** `launch`: disparo, golpe no chão; `impact`: contato com o alvo; `flash`: clarão da transformação. */
  moment: 'launch' | 'impact' | 'flash';
  at: number;
}

/** O que a ação vai causar, lido nos eventos seguintes (o motor já resolveu tudo). */
export interface ActionOutcome {
  /** Danos diretos causados pela ação (básico ou habilidade). */
  hits: number;
  /** O alvo esquivou. */
  dodged: boolean;
}

type DamageEvent = Extract<BattleEvent, { type: 'damage' }>;
type DodgeEvent = Extract<BattleEvent, { type: 'dodge' }>;

/** Golpes com preparação longa: numa esquiva, a preparação ainda soa, mas o impacto não. */
const MIN_BUILD_UP_ON_MISS = 0.2;

/**
 * Resultado da ação no índice informado: percorre os eventos até a próxima ação ou turno.
 * Só lê dados que o motor já produziu; não muda nada no combate.
 */
export function actionOutcome(events: readonly BattleEvent[], index: number): ActionOutcome {
  const action = events[index];
  const outcome: ActionOutcome = { hits: 0, dodged: false };
  if (!action || action.type !== 'action') return outcome;
  for (let i = index + 1; i < events.length; i += 1) {
    const event = events[i];
    if (event.type === 'action' || event.type === 'turn-start' || event.type === 'battle-end') break;
    if (event.type === 'damage' && event.source === action.side && (event.kind === 'basic' || event.kind === 'ability')) outcome.hits += 1;
    if (event.type === 'dodge' && event.source === action.side) outcome.dodged = true;
  }
  return outcome;
}

/**
 * Decide o som de cada momento da luta: qual arquivo, quando e com que alinhamento.
 *
 * Regras:
 * - habilidade com som próprio: o arquivo toca alinhado ao disparo ou ao impacto, e o
 *   impacto genérico não toca por cima;
 * - habilidade sem som próprio e ataque básico: som sintetizado na ação e impacto genérico;
 * - esquiva: nenhum impacto confirmado (sons de impacto param antes do golpe);
 * - torre: um tiro por dano `turret` registrado pelo motor;
 * - Eclipse: um único som, na troca de forma, alinhado ao clarão.
 *
 * A forma considerada é a forma ativa no ponto da luta que está sendo mostrado, acompanhada
 * pelos eventos `form-change`, e não a imagem exibida.
 */
export class BattleSound {
  private readonly sink: AudioSink;
  private readonly forms: Record<Side, string>;
  private readonly formClipPlayed: Record<Side, boolean> = { player: false, enemy: false };
  /** Ação em curso: quem age, o som dela e quantos danos dela já foram mostrados. */
  private acting: { side: Side; cue: SoundCue | null; hits: number } | null = null;

  constructor(sink: AudioSink, forms: Record<Side, string> = { player: 'base', enemy: 'base' }) {
    this.sink = sink;
    this.forms = { ...forms };
  }

  /** Forma ativa de cada lado, do ponto de vista do som. */
  formOf(side: Side): string {
    return this.forms[side];
  }

  /** Ataque básico, habilidade ou item: chamado quando a ação começa a ser mostrada. */
  action(
    side: Side,
    action: { type: 'attack' } | { type: 'ability'; abilityId: string } | { type: 'other' },
    outcome: ActionOutcome,
    timing: MoveTiming,
  ): SyncPoint | null {
    if (action.type !== 'ability') {
      this.acting = action.type === 'attack' ? { side, cue: null, hits: 0 } : null;
      return null;
    }
    // O Eclipse soa na troca de forma, alinhado ao clarão; aqui ficaria duplicado.
    if (FORM_CHANGE_ABILITIES.has(action.abilityId)) {
      this.acting = null;
      return null;
    }
    const cue = abilityCue(action.abilityId, this.forms[side]);
    this.acting = { side, cue, hits: 0 };
    if (!cue) {
      this.sink.play('ability');
      return null;
    }
    if (action.abilityId === 'explosive-grenade') this.sink.play('toss');

    const planned = cue.sync === 'launch' ? timing.launchMs : timing.impactMs;
    const alignInMs = planned > 0 ? planned + SYNC_SLACK_MS : 0;
    const segment = cue.segments?.[0];
    let at: number | null = null;
    if (outcome.hits > 0 || cue.kind === 'release') {
      at = this.sink.playClip(cue.clip, { alignInMs, segment });
    } else {
      // Errou ou não causou dano: só a preparação, quando ela existe.
      const hitAt = segment?.hitAt ?? CLIPS[cue.clip].hitAt;
      if (hitAt >= MIN_BUILD_UP_ON_MISS) at = this.sink.playClip(cue.clip, { alignInMs, segment, cutBeforeHit: true });
    }
    return at === null || planned <= 0 ? null : { moment: cue.sync, at };
  }

  /**
   * Antes de desenhar um dano: tiro da torre e golpes seguintes de habilidades com vários
   * danos. `timing` conta a partir de agora (o projétil sai em seguida).
   */
  beforeHit(event: DamageEvent, timing: MoveTiming = NO_DELAY): SyncPoint | null {
    if (event.kind === 'turret') {
      const at = this.sink.playClip(TURRET_SHOT_CUE.clip, { alignInMs: timing.launchMs });
      return at === null ? null : { moment: 'launch', at };
    }
    const acting = this.acting;
    if (!acting?.cue || acting.side !== event.source || (event.kind !== 'basic' && event.kind !== 'ability')) return null;
    const segments = acting.cue.segments;
    let sync: SyncPoint | null = null;
    if (acting.hits >= 1 && segments && segments.length > 1) {
      const segment = segments[Math.min(acting.hits, segments.length - 1)];
      const moment = acting.cue.sync;
      const at = this.sink.playClip(acting.cue.clip, { alignInMs: moment === 'launch' ? timing.launchMs : timing.impactMs, segment });
      if (at !== null) sync = { moment, at };
    }
    acting.hits += 1;
    return sync;
  }

  /** No momento do impacto visual: impacto genérico quando não há som próprio. */
  impact(event: DamageEvent): void {
    if (event.kind === 'turret') return;
    const acting = this.acting;
    const ownSound = acting?.cue && acting.side === event.source && (event.kind === 'basic' || event.kind === 'ability');
    if (ownSound) return;
    if (event.kind === 'periodic') {
      this.sink.playClip(GENERIC_IMPACT, { gainDb: IMPACT_GAIN_DB.periodic });
      return;
    }
    this.sink.play(event.critical ? 'critical' : 'hit');
  }

  dodge(_event: DodgeEvent): void {
    this.sink.play('dodge');
  }

  /**
   * Troca de forma. Entrar no Eclipse toca o arquivo uma única vez, com o momento mais forte
   * alinhado ao clarão (`flashInMs`); voltar à forma base usa o som de bônus.
   */
  formChange(side: Side, form: string, flashInMs: number): SyncPoint | null {
    const previous = this.forms[side];
    this.forms[side] = form;
    const clip = FORM_CLIPS[form];
    if (form === 'base') {
      this.formClipPlayed[side] = false;
      if (previous !== 'base') this.sink.play('buff');
      return null;
    }
    if (!clip) {
      this.sink.play('ability');
      return null;
    }
    if (this.formClipPlayed[side] || previous === form) return null;
    this.formClipPlayed[side] = true;
    const at = this.sink.playClip(clip, { alignInMs: flashInMs > 0 ? flashInMs + SYNC_SLACK_MS : 0 });
    return at === null || flashInMs <= 0 ? null : { moment: 'flash', at };
  }

  knockout(): void {
    this.sink.play('knockout');
  }

  /** Fim da ação: os próximos danos não pertencem mais a ela. */
  endAction(): void {
    this.acting = null;
  }
}
