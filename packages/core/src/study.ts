// Study games built from a class's own cards: no network, no cost.

export interface Card {
  front: string;
  back: string;
  from?: string;
}

export interface McQuestion {
  prompt: string;
  options: string[];
  answer: number;
  from?: string;
}

/** A shuffle that tests can make repeatable. */
export function shuffle<T>(xs: T[], rand: () => number = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Multiple choice from cards: the right back plus three other cards' backs. Needs at least four cards. */
export function mcQuestions(cards: Card[], n = 10, rand: () => number = Math.random): McQuestion[] {
  const usable = cards.filter((c) => c.back.length <= 220 && c.front.length <= 220);
  const backs = [...new Set(usable.map((c) => c.back))];
  if (backs.length < 4) return [];
  return shuffle(usable, rand)
    .slice(0, n)
    .map((c) => {
      const wrong = shuffle(backs.filter((b) => b !== c.back), rand).slice(0, 3);
      const options = shuffle([c.back, ...wrong], rand);
      return { prompt: c.front, options, answer: options.indexOf(c.back), from: c.from };
    });
}

/** Spaced repetition, Leitner style: box 0 is due now; each right answer waits longer. */
export interface Recall {
  box: number;
  due: string;
}
const WAIT_DAYS = [0, 1, 3, 7, 16, 35];

export function review(prev: Recall | undefined, right: boolean, now = new Date()): Recall {
  const box = right ? Math.min(WAIT_DAYS.length - 1, (prev?.box ?? 0) + 1) : 0;
  return { box, due: new Date(now.getTime() + WAIT_DAYS[box] * 86_400_000).toISOString() };
}

export const isDue = (r: Recall | undefined, now = new Date()) => !r || Date.parse(r.due) <= now.getTime();

/** A stable key for a card, so progress survives notes being rewritten. */
export const cardKey = (c: Card) => c.front.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);
