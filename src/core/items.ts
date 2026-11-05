import { EFFECTS } from './effects.ts';
import type { ItemDefinition, ItemId } from './types.ts';

const HEALTH_POTION_RATIO = 0.3;
export const ENERGY_ELIXIR_AMOUNT = 40;

export const ITEMS: Record<ItemId, ItemDefinition> = {
  'health-potion': {
    id: 'health-potion',
    name: 'Poção de Vida',
    description: 'Recupera 30% da vida máxima.',
    use(ctx, user) {
      ctx.heal(user, Math.round(user.maxHp * HEALTH_POTION_RATIO));
    },
  },
  'energy-elixir': {
    id: 'energy-elixir',
    name: 'Elixir de Energia',
    description: 'Recupera 40 de energia.',
    use(ctx, user) {
      ctx.restoreEnergy(user, ENERGY_ELIXIR_AMOUNT);
    },
  },
  'strength-tonic': {
    id: 'strength-tonic',
    name: 'Tônico de Força',
    description: 'Ataque +20% por 3 turnos.',
    use(ctx, user) {
      ctx.applyEffect(user, EFFECTS.strength, user);
    },
  },
};

export const DEFAULT_LOADOUT: Readonly<Record<ItemId, number>> = {
  'health-potion': 1,
  'energy-elixir': 1,
  'strength-tonic': 1,
};

/** Inventário limitado de uma batalha. */
export class Inventory {
  private readonly counts = new Map<ItemId, number>();

  constructor(loadout: Readonly<Partial<Record<ItemId, number>>> = DEFAULT_LOADOUT) {
    for (const id of Object.keys(ITEMS) as ItemId[]) {
      this.counts.set(id, Math.max(0, loadout[id] ?? 0));
    }
  }

  count(itemId: ItemId): number {
    return this.counts.get(itemId) ?? 0;
  }

  has(itemId: ItemId): boolean {
    return this.count(itemId) > 0;
  }

  consume(itemId: ItemId): boolean {
    const current = this.count(itemId);
    if (current <= 0) return false;
    this.counts.set(itemId, current - 1);
    return true;
  }

  entries(): { item: ItemDefinition; count: number }[] {
    return (Object.keys(ITEMS) as ItemId[]).map((id) => ({ item: ITEMS[id], count: this.count(id) }));
  }

  get total(): number {
    let sum = 0;
    for (const value of this.counts.values()) sum += value;
    return sum;
  }
}
