/** Runtime values of the rule language. Dates are `YYYY-MM-DD` strings. */
export type Value = null | number | string | boolean | Value[] | { [key: string]: Value };

/** `null`, `false`, `0`, `''` and `[]` are falsy; everything else is truthy. */
export function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Strict, deep equality: different types are never equal. */
export function valuesEqual(a: unknown, b: unknown): boolean {
  a = a ?? null;
  b = b ?? null;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => valuesEqual(item, b[i]))
    );
  }
  if (typeof a === 'object' || typeof b === 'object') {
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    return (
      ka.length === kb.length &&
      ka.every(
        (k) =>
          Object.hasOwn(b as object, k) &&
          valuesEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
      )
    );
  }
  return a === b;
}
