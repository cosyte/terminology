/**
 * Small test-only helpers for safe array access under `noUncheckedIndexedAccess`, so tests can
 * read a known element without a non-null assertion (banned by the lint config).
 */

/** Return the element at `i`, throwing if it is absent — narrows away the `| undefined`. */
export function nth<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`test: no element at index ${String(i)}`);
  return v;
}

/** Return the sole element of a length-1 array (throws otherwise). */
export function only<T>(arr: readonly T[]): T {
  if (arr.length !== 1)
    throw new Error(`test: expected exactly 1 element, got ${String(arr.length)}`);
  return nth(arr, 0);
}
