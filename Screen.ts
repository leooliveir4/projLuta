import { h } from '../dom.ts';

/** Base das telas: cria o elemento raiz e gerencia ouvintes globais. */
export abstract class Screen {
  readonly element: HTMLElement;
  private readonly cleanups: (() => void)[] = [];

  protected constructor(name: string, label: string) {
    this.element = h('main', { class: `screen screen--${name}`, 'aria-label': label });
  }

  mount(root: HTMLElement): void {
    root.replaceChildren(this.element);
    window.scrollTo(0, 0);
    this.onMount();
  }

  destroy(): void {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.onDestroy();
  }

  /** Foca o primeiro elemento marcado com data-autofocus para navegação por teclado. */
  protected onMount(): void {
    this.element.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }

  protected onDestroy(): void {}

  protected listen<K extends keyof WindowEventMap>(type: K, handler: (event: WindowEventMap[K]) => void): void {
    window.addEventListener(type, handler);
    this.cleanups.push(() => window.removeEventListener(type, handler));
  }
}
