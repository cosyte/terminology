/**
 * {@link frozenMap} — hand a caller a **read-only view** of a loaded model's lookup map instead of
 * the map itself.
 *
 * A loaded release is the engine's answer to "what does this code mean", and every `load*` function
 * returns it through `Object.freeze`. `Object.freeze` cannot reach a `Map`: its entries live in an
 * internal slot rather than in properties, so freezing the wrapper leaves `set` / `delete` / `clear`
 * working on the map the wrapper points at. A holder could therefore empty a drug graph's edges,
 * delete an ICD-9 → ICD-10 mapping, or add one the release never authored — on a package whose
 * stated invariant is that it never fabricates.
 *
 * @packageDocumentation
 */

/**
 * The view {@link frozenMap} returns: a {@link ReadonlyMap} that additionally carries the three
 * mutators, so calling one is a named refusal rather than a `TypeError: … is not a function`.
 */
interface FrozenMapView<K, V> extends ReadonlyMap<K, V> {
  /** Refuses. Present so a mistaken `set` names the model it tried to mutate. */
  readonly set: () => never;
  /** Refuses. Present so a mistaken `delete` names the model it tried to mutate. */
  readonly delete: () => never;
  /** Refuses. Present so a mistaken `clear` names the model it tried to mutate. */
  readonly clear: () => never;
}

/**
 * Wrap a built lookup map in a frozen, read-only view of it.
 *
 * **The view is not a `Map`, and that is the point.** Sealing a `Map` by overwriting its mutators
 * closes one route and leaves another: `Map.prototype.set.call(theMap, …)` reaches the internal slot
 * directly and still inserts. The view has no such slot, so the prototype method has no receiver to
 * write to and throws instead — the same reason it cannot be reached by re-defining a property
 * either, since the view is frozen. Reads are unchanged: `get` / `has` / `size` / `keys` / `values` /
 * `entries` / `forEach` / iteration all delegate to the map, which nothing else holds a reference to.
 *
 * The guarantee is **that the model does not change**, not that a write throws — this package ships
 * a CJS build a sloppy-mode caller can `require`, where a refused *property* write is a silent no-op.
 * The three mutators here throw in both modes because they throw explicitly; assert the readings
 * regardless.
 *
 * **What the view costs, and why the cost is paid this way.** Not being a `Map` is observable, and
 * measured rather than reasoned: a view is `instanceof Object` rather than `instanceof Map`, prints
 * as a plain object, `Object.keys` lists its ten own methods, `JSON.stringify` renders it as
 * `{"size":N}` where a `Map` rendered `{}`, and a model holding one **cannot be structured-cloned** —
 * `structuredClone` and `worker.postMessage` raise a `DataCloneError`, `v8.serialize` a plain `Error`,
 * both naming an uncloneable function. Clone what you need out of it instead
 * (`new Map(model.concepts)`). That refusal is deliberate: the view's methods are left **enumerable**
 * precisely so a clone attempt raises on one of them. Hiding them would make the clone *succeed* and
 * hand back a model whose indexes are empty while its counts still report the loaded figures — the
 * same shape as the defect this function exists to close, arriving silently.
 *
 * @param source - The built map. The caller must not retain a reference to it after wrapping.
 * @param what - What a refusal names, e.g. `"a loaded RxNorm graph's concepts"`. **A string literal
 *   at the call site**, never a caller- or document-supplied value: it is interpolated into a
 *   `TypeError` message, and this engine owns every string a message is built from.
 * @returns A frozen {@link ReadonlyMap} view of `source`.
 * @example
 * ```ts
 * import { frozenMap } from "./frozen-map.js";
 *
 * const view = frozenMap(new Map([["a", 1]]), "the example map");
 * view.get("a"); // => 1
 * ```
 */
export function frozenMap<K, V>(source: Map<K, V>, what: string): ReadonlyMap<K, V> {
  const refuse = (): never => {
    throw new TypeError(`Cannot mutate ${what} (it is immutable)`);
  };
  const view: FrozenMapView<K, V> = {
    get size(): number {
      return source.size;
    },
    get: (key: K): V | undefined => source.get(key),
    has: (key: K): boolean => source.has(key),
    keys: (): ReturnType<Map<K, V>["keys"]> => source.keys(),
    values: (): ReturnType<Map<K, V>["values"]> => source.values(),
    entries: (): ReturnType<Map<K, V>["entries"]> => source.entries(),
    forEach: (
      callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
      thisArg?: unknown,
    ): void => {
      for (const [key, value] of source) callback.call(thisArg, value, key, view);
    },
    [Symbol.iterator]: (): ReturnType<Map<K, V>[typeof Symbol.iterator]> =>
      source[Symbol.iterator](),
    set: refuse,
    delete: refuse,
    clear: refuse,
  };
  return Object.freeze(view);
}
