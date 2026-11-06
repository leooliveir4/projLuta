import type { ClipInfo, Segment } from './soundCatalog.ts';

/** Como tocar um arquivo para que ele acompanhe a animação. */
export interface ClipOptions {
  /**
   * Daqui a quantos milissegundos o momento principal do som (`hitAt`) deve soar, ou seja,
   * quanto falta para o acontecimento visual correspondente. 0 = agora.
   */
  alignInMs?: number;
  /** Trecho do arquivo, nas habilidades com vários danos. */
  segment?: Segment;
  /** Golpe que não acertou: o som termina, com fade, antes do momento principal. */
  cutBeforeHit?: boolean;
  /** Ajuste de volume desta reprodução (dB). */
  gainDb?: number;
}

/** Quando começar, de que ponto do arquivo e por quanto tempo (tudo em segundos). */
export interface ClipSchedule {
  delay: number;
  offset: number;
  duration: number;
  /** Duração do fade no fim (0 = o arquivo termina sozinho). */
  fadeOut: number;
}

/** Ataque mínimo mantido antes do momento principal, para não cortar o transiente. */
export const MIN_PREROLL = 0.03;

/**
 * Calcula o agendamento. Se há tempo de sobra até o acontecimento visual, o som começa
 * atrasado; se falta tempo, ele começa já, pulando parte da preparação do arquivo. Em
 * ambos os casos o momento principal cai sobre o acontecimento (a menos do ataque mínimo).
 */
export function scheduleClip(info: ClipInfo, bufferDuration: number, options: ClipOptions = {}): ClipSchedule | null {
  const segment = options.segment;
  const from = Math.max(0, segment?.from ?? 0);
  const to = Math.min(segment?.to ?? bufferDuration, bufferDuration);
  const hit = Math.min(Math.max(segment?.hitAt ?? info.hitAt, from), to);
  const lead = Math.max(0, (options.alignInMs ?? 0) / 1000);
  const preroll = hit - from;

  let delay: number;
  let offset: number;
  if (lead >= preroll) {
    delay = lead - preroll;
    offset = from;
  } else {
    delay = 0;
    offset = Math.max(from, hit - Math.max(lead, MIN_PREROLL));
  }

  let end = to;
  let fadeOut = segment?.to !== undefined ? 0.03 : 0;
  if (options.cutBeforeHit) {
    end = Math.min(end, hit - 0.02);
    fadeOut = 0.12;
  }
  const duration = end - offset;
  if (duration <= 0.02) return null;
  return { delay, offset, duration, fadeOut: Math.min(fadeOut, duration) };
}
