# State transition guide

Start with [Wayfare](WAYFARE.md) or [Ariyoo](ARIYOO.md). These inventories describe active frontend, backend, persisted and native lifecycles, their owners, guards, implemented fixes and unresolved transitions. [source-index.json](source-index.json) supplies reproducible file/line evidence for review.

Use explicit typed states when multiple flags must agree. Keep independent fields local. Server authorization and persisted rules remain authoritative. Do not convert every boolean to a framework or silently change storage/API formats.

For any changed transition, document its event, guard, owner, side effect, success/failure outcome, retry/cancellation behavior and scope (account/resource/attempt). Test failure, overlapping requests and stale completion when relevant. Never log credentials, chat content or precise location as transition diagnostics.

Regenerate evidence with `node scripts/state-index.mjs`; verify with `node scripts/state-index.mjs --check`. The scan highlights candidate code; human review identifies machines. It cannot prove that all runtime state machines have been found.
