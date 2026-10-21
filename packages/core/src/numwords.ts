// Speech recognisers often write numbers out ("October twenty fourth",
// "eleven fifty nine p.m."). Turn those into digits before date matching.

const UNITS: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const ORD_UNITS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16,
  seventeenth: 17, eighteenth: 18, nineteenth: 19,
};
const ORD_TENS: Record<string, number> = { twentieth: 20, thirtieth: 30 };

function suffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

/** Value of one spoken number (≤ 99), or null. `ordinal` tells whether it ended in -th/-st. */
function parseSpoken(words: string[]): { value: number; ordinal: boolean } | null {
  if (words.length === 0 || words.length > 2) return null;
  const [a, b] = words;
  if (words.length === 1) {
    if (a in UNITS) return { value: UNITS[a], ordinal: false };
    if (a in TENS) return { value: TENS[a], ordinal: false };
    if (a in ORD_UNITS) return { value: ORD_UNITS[a], ordinal: true };
    if (a in ORD_TENS) return { value: ORD_TENS[a], ordinal: true };
    return null;
  }
  if (!(a in TENS)) return null;
  if (b in UNITS && UNITS[b] > 0 && UNITS[b] < 10) return { value: TENS[a] + UNITS[b], ordinal: false };
  if (b in ORD_UNITS && ORD_UNITS[b] < 10) return { value: TENS[a] + ORD_UNITS[b], ordinal: true };
  return null;
}

const NUMBER_WORD = new RegExp(
  `\\b(${[...Object.keys(TENS), ...Object.keys(UNITS), ...Object.keys(ORD_UNITS), ...Object.keys(ORD_TENS)].join("|")})(?:[\\s-]+(${[
    ...Object.keys(UNITS),
    ...Object.keys(ORD_UNITS),
  ].join("|")}))?\\b`,
  "gi",
);

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";

/**
 * Rewrites spoken numbers as digits where they matter for dates and times:
 * "October twenty fourth" -> "October 24th", "eleven fifty nine p.m." -> "11:59 p.m.",
 * "seven thirty a.m." -> "7:30 a.m.", "the third" -> "the 3rd".
 * Leaves "one more thing" and "a second" alone.
 */
export function digitize(text: string): string {
  // Clock times first: "<hour> <minutes> a.m./p.m./o'clock"
  let out = text.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[\s-]+(oh[\s-]+\w+|o'clock|(?:ten|fifteen|twenty|thirty|forty|fifty)(?:[\s-]+(?:one|two|three|four|five|six|seven|eight|nine))?)?(?=\s*(a\.?\s?m\.?|p\.?\s?m\.?|o'clock|in the (?:morning|afternoon|evening)))/gi,
    (m, h: string, mm?: string) => {
      const hour = UNITS[h.toLowerCase()];
      if (!mm || /o'clock/i.test(mm)) return `${hour}:00`;
      const parts = mm.toLowerCase().split(/[\s-]+/).filter((w) => w !== "oh");
      const min = parseSpoken(parts);
      return min ? `${hour}:${String(min.value).padStart(2, "0")}` : m;
    },
  );
  out = out.replace(NUMBER_WORD, (m, a: string, b: string | undefined, offset: number, whole: string) => {
    const words = [a, b].filter(Boolean).map((w) => (w as string).toLowerCase());
    const parsed = parseSpoken(words);
    if (!parsed) return m;
    const before = whole.slice(Math.max(0, offset - 16), offset).toLowerCase();
    const after = whole.slice(offset + m.length, offset + m.length + 12).toLowerCase();
    const nearMonth = new RegExp(`(${MONTHS})\\.?\\s*(the\\s+)?$`).test(before) || new RegExp(`^\\s+(of\\s+)?(${MONTHS})\\b`).test(after);
    if (parsed.ordinal) {
      // "a second", "the first time", "second law": ordinals only become dates next to a month or after "the".
      const theDate = /\bthe\s+$/.test(before) && /^\s*(of\b|[.,!?;]|$)/.test(after);
      if (!nearMonth && !theDate) return m;
      if (parsed.value > 31) return m;
      return `${parsed.value}${suffix(parsed.value)}`;
    }
    if (nearMonth && parsed.value >= 1 && parsed.value <= 31) return String(parsed.value);
    return m;
  });
  return out;
}
