import type { Ability, AbilityTag, CharacterId } from '../core/types.ts';
import { h, svg } from './dom.ts';
import { ICONS, type IconName } from './icons.ts';

/**
 * Ícones ilustrados das habilidades.
 *
 * Os arquivos ficam em `src/assets/images/abilities/<pasta>/<id-da-habilidade>.webp` (ou .png),
 * em que a pasta é o personagem (`lyra`, `vexra`...) ou `vaelith` para as versões do Eclipse.
 * Basta colocar o arquivo na pasta: o Vite o encontra no build, sem mudar código.
 *
 * Enquanto um ícone não existir, a interface mostra um marcador discreto (um símbolo pelo
 * tipo da habilidade), sem bloquear a seleção nem o combate.
 */
const FILES = import.meta.glob<string>('../assets/images/abilities/*/*.{webp,png}', {
  eager: true,
  import: 'default',
});

/** Endereço de cada ícone, por `pasta/id`. */
export const ABILITY_ICON_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(FILES).map(([path, url]) => {
    const [folder, file] = path.split('/').slice(-2);
    return [`${folder}/${file.replace(/\.(webp|png)$/, '')}`, url];
  }),
);

/** Pasta dos ícones de cada forma alternativa (as habilidades do Eclipse são da Vaelith). */
const FORM_FOLDERS: Readonly<Record<string, string>> = { eclipse: 'vaelith' };

/** Chave do ícone de uma habilidade (`pasta/id`), conforme o personagem e a forma ativa. */
export function abilityIconKey(characterId: CharacterId, abilityId: string, form = 'base'): string {
  return `${FORM_FOLDERS[form] ?? characterId}/${abilityId}`;
}

/** Endereço do ícone ilustrado, ou `null` quando ele ainda não foi enviado. */
export function abilityIconUrl(characterId: CharacterId, abilityId: string, form = 'base'): string | null {
  return ABILITY_ICON_URLS[abilityIconKey(characterId, abilityId, form)] ?? null;
}

/** Símbolo do marcador provisório, pelo tipo principal da habilidade. */
export function fallbackGlyph(tags: readonly AbilityTag[]): IconName {
  if (tags.includes('ultimate') || tags.includes('finisher')) return 'crown';
  if (tags.includes('summon')) return 'gear';
  if (tags.includes('damage')) return 'attack';
  if (tags.includes('defensive')) return 'defend';
  return 'ability';
}

/** Quadrado do ícone: a ilustração, quando existe, ou o marcador provisório. */
export function abilityIcon(characterId: CharacterId, ability: Pick<Ability, 'id' | 'tags'>, form = 'base', className = ''): HTMLElement {
  const url = abilityIconUrl(characterId, ability.id, form);
  const classes = `ability-icon${className ? ` ${className}` : ''}`;
  if (url) {
    return h('span', { class: `${classes} ability-icon--art`, 'aria-hidden': 'true' }, h('img', { src: url, alt: '', decoding: 'async', loading: 'lazy' }));
  }
  return h('span', { class: `${classes} ability-icon--fallback`, 'aria-hidden': 'true', 'data-icon': 'fallback' }, svg(ICONS[fallbackGlyph(ability.tags)]));
}
