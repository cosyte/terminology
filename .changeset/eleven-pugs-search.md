---
"@cosyte/terminology": patch
---

Repository tooling: the PHI sweep now reads the bytes git carries, as a union with its working-tree walk.

The walk answers what is on disk under the scan roots. What a commit carries is the index, and where the two disagree the walk was the only voice. Three states were measured on a clone laid out like this repository, each printing the clean line and exiting 0 over a tracked file whose blob held a detectable payload: the working tree short of a tracked file, the path occupied by a directory, and the two copies simply differing, which is what staging content and then scrubbing the file leaves behind. The middle one is the reason the sweep reads the object rather than re-reading the path: `git ls-files` still names the path and the walk descends into the directory standing there, so a path-set reconciliation agrees the path is accounted for while the blob is never opened.

The whole index is read with `git ls-files -s -z` and every in-scope tracked path whose stage-0 blob the walk did not already read verbatim is scanned through `git cat-file blob`. It is a union and never a replacement: the walk still runs first and still reads untracked files, which the index cannot name. Deduplication is by content under git's own blob framing, so a clean checkout adds zero reads and invokes `cat-file` not at all, measured here with a logging git on the path; where the two copies differ both are scanned, which is what makes it correct under end-of-line normalization rather than merely untested by it. A hit found only in the index is labelled as such, because a hit naming the bare path sends a reader to open a file that is clean or not there.

Five things a port must re-derive were re-derived here rather than inherited, and they are written down: the exit codes, the roots and their exclusions, the pre-commit route's own narrower scope, the modes the index records by reference, and end-of-line normalization. The union is keyed on the absence of stage 0, which cannot be ported from the pre-commit route: an unmerged path is reported at stages 1, 2 and 3 with ordinary blob modes, and a draft elsewhere that took the first record scanned the merge base and reported clean over a marker living only in the third stage. A fixture puts the payload in stage 3 alone, so any other choice reads clean and fails the case.

The sweep refuses when git cannot name the index or names it empty, because a sweep with no index is the walk's word alone. Those are two different routes to the same refusal and both are needed: outside a repository the command exits 128 rather than answering empty, so the surrounding catch is what keeps the run off the exit code this scanner reserves for findings.

It does not vouch for a scan root. Root starvation is still decided by the walk alone, so a root that is absent, dangling or empty still refuses even when every tracked blob under it was read: the two rules make different claims and neither substitutes for the other. The completeness rules that were already here are unchanged, and the tracked paths the union may read are folded into what the run enumerates before the first byte is read, so even a union producing no targets cannot let the sweep report clean over one.

No change to the published package.
