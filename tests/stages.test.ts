import { describe, expect, it } from 'vitest';
import { CHALLENGE_LENGTH } from '../src/progression/Progression.ts';
import { CHALLENGE_STAGES, challengeStage, STAGE_IDS, STAGES } from '../src/ui/art.ts';

describe('cenários', () => {
  it('há cinco cenários, os dois antigos mantidos, cada um com nome e imagem', () => {
    expect(STAGE_IDS).toEqual(['arcane', 'ring', 'ruinas-antigas', 'templo-eclipse', 'dimensao-abissal']);
    for (const id of STAGE_IDS) {
      expect(STAGES[id].name.length, id).toBeGreaterThan(0);
      expect(STAGES[id].image, id).toBeTruthy();
    }
    expect(STAGES['ruinas-antigas'].image).toContain('ruinas-antigas');
    expect(STAGES['templo-eclipse'].image).toContain('templo-eclipse');
    expect(STAGES['dimensao-abissal'].image).toContain('dimensao-abissal');
  });

  it('o desafio mantém Arena Arcana e Ringue nas duas primeiras etapas e usa os novos mapas depois', () => {
    expect(challengeStage(0)).toBe('arcane');
    expect(challengeStage(1)).toBe('ring');
    expect(challengeStage(2)).toBe('ruinas-antigas');
    expect(challengeStage(CHALLENGE_LENGTH - 1)).toBe('dimensao-abissal');
    expect(CHALLENGE_STAGES).toHaveLength(CHALLENGE_LENGTH);
    for (const stage of CHALLENGE_STAGES) expect(STAGE_IDS).toContain(stage);
  });

  it('etapas fora da lista recomeçam do início, sem cenário indefinido', () => {
    expect(challengeStage(CHALLENGE_STAGES.length)).toBe('arcane');
    expect(challengeStage(-1)).toBe(CHALLENGE_STAGES[CHALLENGE_STAGES.length - 1]);
  });
});
