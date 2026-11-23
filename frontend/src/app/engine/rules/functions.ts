import { Value, valuesEqual } from './value';

export interface FunctionContext {
  /** Today as `YYYY-MM-DD`. */
  today: string;
}

interface FunctionSpec {
  minArgs: number;
  maxArgs: number;
  call(args: Value[], context: FunctionContext): Value;
}

const isNumber = (v: Value): v is number => typeof v === 'number';

/** Days since 1970-01-01 for a valid `YYYY-MM-DD`, otherwise `null`. */
export function epochDay(value: Value): number | null {
  const date = parseDate(value);
  if (!date) return null;
  // days_from_civil (H. Hinnant); independent of time zones and the 0-99 year quirk of Date.
  const [y0, m, d] = date;
  const y = m <= 2 ? y0 - 1 : y0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** `[year, month, day]` for a calendar-valid `YYYY-MM-DD` string, otherwise `null`. */
export function parseDate(value: Value): [number, number, number] | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (m < 1 || m > 12 || d < 1 || d > days[m - 1]) return null;
  return [y, m, d];
}

/** Avoids `-0` so both engines produce the same JSON. */
const noNegativeZero = (n: number) => (n === 0 ? 0 : n);

export const FUNCTIONS = {
  currentYear: {
    minArgs: 0,
    maxArgs: 0,
    call: (_args, ctx) => parseDate(ctx.today)![0],
  },
  today: { minArgs: 0, maxArgs: 0, call: (_args, ctx) => ctx.today },
  age: {
    minArgs: 1,
    maxArgs: 1,
    call: ([date], ctx) => {
      const birth = parseDate(date);
      const today = parseDate(ctx.today)!;
      if (!birth) return null;
      const beforeBirthday = today[1] < birth[1] || (today[1] === birth[1] && today[2] < birth[2]);
      return today[0] - birth[0] - (beforeBirthday ? 1 : 0);
    },
  },
  daysBetween: {
    minArgs: 2,
    maxArgs: 2,
    call: ([from, to]) => {
      const a = epochDay(from);
      const b = epochDay(to);
      return a === null || b === null ? null : b - a;
    },
  },
  len: {
    minArgs: 1,
    maxArgs: 1,
    call: ([v]) => (v === null ? 0 : typeof v === 'string' || Array.isArray(v) ? v.length : null),
  },
  count: {
    minArgs: 1,
    maxArgs: 1,
    call: ([v]) => (v === null ? 0 : Array.isArray(v) ? v.length : null),
  },
  contains: {
    minArgs: 2,
    maxArgs: 2,
    call: ([haystack, needle]) => {
      if (Array.isArray(haystack)) return haystack.some((item) => valuesEqual(item, needle));
      if (typeof haystack === 'string' && typeof needle === 'string') return haystack.includes(needle);
      return false;
    },
  },
  isEmpty: {
    minArgs: 1,
    maxArgs: 1,
    call: ([v]) =>
      v === null ||
      (typeof v === 'string' && v.trim() === '') ||
      (Array.isArray(v) && v.length === 0),
  },
  round: {
    minArgs: 1,
    maxArgs: 2,
    call: ([n, digits = 0]) => {
      if (!isNumber(n) || !isNumber(digits) || !Number.isInteger(digits) || digits < 0 || digits > 10) {
        return null;
      }
      const factor = 10 ** digits;
      return noNegativeZero((Math.sign(n) * Math.floor(Math.abs(n) * factor + 0.5)) / factor);
    },
  },
  min: {
    minArgs: 2,
    maxArgs: Infinity,
    call: (args) => (args.every(isNumber) ? Math.min(...args) : null),
  },
  max: {
    minArgs: 2,
    maxArgs: Infinity,
    call: (args) => (args.every(isNumber) ? Math.max(...args) : null),
  },
  abs: { minArgs: 1, maxArgs: 1, call: ([n]) => (isNumber(n) ? Math.abs(n) : null) },
} satisfies Record<string, FunctionSpec>;

export type FunctionName = keyof typeof FUNCTIONS;

export function isFunctionName(name: string): name is FunctionName {
  return Object.hasOwn(FUNCTIONS, name);
}

/** "1 argüman alır", "1-2 argüman alır", "en az 2 argüman alır", "argüman almaz". */
export function arityText(name: FunctionName): string {
  const { minArgs, maxArgs } = FUNCTIONS[name] as FunctionSpec;
  if (maxArgs === 0) return 'argüman almaz';
  if (maxArgs === Infinity) return `en az ${minArgs} argüman alır`;
  if (minArgs === maxArgs) return `${minArgs} argüman alır`;
  return `${minArgs}-${maxArgs} argüman alır`;
}
