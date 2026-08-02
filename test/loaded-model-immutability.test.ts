/**
 * **A loaded model cannot be rewritten by whoever holds it.**
 *
 * Every `load*` function returns its model through `Object.freeze`, which reaches neither a `Map`'s
 * entries (they live in an internal slot, not in properties) nor the arrays and objects hanging off
 * it unless each one is frozen in turn. Before this suite, `loadGems`, `loadComplexMap` and
 * `loadRxNormGraph` all froze the wrapper and handed out plain `Map`s inside it, so a holder could
 * empty a medication graph's ingredient edges, delete an ICD-9 → ICD-10 mapping, or push a target
 * the steward's file never authored — measured on `dd8465b`, on a package whose stated invariant is
 * that it never fabricates.
 *
 * Two things this file is deliberate about, both learned the expensive way in `src/ucum/`:
 *
 * 1. **The guarantee is that the model does not change, not that a write throws.** `Object.freeze`
 *    refuses a property write by throwing in strict mode and by doing *nothing* in sloppy mode, and
 *    this package ships a CJS build a sloppy-mode caller can `require`. So every attack below
 *    asserts the **reading** afterwards; a thrown `TypeError` is asserted as how a strict-mode
 *    caller observes the refusal, never as the guarantee itself.
 * 2. **A route list goes stale; a reachability sweep does not.** `mutableObjectsIn` walks every
 *    object, array and map reachable from a loaded model and reports the ones that are still
 *    writable, so a field added later is covered without anyone remembering to add a case here. It
 *    carries its own negative controls: it must find a planted defect, and it must flag a raw `Map`.
 */

import * as v8 from "node:v8";

import { describe, it, expect } from "vitest";

import {
  applyComplexMap,
  applyGem,
  ingredientsOf,
  loadCodeSystem,
  loadComplexMap,
  loadConceptMap,
  loadGems,
  loadRxNormGraph,
  loadUcumEssence,
  loadValueSet,
  lookup,
  resolveNdc,
} from "../src/index.js";
import { consoRow, relRow, satNdcRow } from "./rxnorm/fixtures.js";

// ── The reachability sweep ───────────────────────────────────────────────────────────────────────

/** A map-like: what a loaded model exposes as a `ReadonlyMap`, whether or not it is a real `Map`. */
interface MapLike {
  readonly size: number;
  entries: () => IterableIterator<[unknown, unknown]>;
  get: (key: unknown) => unknown;
}

/** Is this a `Map` or a read-only view of one? Duck-typed: a view is deliberately not a `Map`. */
function isMapLike(v: object): v is MapLike {
  const c = v as Partial<MapLike> & { has?: unknown };
  return (
    typeof c.get === "function" && typeof c.entries === "function" && typeof c.size === "number"
  );
}

/**
 * Every object reachable from `root` that a holder could still write to, as `path: reason`.
 *
 * Functions are skipped (a view's own methods hold no model state), and each object is visited once.
 * A real `Map` is reported wherever it is found: `Object.freeze` cannot make one immutable, so
 * handing one out *is* the defect this suite exists for.
 */
function mutableObjectsIn(root: unknown): string[] {
  const found: string[] = [];
  const seen = new Set<object>();
  const walk = (value: unknown, path: string): void => {
    if (value === null || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);
    if (isMapLike(value)) {
      if (value instanceof Map) found.push(`${path}: a raw Map (its entries can be rewritten)`);
      else if (!Object.isFrozen(value)) found.push(`${path}: an unfrozen map view`);
      for (const [k, v] of value.entries()) walk(v, `${path}.get(${String(k)})`);
      return;
    }
    if (!Object.isFrozen(value)) found.push(`${path}: not frozen`);
    if (Array.isArray(value)) {
      for (const [i, v] of value.entries()) walk(v, `${path}[${String(i)}]`);
      return;
    }
    for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
  };
  walk(root, "$");
  return found;
}

describe("mutableObjectsIn — the sweep's own negative controls", () => {
  it("finds a planted mutable object nested inside an otherwise frozen model", () => {
    const clean = Object.freeze({ rows: Object.freeze([Object.freeze({ code: "A" })]) });
    expect(mutableObjectsIn(clean)).toEqual([]);

    const planted = Object.freeze({ rows: Object.freeze([{ code: "A" }]) });
    expect(mutableObjectsIn(planted)).toEqual(["$.rows[0]: not frozen"]);
  });

  it("flags a raw Map even when the wrapper around it is frozen — the defect's exact shape", () => {
    const wrapper = Object.freeze({ entries: new Map([["0010", Object.freeze({ t: "A000" })]]) });
    expect(mutableObjectsIn(wrapper)).toEqual([
      "$.entries: a raw Map (its entries can be rewritten)",
    ]);
  });

  it("walks through a frozen map view into its values", () => {
    const view = Object.freeze({
      size: 1,
      get: () => undefined,
      entries: () => new Map([["k", { mutable: true }]]).entries(),
    });
    expect(mutableObjectsIn(Object.freeze({ m: view }))).toEqual(["$.m.get(k): not frozen"]);
  });
});

// ── The loaded models ────────────────────────────────────────────────────────────────────────────

const GEM_CONTENT =
  "0010 A000 00000\n78900 R100 11010\n78900 R109 11020\nV290 NoDx 11000\nbadrow\n";

/** A GEM map with a 1:many combination source, a No-Map source, and a surfaced malformed row. */
function gems() {
  return loadGems({ direction: "9-to-10", version: "2018", content: GEM_CONTENT });
}

/** A complex map loaded from RF2, carrying an `IFA` rule, a category, and a surfaced bad row. */
function complexMap() {
  return loadComplexMap({
    format: "rf2",
    version: "20260131",
    content: [
      "id\tactive\treferencedComponentId\tmapGroup\tmapPriority\tmapRule\tmapAdvice\tmapTarget\tcorrelationId\tmapCategoryId",
      "1\t1\t195967001\t1\t1\tIFA 248152002 | Female (finding) |\tCONSIDER LATERALITY\tJ45.909\t447561005\t447637006",
      "2\t1\t195967001\t1\t2\tOTHERWISE TRUE\tALWAYS J45.901\tJ45.901\t447561005\t447637006",
      "3\t1\t\t\t\t\t\t\t\t",
      "",
    ].join("\n"),
  });
}

/** A drug graph with concepts, an authored ingredient edge, an NDC attribute, and a warning. */
function graph() {
  return loadRxNormGraph({
    version: "RXNORM_2026AA",
    conso: [
      consoRow({ rxcui: "1", tty: "IN", str: "lisinopril" }),
      consoRow({ rxcui: "2", tty: "SCDC", str: "lisinopril 10 MG" }),
      "|too|few|columns",
    ].join("\n"),
    rel: relRow({ subject: "2", rela: "has_ingredient", object: "1" }),
    sat: satNdcRow({ rxcui: "2", ndc: "00000000001" }),
  });
}

/** A loaded CodeSystem — the model whose concepts map used to be sealed rather than replaced. */
function codeSystem() {
  return loadCodeSystem({
    format: "fhir",
    resource: {
      resourceType: "CodeSystem",
      url: "http://example.org/cs",
      concept: [{ code: "A", display: "Alpha", property: [{ code: "p", valueString: "v" }] }],
    },
  });
}

/** A loaded ConceptMap — the `$translate` model. */
function conceptMap() {
  return loadConceptMap({
    resourceType: "ConceptMap",
    url: "http://example.org/cm",
    group: [
      {
        source: "http://example.org/cs",
        target: "http://example.org/cs2",
        element: [{ code: "A", target: [{ code: "B", equivalence: "equivalent" }] }],
      },
    ],
  });
}

/** A loaded ValueSet — compose plus a filter, so the model is not trivially shallow. */
function valueSet() {
  return loadValueSet({
    resourceType: "ValueSet",
    url: "http://example.org/vs",
    compose: {
      include: [
        {
          system: "http://example.org/cs",
          concept: [{ code: "A", display: "Alpha" }],
          filter: [{ property: "concept", op: "is-a", value: "A" }],
        },
      ],
      exclude: [{ system: "http://example.org/cs", concept: [{ code: "B" }] }],
    },
  });
}

/**
 * **Every `load*` this package exports, so the sweep cannot be true of the models it happens to
 * name.** `loadUcumEssence` is the one exception and is pinned as one rather than skipped: its two
 * lookup maps are real `Map`s whose `set` / `delete` / `clear` are replaced by a refusal, which
 * `Map.prototype.set.call` still reaches. That residual is deliberate and **bounded** — nothing in
 * `src/` outside `essence.ts` reads either map (`parseUcum` resolves an atom by scanning the frozen
 * `atoms` array), so a forced entry changes no validation, reduction or comparison, only what the
 * caller's own `get` hands back. Both halves are pinned in `test/ucum/essence-immutable.test.ts`.
 * If someone converts them, this expectation reds and the decision is taken deliberately.
 */
describe("a loaded model has nothing writable reachable from it", () => {
  it("loadGems", () => {
    expect(mutableObjectsIn(gems())).toEqual([]);
  });
  it("loadComplexMap", () => {
    expect(mutableObjectsIn(complexMap())).toEqual([]);
  });
  it("loadRxNormGraph", () => {
    expect(mutableObjectsIn(graph())).toEqual([]);
  });
  it("loadCodeSystem", () => {
    expect(mutableObjectsIn(codeSystem())).toEqual([]);
  });
  it("loadConceptMap", () => {
    expect(mutableObjectsIn(conceptMap())).toEqual([]);
  });
  it("loadValueSet", () => {
    expect(mutableObjectsIn(valueSet())).toEqual([]);
  });
  it("loadUcumEssence — the named exception, its two lookup maps and nothing else", () => {
    expect(mutableObjectsIn(loadUcumEssence())).toEqual([
      "$.atomByCode: a raw Map (its entries can be rewritten)",
      "$.prefixByCode: a raw Map (its entries can be rewritten)",
    ]);
  });
});

// ── The routes, each asserted by the reading it would have changed ────────────────────────────────

/** Call `f` and report what it threw, so a test can assert the refusal without a `try` block. */
function attempt(f: () => unknown): Error | undefined {
  try {
    f();
    return undefined;
  } catch (e) {
    return e as Error;
  }
}

/** What a caller who ignores the `ReadonlyMap` type sees: the model's index, typed as writable. */
function asWritableMap(v: unknown): Map<string, unknown> {
  return v as Map<string, unknown>;
}

describe("GemMap — a mapping cannot be deleted, and a target cannot be added", () => {
  it("refuses set/delete/clear by name, and applyGem still answers from the file", () => {
    const g = gems();
    const view = asWritableMap(g.entries);
    for (const err of [
      attempt(() => view.set("0010", [])),
      attempt(() => view.delete("0010")),
      attempt(() => view.clear()),
    ]) {
      expect(err).toBeInstanceOf(TypeError);
      expect(err?.message).toBe("Cannot mutate a loaded GEM map's entries (it is immutable)");
    }
    const r = applyGem(g, "0010");
    expect(r.mapped).toBe(true);
    expect(r.mapped && r.entries.map((e) => e.target)).toEqual(["A000"]);
  });

  it("refuses the prototype route — Map.prototype.set.call, which sealing the map does not", () => {
    const g = gems();
    const forged = [{ source: "0010", target: "Z99", flags: { raw: "00000" } }];
    for (const err of [
      attempt(() => Map.prototype.set.call(g.entries, "0010", forged)),
      attempt(() => Map.prototype.delete.call(g.entries, "0010")),
      attempt(() => Map.prototype.clear.call(g.entries)),
    ]) {
      expect(err).toBeInstanceOf(TypeError);
      expect(err?.message).toContain("incompatible receiver");
    }
    // The reading is the guarantee: no fabricated source, no deleted mapping, count intact.
    expect(applyGem(gems(), "0010")).toEqual(applyGem(g, "0010"));
    expect(g.entries.size).toBe(3);
    expect(g.count).toBe(4);
  });

  it("refuses a push into a source's candidate list, so applyGem cannot gain a target", () => {
    const g = gems();
    const list = g.entries.get("78900") ?? [];
    const forged = { source: "78900", target: "Z99.9", flags: { ...list[0]?.flags } };
    attempt(() => (list as unknown as { push: (e: unknown) => number }).push(forged));
    attempt(() => Reflect.set(list, 0, forged));
    const r = applyGem(g, "78900");
    expect(r.mapped && r.entries.map((e) => e.target)).toEqual(["R100", "R109"]);
  });

  it("refuses re-defining a read method on the view", () => {
    const g = gems();
    const err = attempt(() => Object.defineProperty(g.entries, "get", { value: () => [] }));
    expect(err).toBeInstanceOf(TypeError);
    const r = applyGem(g, "V290");
    expect(!r.mapped && r.noMap).toBe(true);
  });

  it("keeps its surfaced warnings unchanged when one is written to", () => {
    const g = gems();
    const w = g.warnings[0];
    expect(w).toBeDefined();
    attempt(() => Reflect.set(w as object, "line", 999));
    expect(g.warnings[0]?.line).toBe(5);
  });
});

describe("ComplexMap — a source's rules cannot be replaced", () => {
  it("refuses both routes, and applyComplexMap still resolves from the caller's refset", () => {
    const m = complexMap();
    const before = applyComplexMap(m, "195967001", { gender: "female" });
    const forged = [
      { source: "195967001", group: 1, priority: 1, rule: "TRUE", advice: "", target: "A00.0" },
    ];

    const named = attempt(() =>
      (m.entries as unknown as Map<string, unknown>).set("195967001", forged),
    );
    expect(named).toBeInstanceOf(TypeError);
    expect(named?.message).toBe("Cannot mutate a loaded complex map's entries (it is immutable)");

    const viaProto = attempt(() => Map.prototype.set.call(m.entries, "195967001", forged));
    expect(viaProto).toBeInstanceOf(TypeError);

    const deleted = attempt(() => Map.prototype.delete.call(m.entries, "195967001"));
    expect(deleted).toBeInstanceOf(TypeError);

    expect(applyComplexMap(m, "195967001", { gender: "female" })).toEqual(before);
    expect(m.count).toBe(2);
  });

  it("keeps its surfaced warnings unchanged when one is written to", () => {
    const m = complexMap();
    const w = m.warnings[0];
    expect(w?.line).toBe(4);
    attempt(() => Reflect.set(w as object, "detail", "rewritten"));
    expect(m.warnings[0]?.detail).toContain("referencedComponentId");
  });
});

describe("RxNormGraph — a medication's edges cannot be emptied, a concept cannot be forged", () => {
  it("refuses clearing the edges, and ingredientsOf still answers the authored edge", () => {
    const g = graph();
    const before = ingredientsOf(g, "2");
    expect(before.found && before.targets.map((t) => t.rxcui)).toEqual(["1"]);

    const named = attempt(() => (g.edges as unknown as Map<string, never>).clear());
    expect(named).toBeInstanceOf(TypeError);
    expect(named?.message).toBe("Cannot mutate a loaded RxNorm graph's edges (it is immutable)");
    expect(attempt(() => Map.prototype.clear.call(g.edges))).toBeInstanceOf(TypeError);

    expect(ingredientsOf(g, "2")).toEqual(before);
    expect(g.edgeCount).toBe(1);
  });

  it("refuses a forged concept by either route, so navigation cannot answer with one", () => {
    const g = graph();
    const forged = { rxcui: "42", tty: "IN", name: "FORGED", suppressed: false };
    expect(
      attempt(() => (g.concepts as unknown as Map<string, unknown>).set("42", forged)),
    ).toBeInstanceOf(TypeError);
    expect(attempt(() => Map.prototype.set.call(g.concepts, "42", forged))).toBeInstanceOf(
      TypeError,
    );
    expect(g.concepts.get("42")).toBeUndefined();
    expect(g.conceptCount).toBe(2);
  });

  it("refuses a forged edge pushed into an authored edge list", () => {
    const g = graph();
    const edges = g.edges.get("2") ?? [];
    attempt(() =>
      (edges as unknown as { push: (e: unknown) => number }).push({
        subject: "2",
        predicate: "has_ingredient",
        object: "42",
      }),
    );
    const r = ingredientsOf(g, "2");
    expect(r.found && r.targets.map((t) => t.rxcui)).toEqual(["1"]);
  });

  it("refuses a forged NDC mapping by either route", () => {
    const g = graph();
    expect(resolveNdc(g, "00000000001").resolved).toBe(true);
    const forged = { rxcui: "42", status: "active" as const };
    expect(
      attempt(() => (g.ndcs as unknown as Map<string, unknown>).set("00000000002", forged)),
    ).toBeInstanceOf(TypeError);
    expect(attempt(() => Map.prototype.set.call(g.ndcs, "00000000002", forged))).toBeInstanceOf(
      TypeError,
    );
    const r = resolveNdc(g, "00000000002");
    expect(r.resolved).toBe(false);
    expect(!r.resolved && r.code).toBe("TERM_RXNORM_NDC_UNMAPPED");
  });
});

describe("CodeSystem — a fabricated concept cannot be injected past never-fabricate", () => {
  it("refuses both routes, and lookup still reports the code unknown", () => {
    const cs = codeSystem();
    const forged = { code: "EVIL", display: "Fabricated", properties: [] };
    const named = attempt(() =>
      (cs.concepts as unknown as Map<string, unknown>).set("EVIL", forged),
    );
    expect(named).toBeInstanceOf(TypeError);
    expect(named?.message).toBe(
      "Cannot mutate a loaded CodeSystem's concepts map (it is immutable)",
    );
    expect(attempt(() => Map.prototype.set.call(cs.concepts, "EVIL", forged))).toBeInstanceOf(
      TypeError,
    );
    const r = lookup(cs, "EVIL");
    expect(r.found).toBe(false);
    expect(cs.count).toBe(1);
  });
});

// ── The view reads exactly as the map it replaced ────────────────────────────────────────────────

describe("a read-only view behaves as the Map it replaced, for every read", () => {
  it("supports get/has/size/keys/values/entries/forEach/iteration", () => {
    const g = graph();
    expect(g.concepts.size).toBe(2);
    expect(g.concepts.has("1")).toBe(true);
    expect(g.concepts.has("nope")).toBe(false);
    expect(g.concepts.get("1")?.name).toBe("lisinopril");
    expect(g.concepts.get("nope")).toBeUndefined();
    expect([...g.concepts.keys()]).toEqual(["1", "2"]);
    expect([...g.concepts.values()].map((c) => c.tty)).toEqual(["IN", "SCDC"]);
    expect([...g.concepts.entries()].map(([k]) => k)).toEqual(["1", "2"]);
    expect([...g.concepts].map(([k, v]) => `${k}=${v.tty}`)).toEqual(["1=IN", "2=SCDC"]);
    expect(new Map(g.concepts).size).toBe(2);

    const seen: string[] = [];
    g.concepts.forEach((v, k, m) => {
      seen.push(`${k}:${v.tty}:${String(m === g.concepts)}`);
    });
    expect(seen).toEqual(["1:IN:true", "2:SCDC:true"]);

    const thisArg = { tag: "ctx" };
    const tags: string[] = [];
    g.concepts.forEach(function (this: { tag: string }) {
      tags.push(this.tag);
    }, thisArg);
    expect(tags).toEqual(["ctx", "ctx"]);
  });

  it("is NOT a Map, and refuses a structured clone loudly rather than cloning to an empty one", () => {
    // The one place a view is not a drop-in for the `Map` it replaced. A loaded model can no longer
    // cross a `structuredClone` / `v8.serialize` / `worker.postMessage` boundary — and that refusal
    // is the point: the view's methods are enumerable so the clone raises on one of them. Were they
    // hidden, the clone would SUCCEED and hand back a model with empty indexes whose `conceptCount`
    // still reported the loaded figure — this defect's own shape, arriving silently.
    const g = graph();
    expect(g.concepts).not.toBeInstanceOf(Map);
    expect(Object.keys(g.concepts)).toContain("get");

    const err = attempt(() => structuredClone(g));
    expect(err).toBeDefined();
    expect(err?.name).toBe("DataCloneError");
    const viaV8 = attempt(() => v8.deserialize(v8.serialize(g)));
    expect(viaV8).toBeDefined();

    // The model itself is untouched by the failed attempt, and the entries clone fine on their own.
    expect(g.conceptCount).toBe(2);
    expect(ingredientsOf(g, "2").found).toBe(true);
    expect(structuredClone(new Map(g.concepts)).get("1")?.name).toBe("lisinopril");
  });
});
