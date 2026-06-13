# Gmail Alias Control Center

A polished, fully client-side **Alias Generator + Alias Vault + Manual Alias Creator** for Gmail.
Generate, organize, track, copy, test, export and import Gmail alias variations — for legitimate
personal, business, QA, and **authorized** testing use.

Built as a Next.js 14 app. The interface is the design handed off from Claude Design, ported into
this codebase: the dark-first SaaS shell, command palette, and all six views run entirely in the
browser with `localStorage` persistence. No build step beyond `next build`, no server, no account.

Default base inbox: **`europcarco69@gmail.com`** (change it anytime in the Generator or Settings).

---

## ⚖️ How Gmail aliases work — and why dots matter

Gmail aliases are **not separate inboxes** — they're variations of one address that all deliver to
the same account:

- **Plus-addressing** — `europcarco69+amazon@gmail.com`, `europcarco69+netflix@gmail.com`
- **Dot-spellings** — `e.urop.carco69@gmail.com` (Gmail ignores dots)

Every alias still lands in `europcarco69@gmail.com`. They're for organising, filtering, and seeing
where mail comes from.

> **Dots survive strict validators; the `+` often does not.** Many signup forms reject
> plus-addresses as "invalid" (the trigger for this tool was a rental-management system rejecting
> `handle+1@gmail.com`). Dot-spellings route to the identical inbox **and** pass those same
> validators — so the app foregrounds dots as the validator-safe fallback and flags the `+`
> caveat in the Generator and the first-run compliance gate.

This tool deliberately does **NOT** include account-creation automation, mass registration,
rate-limit/CAPTCHA bypass, anti-detection, fingerprint spoofing, proxy rotation, or any evasion
behavior. The Safe Tester is limited to **syntax validation** and a **local sandbox**. **Only test
against domains you own or are authorized to test, and never use aliases for spam, abuse, or
breaking a site's rules.**

---

## Features

**Generator** — three modes of creation:
- **Auto generate** — Number, Service, Campaign, Random, Date, Dots, and Hybrid modes; amount,
  starting number, prefix/suffix labels, optional dot variations, auto-save, live preview with
  per-alias select/copy.
- **Manual creator** — type a label (`amazon`, `booking2026`, `test-client`), get a validated alias
  with a live preview, naming tips, note templates, duplicate detection, and Save / Save & copy /
  Save & mark used / Save as favorite.
- **Smart sets** — one-click preset packs (Shopping, Social Media, Streaming, Travel, Business,
  Testing, Newsletter, Privacy) plus a Smart Suggestions list (click to save & copy).

**Alias Vault** — dashboard cards (total / generated today / copied today / unused / favorites /
archived), search, filter (status, category, tag, inbox, favorites), sort, pinning, favorites,
health indicator, inline edit, duplicate, bulk actions (copy, favorite, mark used, reserve, set
category, tag, archive, block, export, delete), and pagination.

**Safe Tester** — syntax + local-sandbox simulation (offline) and an authorized-URL safety pre-flight.

**Export / Import** — CSV / JSON / TXT by scope (all, filtered, selected, unused, copied, favorites,
by tag, by base). CSV columns:
`Alias, Base Email, Label, Category, Tags, Status, Notes, Created At, Last Copied At, Copied Count`.
Import with new / duplicate / invalid preview.

**Analytics** — copy spotlight (last & most copied), by-status & by-category breakdowns, top tags,
recently copied, and an activity log.

**Settings** — base inbox, accent/theme/density, generation defaults, categories manager, safety
limits, authorized domains, backup / restore / reset.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `⌘K` / `Ctrl K` | Command menu |
| `G` | Generate aliases |
| `⇧G` | Generate smart set (all packs) |
| `N` | Create manual alias |
| `C` | Copy latest alias |
| `S` / `⌘S` | Save current alias |
| `⌘E` | Export all (CSV) |
| `/` | Focus vault search |
| `Esc` | Close dialog / palette |

---

## Statuses & categories

Statuses: `New · Saved · Copied · Used · Reserved · Archived · Blocked`
Categories: `Shopping · Streaming · Social Media · Travel · Work · Testing · Signups · Marketing ·
Spam Control · Custom` (add your own in Settings)

### Alias record shape
```
{ id, baseEmail, alias, pattern, label, category, status, notes, tags[],
  favorite, pinned, createdAt, copiedAt, copiedCount, lastUsedAt }
```

---

## Data & privacy

- **Storage:** local to your browser (`localStorage`, key `gacc:v1`). Data never leaves your device.
- **Persisted:** base inbox, aliases, copy history, activity, tags, categories, settings, last-used.
- **Backup / restore:** Settings → Download / Restore backup (full JSON snapshot).
- **Reset:** Settings → Reset all data.

---

## Architecture

The interactive app is a self-contained vanilla module set (`window.GACC`) ported from the design
handoff and served as a single bundled static asset. A thin React client component renders the shell
markup once and mounts the bundle after hydration — so the visual output is pixel-faithful to the
design while the project remains a standard, Vercel-deployable Next.js app.

```
src/app/
  layout.tsx              # fonts (Manrope + JetBrains Mono), metadata, default theme
  globals.css             # the design's full token system + a11y (focus, reduced motion)
  page.tsx                # renders <AliasControlCenter/>
src/components/
  AliasControlCenter.tsx  # "use client" — shell markup + mounts the bundled app
public/console/
  app.js                  # bundled app: logic, store, icons, exporter, ui, and the 6 views
```

The bundled `app.js` is concatenated, in dependency order, from the design's modules:
`logic` (generation modes, smart sets, validation, templating, export/import, tester) ·
`store` (reactive state + localStorage) · `icons` · `exporter` · `ui` (shell, router, toasts,
dialogs, command palette, shortcuts) · `views/` (generator, registry, tester, data, analytics,
settings).

## Develop

```bash
npm install
npm run build      # must pass with zero type errors
npm run dev        # http://localhost:3000
```

## Stack

Next.js 14 (App Router) · TypeScript · plain CSS (design tokens) · Google Fonts
(Manrope + JetBrains Mono). No UI kit, no state library, inline SVG icons.

---

**Authorized use only — test only on systems you own or are permitted to test.**
