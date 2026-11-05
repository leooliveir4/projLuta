import { describe, expect, it } from 'vitest';
import { EFFECTS } from '../src/core/effects.ts';
import { CHARACTER_IDS, createCharacter } from '../src/core/roster.ts';
import { Nyxara, ECLIPSE_ID } from '../src/core/characters/Nyxara.ts';
import { ABILITY_MOVES, BASIC_MOVES, moveFor, STATUS_CLASSES } from '../src/ui/choreography.ts';
import { act, createBattle } from './helpers.ts';

describe('coreografia das ações (apresentação)', () => {
  it('todo personagem tem ataque básico e toda habilidade tem coreografia própria', () => {
    for (const id of CHARACTER_IDS) {
      expect(BASIC_MOVES[id], id).toBeDefined();
      for (const ability of createCharacter(id).abilities) {
        expect(ABILITY_MOVES[ability.id], `${id}: ${ability.id}`).toBeDefined();
      }
    }
  });

  it('as habilidades da Vaelith também estão cobertas', () => {
    const engine = createBattle('nyxara', 'vorath');
    const nyx = engine.character('player') as Nyxara;
    while (nyx.influence < 100) {
      act(engine, 'player', { type: 'attack' });
      act(engine, 'enemy', { type: 'defend' });
    }
    act(engine, 'player', { type: 'ability', abilityId: ECLIPSE_ID });
    for (const ability of nyx.abilities) expect(ABILITY_MOVES[ability.id], ability.name).toBeDefined();
  });

  it('o tipo de aproximação combina com o alvo da habilidade', () => {
    for (const id of CHARACTER_IDS) {
      for (const ability of createCharacter(id).abilities) {
        const move = moveFor(id, ability.id, ability.target);
        if (ability.target === 'self') expect(move.approach, ability.id).toBe('self');
        else expect(move.approach, ability.id).not.toBe('self');
        if (move.approach === 'ranged') expect(move.projectile, ability.id).toBeDefined();
        if (move.approach !== 'self') expect(move.impact, ability.id).toBeDefined();
      }
    }
  });

  it('estados persistentes apontam para efeitos que existem no motor', () => {
    const ids = new Set([...Object.values(EFFECTS).map((effect) => effect.id), 'burn', 'bleed']);
    for (const effectId of Object.keys(STATUS_CLASSES)) expect(ids.has(effectId), effectId).toBe(true);
  });
});
