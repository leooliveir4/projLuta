import type { ImpactKind, ProjectileKind } from './choreography.ts';
import { h, wait } from './dom.ts';

/** Ponto em pixels, relativo à arena. */
export interface Point {
  x: number;
  y: number;
}

/** Cores dos efeitos de um personagem. */
export interface Palette {
  c1: string;
  c2: string;
}

/** Direção do golpe na tela: 1 = para a direita, −1 = para a esquerda. */
export type Direction = 1 | -1;

const SHAKE_PX = [0, 3, 6, 10] as const;

/**
 * Camada de efeitos da arena. Tudo é desenhado com elementos leves (transform e opacity)
 * e removido ao terminar; não há laço de animação contínuo nem bibliotecas.
 */
export class VfxLayer {
  private readonly layer: HTMLElement;
  private readonly stage: HTMLElement;

  constructor(layer: HTMLElement, stage: HTMLElement) {
    this.layer = layer;
    this.stage = stage;
  }

  /** Cria um elemento de efeito no ponto e o remove depois de `life` ms. */
  private spawn(className: string, at: Point, palette: Palette, life: number, style: Record<string, string> = {}): HTMLElement {
    const node = h('div', { class: `vfx-node ${className}` });
    node.style.left = `${at.x}px`;
    node.style.top = `${at.y}px`;
    node.style.setProperty('--c1', palette.c1);
    node.style.setProperty('--c2', palette.c2);
    for (const [name, value] of Object.entries(style)) node.style.setProperty(name, value);
    this.layer.append(node);
    window.setTimeout(() => node.remove(), life);
    return node;
  }

  /* Projéteis ---------------------------------------------------------- */

  async projectile(kind: ProjectileKind, from: Point, to: Point, palette: Palette): Promise<void> {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const distance = Math.hypot(dx, dy);

    if (kind === 'bullet') {
      this.spawn('vfx-muzzle', from, palette, 220, { '--angle': `${angle}deg` });
      const tracer = this.spawn('vfx-bullet', from, palette, 400, { '--angle': `${angle}deg` });
      await tracer
        .animate(
          [
            { transform: `translate(0px, 0px) rotate(${angle}deg) scaleX(0.4)` },
            { transform: `translate(${dx}px, ${dy}px) rotate(${angle}deg) scaleX(1)` },
          ],
          { duration: Math.max(110, distance * 0.28), easing: 'linear' },
        )
        .finished.catch(() => undefined);
      tracer.remove();
      return;
    }

    if (kind === 'grenade') {
      const grenade = this.spawn('vfx-grenade', from, palette, 900);
      const lift = Math.min(160, distance * 0.35);
      await grenade
        .animate(
          [
            { transform: 'translate(0px, 0px) rotate(0deg)' },
            { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) rotate(360deg)`, offset: 0.5 },
            { transform: `translate(${dx}px, ${dy}px) rotate(720deg)` },
          ],
          { duration: 460, easing: 'linear' },
        )
        .finished.catch(() => undefined);
      grenade.remove();
      return;
    }

    // Orbe e Supernova: esfera com cauda apontada para trás.
    const orb = this.spawn(kind === 'nova' ? 'vfx-orb vfx-orb--nova' : 'vfx-orb', from, palette, 1200, { '--angle': `${angle}deg` });
    await orb
      .animate(
        [
          { transform: 'translate(0px, 0px) scale(0.6)', opacity: 0.8 },
          { transform: `translate(${dx}px, ${dy}px) scale(1.05)`, opacity: 1 },
        ],
        { duration: kind === 'nova' ? 420 : 340, easing: 'cubic-bezier(0.45, 0, 0.75, 1)' },
      )
      .finished.catch(() => undefined);
    orb.remove();
  }

  /** Energia que converge para um ponto antes de um golpe forte. */
  async charge(at: Point, palette: Palette, duration = 460): Promise<void> {
    this.spawn('vfx-charge', at, palette, duration + 80, { '--duration': `${duration}ms` });
    await wait(duration);
  }

  /** Rachadura que corre pelo chão de um ponto a outro. */
  async groundWave(from: Point, to: Point, palette: Palette): Promise<void> {
    const width = Math.abs(to.x - from.x);
    const crack = this.spawn('vfx-crack', { x: Math.min(from.x, to.x), y: to.y }, palette, 900, {
      '--w': `${width}px`,
      '--origin': to.x >= from.x ? 'left' : 'right',
    });
    crack.style.width = `${width}px`;
    await wait(300);
  }

  /* Impactos ------------------------------------------------------------ */

  /** Desenha o impacto no ponto e devolve quanto tempo ele leva para se dissipar. */
  impact(kind: ImpactKind, at: Point, palette: Palette, dir: Direction, ground?: Point): number {
    const flip = { '--dir': String(dir) };
    switch (kind) {
      case 'slash':
        this.spawn('vfx-slash vfx-slash--single', at, palette, 520, flip);
        return 360;
      case 'cross':
        this.spawn('vfx-slash', at, palette, 600, flip);
        return 420;
      case 'heavy':
        this.spawn('vfx-slash vfx-slash--heavy', at, palette, 620, flip);
        this.spawn('vfx-burst vfx-burst--small', at, palette, 600);
        return 420;
      case 'claw':
        this.spawn('vfx-claw', at, palette, 620, flip);
        return 420;
      case 'explosion':
        this.spawn('vfx-explosion', at, palette, 900);
        return 560;
      case 'stars':
        for (let i = 0; i < 6; i += 1) {
          this.spawn('vfx-star', { x: at.x + (i - 2.5) * 26, y: at.y }, palette, 1100, {
            '--delay': `${i * 70}ms`,
            '--drift': `${(i % 2 === 0 ? -1 : 1) * 10}px`,
          });
        }
        this.spawn('vfx-burst', at, palette, 900, { '--delay': '280ms' });
        return 640;
      case 'tear':
        this.spawn('vfx-tear', at, palette, 760, flip);
        return 520;
      case 'implosion':
        this.spawn('vfx-implosion', at, palette, 1000);
        return 620;
      case 'shockwave':
        this.spawn('vfx-quake', ground ?? at, palette, 900);
        this.spawn('vfx-burst', at, palette, 600);
        return 520;
      case 'sigil':
        this.spawn('vfx-sigil', at, palette, 1100);
        return 640;
      case 'drain':
        this.spawn('vfx-burst vfx-burst--small', at, palette, 600);
        return 360;
      case 'burst':
      default:
        this.spawn('vfx-burst', at, palette, 600);
        return 360;
    }
  }

  /** Partículas que saem do alvo e voltam para quem absorve a vida. */
  drain(from: Point, to: Point, palette: Palette): void {
    for (let i = 0; i < 9; i += 1) {
      const spread = { x: from.x + (Math.random() - 0.5) * 60, y: from.y + (Math.random() - 0.5) * 80 };
      const dot = this.spawn('vfx-mote', spread, palette, 1100);
      dot
        .animate(
          [
            { transform: 'translate(0px, 0px) scale(0.6)', opacity: 0 },
            { opacity: 1, offset: 0.2 },
            { transform: `translate(${to.x - spread.x}px, ${to.y - spread.y}px) scale(1)`, opacity: 0 },
          ],
          { duration: 620, delay: i * 45, easing: 'cubic-bezier(0.5, 0, 0.6, 1)', fill: 'both' },
        )
        .finished.catch(() => undefined);
    }
  }

  /** Brilhos que sobem de quem recupera vida. */
  sparkle(at: Point, palette: Palette): void {
    for (let i = 0; i < 6; i += 1) {
      this.spawn('vfx-sparkle', { x: at.x + (i - 2.5) * 18, y: at.y + (i % 2) * 24 }, palette, 1000, { '--delay': `${i * 60}ms` });
    }
  }

  /** Anel que se expande do lutador (bônus, transformação). */
  ring(at: Point, palette: Palette, big = false): void {
    this.spawn(big ? 'vfx-ring vfx-ring--big' : 'vfx-ring', at, palette, 900);
  }

  /* Tela ---------------------------------------------------------------- */

  /** Tremor curto da arena, proporcional à força do golpe. */
  shake(level: number): void {
    const px = SHAKE_PX[Math.max(0, Math.min(3, Math.round(level)))];
    if (!px) return;
    this.stage.animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: `translate(${-px}px, ${px * 0.4}px)` },
        { transform: `translate(${px * 0.8}px, ${-px * 0.3}px)` },
        { transform: `translate(${-px * 0.5}px, ${px * 0.2}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 200 + px * 22, easing: 'ease-out' },
    );
  }

  /** Clarão na arena inteira. */
  flash(color: string, duration = 320): void {
    const node = h('div', { class: 'vfx-flash' });
    node.style.setProperty('--c1', color);
    node.style.setProperty('--duration', `${duration}ms`);
    this.layer.append(node);
    window.setTimeout(() => node.remove(), duration + 40);
  }

  /** Escurece a arena por um tempo (transformação). */
  dim(on: boolean): void {
    this.stage.classList.toggle('is-dimmed', on);
  }
}
