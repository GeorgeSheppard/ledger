import { parseSequence } from './keys';

/** How long to wait for the next chord of a sequence like `g d`. */
export const SEQUENCE_TIMEOUT_MS = 1000;

export interface MatchCandidate<Id extends string> {
  id: Id;
  keys: string;
}

/**
 * Turns a stream of chords into matched shortcut ids, handling multi-chord sequences.
 * Pure and framework-free: the caller supplies chords, timestamps and the active candidates.
 */
export class SequenceMatcher<Id extends string> {
  private buffer: string[] = [];
  private lastAt = -Infinity;

  /**
   * Feeds one chord. Returns the matched id, `'pending'` when the chord starts a longer sequence,
   * or null when nothing matches.
   */
  feed(
    chord: string,
    now: number,
    candidates: readonly MatchCandidate<Id>[]
  ): Id | 'pending' | null {
    if (now - this.lastAt > SEQUENCE_TIMEOUT_MS) this.buffer = [];
    this.lastAt = now;

    for (const attempt of [[...this.buffer, chord], [chord]]) {
      let pending = false;
      for (const candidate of candidates) {
        const sequence = parseSequence(candidate.keys);
        if (!attempt.every((c, i) => sequence[i] === c)) continue;
        if (sequence.length === attempt.length) {
          this.buffer = [];
          return candidate.id;
        }
        pending = true;
      }
      if (pending) {
        this.buffer = attempt;
        return 'pending';
      }
    }
    this.buffer = [];
    return null;
  }

  reset() {
    this.buffer = [];
  }
}
