type Child = Node | string | number | null | undefined | false;
type Listener = (event: Event) => void;
type Props = Record<string, string | number | boolean | Listener | undefined>;

/**
 * Cria um elemento com atributos, eventos (`onClick`, `onInput`...) e filhos.
 * Textos são inseridos como nós de texto, nunca como HTML.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (key === 'class') {
      element.className = String(value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      element.setAttribute(key, '');
    } else {
      element.setAttribute(key, String(value));
    }
  }
  append(element, ...children);
  return element;
}

export function append(parent: Element, ...children: (Child | Child[])[]): void {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Converte um SVG estático e confiável (ícones do próprio projeto) em elemento. */
export function svg(markup: string): SVGElement {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  const element = template.content.firstElementChild;
  if (!(element instanceof SVGElement)) throw new Error('SVG inválido.');
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('focusable', 'false');
  return element;
}

export function clear(element: Element): void {
  element.replaceChildren();
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('pt-BR');
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
