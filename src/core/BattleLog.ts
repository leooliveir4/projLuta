import type { LogTone } from './types.ts';

export interface LogEntry {
  id: number;
  turn: number;
  text: string;
  tone: LogTone;
}

/** Registro cronológico dos acontecimentos do combate, independente da interface. */
export class BattleLog {
  private readonly items: LogEntry[] = [];
  private nextId = 1;

  add(text: string, tone: LogTone, turn: number): LogEntry {
    const entry: LogEntry = { id: this.nextId, turn, text, tone };
    this.nextId += 1;
    this.items.push(entry);
    return entry;
  }

  get entries(): readonly LogEntry[] {
    return this.items;
  }

  get size(): number {
    return this.items.length;
  }

  find(id: number): LogEntry | undefined {
    return this.items.find((entry) => entry.id === id);
  }

  ofTurn(turn: number): LogEntry[] {
    return this.items.filter((entry) => entry.turn === turn);
  }
}
