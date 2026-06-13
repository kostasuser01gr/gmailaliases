# Gmail Alias Control Center

A single-page operator tool that turns **one** Gmail handle into **many** addresses that
all reach the **same** inbox — and maps records ↔ aliases for inbound reconciliation.

No backend, no database, no auth. All logic runs client-side.

## Why dots, not `+tag`

Gmail ignores **dots** in the local part: every dotted form of a handle routes to the same
inbox. `handle.1@gmail.com`, `h.andle1@gmail.com`, and `handle1@gmail.com` are one mailbox.

A `+tag` (`handle+1@gmail.com`) is *also* ignored for routing — but it is frequently
**rejected by strict email validators**. The production trigger for this tool was a
rental-management system rejecting `handle+1@gmail.com` as "not valid". Dots survive those
validators; the plus does not.

So **dots are the default** here, and **plus mode is a documented fallback** with a visible
caveat.

## How the encoding works

A handle of length `n` has `n − 1` gaps between characters. A dot pattern is a **bitmask**:
bit `i` set means a dot after character `i`. This is a bijection over `[0, 2^(n-1))`.

- `2^(n-1)` total patterns.
- With `noConsecutive` (the default — Gmail won't create `a..b` accounts and some validators
  reject them), the count is `Fibonacci(n + 1)`.

For `europcarco69` (12 chars): **2048** total, **233** with `noConsecutive`.

## Panels

1. **Generate** — handle, domain, **Dots | Plus** mode, `noConsecutive` toggle, result
   limit, shuffle. Shows the total variant count, a list of aliases (copy-one), and copy-all.
   The "collapse" visualization pins the one destination inbox at the top and highlights the
   dots in each row, making it obvious every address is the same mailbox.
2. **Tag a record** — a record key (e.g. an RA number) → a **stable** address via
   `aliasForKey`. Same key returns the same address forever. Shows the equivalent `+tag` to
   compare.
3. **Trace an address** — paste any inbound address → canonical inbox, recovered mask, and a
   pass/fail "same inbox as handle?" check.
4. **⌘K command palette** — focus handle, switch mode, copy all, toggle `noConsecutive`.
   Opens on ⌘K / Ctrl-K, closes on Esc.

## Reconciliation workflow

When a record is created, assign it a stable alias and store the mapping:

```ts
import { aliasForKey, dottedToMask } from "@/lib/aliases";

const alias = aliasForKey("europcarco69", recordId);   // e.g. "europ.carco69@gmail.com"
store.set(alias.mask, recordId);                        // persist mask ↔ recordId
```

Gmail preserves the dotted form the **sender** used in `To` / `Delivered-To`. On inbound
mail, recover the pattern and match back to the record:

```ts
const mask = dottedToMask(message.deliveredTo);         // recover the pattern
const recordId = store.get(mask);                       // identify the record
```

Because the mask is stable and the dotted form survives validators, the round-trip is exact.

## Domain logic

All logic lives in [`src/lib/aliases.ts`](src/lib/aliases.ts):

- `canonicalize` / `sameInbox` / `isGmail` — normalize and compare inboxes.
- `maskToDotted` / `dottedToMask` — encode and recover dot patterns.
- `validMasks` / `variantCount` — enumerate / count patterns.
- `generateAliases` — list aliases (with deterministic shuffle + limit).
- `aliasForKey` — stable address per record key (FNV-1a hash → mask).
- `plusAlias` — the `+tag` fallback.

## Develop

```bash
npm install
npm run build      # must pass with zero type errors
npm run dev        # http://localhost:3000
```

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS v3 · `next/font/google`
(Space Grotesk + IBM Plex Mono). No UI kit, no state library, inline SVG icons.

---

**Authorized use only — test only on systems you own or are permitted to test.**
