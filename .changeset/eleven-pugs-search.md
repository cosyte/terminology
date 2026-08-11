---
"@cosyte/terminology": patch
---

Repository tooling: the PHI sweep now reads the bytes git carries, as a union with its working-tree walk.

The walk answers what is on disk under the scan roots. What a commit carries is the index, and where the two disagree the walk was the only voice. Three ordinary states were measured on a clone at the base of this change, with a detectable payload tracked at the path: the working tree short of a tracked file, the path occupied by a directory, and the two copies simply differing, which is what staging content and then scrubbing the file leaves behind.

Only the third printed the clean line and exited 0. The other two already refused, because this repository, unlike the carrier this machinery is shared with, already reconciled the sweep against `git ls-files` and could tell that a tracked file had gone unread. So the union closes one false green and upgrades the other two from "this sweep cannot account for a tracked file" to a report of what is actually in it. Both are worth having and they are not the same thing; the sizing is written down because a first draft of it called all three false greens, which is the sibling's number and not this one's.

The whole index is read with `git ls-files -s -z` and every in-scope tracked path whose stage-0 blob the walk did not already read verbatim is scanned through `git cat-file blob`. It is a union and never a replacement: the walk still runs first and still reads untracked files, which the index cannot name. Reading the object rather than re-reading the path is what makes the directory case readable at all, since the path does not resolve to a file there. Deduplication is by content under git's own blob framing, so a clean checkout adds zero reads and invokes `cat-file` not at all, measured here with a logging git on the path; where the two copies differ both are scanned, which is what makes it correct under end-of-line normalization rather than merely untested by it. A hit found only in the index is labelled as such, because a hit naming the bare path sends a reader to open a file that is clean or not there.

Five things a port must re-derive were re-derived here rather than inherited, and they are written down: the exit codes, the roots and their exclusions, the pre-commit route's own narrower scope, the modes the index records by reference, and end-of-line normalization. The union is keyed on the absence of stage 0, which cannot be ported from the pre-commit route: an unmerged path is reported at stages 1, 2 and 3 with ordinary blob modes, and a draft elsewhere that took the first record scanned the merge base and reported clean over a marker living only in the third stage. A fixture puts the payload in stage 3 alone, so any other choice reads clean and fails the case.

The sweep refuses when git cannot name the index or names it empty, because a sweep with no index is the walk's word alone. Those are two different routes to the same refusal and both are needed: outside a repository the command exits 128 rather than answering empty, so the surrounding catch is what keeps the run off the exit code this scanner reserves for findings.

It does not vouch for a scan root. Root starvation is still decided by the walk alone, so a root that is absent, dangling or empty still refuses even when every tracked blob under it was read: the two rules make different claims and neither substitutes for the other. The completeness rules that were already here are unchanged, and the tracked paths the union may read are folded into what the run enumerates before the first byte is read, so even a union producing no targets cannot let the sweep report clean over one.

Two residuals are unchanged and are recorded rather than implied: a tracked markdown file under a scan root is read by neither route, and the one source whose job is to carry violator literals is still exempted at the scan. Reading more bytes is not reading for more shapes, so a green sweep still means no SSN or email shapes were found, never that there is no PHI.

No change to the published package.
