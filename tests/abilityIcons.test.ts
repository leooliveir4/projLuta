import { describe, expect, it } from 'vitest';
import { ECLIPSE_ID, Nyxara } from '../src/core/characters/Nyxara.ts';
import { CHARACTER_IDS, createCharacter } from '../src/core/roster.ts';
import { ABILITY_ICON_URLS, abilityIconKey, abilityIconUrl, fallbackGlyph } from '../src/ui/abilityIcons.ts';
import { act, createBattle } from './helpers.ts';

/** Ids reais de cada pasta de ícones: os seis personagens e as versões do Eclipse. */
function abilityIdsByFolder(): Record<string, string[]> {
  const folders: Record<string, string[]> = {};
  for (const id of CHARACTER_IDS) folders[id] = createCharacter(id).abilities.map((ability) => ability.id);
  const engine = createBattle('nyxara', 'vorath');
  const nyx = engine.character('player') as Nyxara;
  while (nyx.influence < 100) {
    act(engine, 'player', { type: 'attack' });
    act(engine, 'enemy', { type: 'defend' });
  }
  act(engine, 'player', { type: 'ability', abilityId: ECLIPSE_ID });
  folders.vaelith = nyx.abilities.map((ability) => ability.id);
  return folders;
}

describe('ícones das habilidades', () => {
  it('a chave segue o personagem e a forma ativa', () => {
    expect(abilityIconKey('lyra', 'astral-orb')).toBe('lyra/astral-orb');
    expect(abilityIconKey('nyxara', 'shadow-blade')).toBe('nyxara/shadow-blade');
    expect(abilityIconKey('nyxara', 'shadow-blade', 'eclipse')).toBe('vaelith/shadow-blade');
  });

  it('todo arquivo de ícone corresponde a uma habilidade real da pasta', () => {
    const folders = abilityIdsByFolder();
    for (const key of Object.keys(ABILITY_ICON_URLS)) {
      const [folder, abilityId] = key.split('/');
      expect(folders[folder], `pasta desconhecida: ${key}`).toBeDefined();
      expect(folders[folder], `habilidade desconhecida: ${key}`).toContain(abilityId);
    }
  });

  it('sem arquivo, não há ícone (a interface usa o marcador provisório)', () => {
    const folders = abilityIdsByFolder();
    for (const [folder, ids] of Object.entries(folders)) {
      for (const id of ids) {
        const character = folder === 'vaelith' ? 'nyxara' : (folder as (typeof CHARACTER_IDS)[number]);
        const url = abilityIconUrl(character, id, folder === 'vaelith' ? 'eclipse' : 'base');
        expect(url === null || typeof url === 'string').toBe(true);
        expect(url !== null).toBe(`${folder}/${id}` in ABILITY_ICON_URLS);
      }
    }
  });

  it('o marcador provisório indica o tipo da habilidade', () => {
    expect(fallbackGlyph(['damage', 'finisher'])).toBe('crown');
    expect(fallbackGlyph(['ultimate', 'buff'])).toBe('crown');
    expect(fallbackGlyph(['summon'])).toBe('gear');
    expect(fallbackGlyph(['damage', 'debuff'])).toBe('attack');
    expect(fallbackGlyph(['defensive', 'buff'])).toBe('defend');
    expect(fallbackGlyph(['buff'])).toBe('ability');
  });
});
