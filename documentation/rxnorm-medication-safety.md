**Relocated out of `CLAUDE.md`, verbatim, to keep that always-read file small.** Nothing was
deleted, reworded or reordered: `CLAUDE.md` keeps the heading below and points here at the place the
section left. The long form of each trap is in `agent-notes.md`, as it always was.

### RxNorm (medication safety)

Four traps, every one clinical and measured. **Read the pointed-at section first, and never
re-derive one from the shape of the code.**

- **The edge-direction convention is pinned per relation family, forward _and_ reverse**, in
  `test/rxnorm/direction.test.ts` (`RELA` is what `RXCUI2` is to `RXCUI1`; normalized
  `subject=RXCUI2, object=RXCUI1`, grounded on NLM RxNorm Technical Documentation §12.7). **The
  authored topology is NOT the obvious one, and the pinned fixtures are the only thing that knows
  it. The property suite CANNOT catch an inversion**, so never weaken them on that ground. Why:
  `agent-notes.md#the-rxnorm-edge-direction-convention-and-the-authored-topology`
- **A concept is typed by a DEFINING atom, and the vocabulary is the FULL Appendix 5 one.** A
  synonym atom types a _name_, never a concept; an `RXCUI` no defining atom could type is
  **skipped** and surfaced as `TERM_RXNORM_UNTYPED_CONCEPT` rather than typed from a synonym. Why:
  `agent-notes.md#a-concept-is-typed-by-a-defining-atom`
- **The PRECISE forms do not behave like their siblings**, per relation: do not write `SCDFP`'s
  basis-of-strength edge down as "the `PIN`", and do not assume `SBDFP` or `SCDGP` author an
  ingredient-bearing edge at all. **`ingredientsOf` deliberately does not follow `has_boss`**. Why:
  `agent-notes.md#the-precise-forms-do-not-behave-like-their-siblings`
- **Never write the pairings down as a closed set, and never name a term type you have not checked**:
  verify on RxNav first. **Reaching an active ingredient is not one recipe.** Why:
  `agent-notes.md#do-not-write-the-rxnorm-pairings-down-as-a-closed-set`
