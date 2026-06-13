"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  aliasForKey,
  canonicalize,
  dottedToMask,
  generateAliases,
  isGmail,
  maskToDotted,
  plusAlias,
  sameInbox,
  variantCount,
  type GeneratedAlias,
} from "@/lib/aliases";

type Mode = "dots" | "plus";

const DEFAULT_HANDLE = "europcarco69";
const DEFAULT_DOMAIN = "gmail.com";

/* ----------------------------------------------------------------- icons */

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5.25" y="5.25" width="8" height="8" rx="1.25" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3.25 10.75H2.75A1 1 0 0 1 1.75 9.75V2.75A1 1 0 0 1 2.75 1.75H9.75A1 1 0 0 1 10.75 2.75V3.25" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5 6.25 11.75 13 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 20 14" fill="none" aria-hidden="true">
      <path d="M1 7h17M13 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* --------------------------------------------------------------- helpers */

/** Render a dotted local part with every dot painted in the signal tint,
 *  making "one inbox, many forms" visible at a glance. */
function DottedLocal({ local }: { local: string }) {
  return (
    <span className="font-mono">
      {local.split("").map((ch, i) =>
        ch === "." ? (
          <span key={i} className="font-medium text-signal-bright">
            .
          </span>
        ) : (
          <span key={i}>{ch}</span>
        )
      )}
    </span>
  );
}

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback((text: string, key: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiedKey(null), 1400);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { copiedKey, copy };
}

function CopyButton({
  text,
  copyKey,
  copiedKey,
  onCopy,
  label = "Copy",
}: {
  text: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  label?: string;
}) {
  const copied = copiedKey === copyKey;
  return (
    <button
      type="button"
      onClick={() => onCopy(text, copyKey)}
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium transition-colors ${
        copied ? "text-signal" : "text-muted hover:text-ink"
      }`}
      aria-label={copied ? "Copied" : `${label} ${text}`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copied" : label}
    </button>
  );
}

/* --------------------------------------------------------- field shells */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

function Toggle({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium border transition-colors ${
        pressed
          ? "border-signal bg-signal text-white"
          : "border-hairline text-muted hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

const inputClass =
  "mt-1.5 w-full border border-hairline bg-white/60 px-3 py-2 font-mono text-sm text-ink placeholder:text-muted/60 focus:border-signal focus:outline-none";

/* ============================================================= component */

export default function AliasConsole() {
  const [handle, setHandle] = useState(DEFAULT_HANDLE);
  const [domain, setDomain] = useState(DEFAULT_DOMAIN);
  const [mode, setMode] = useState<Mode>("dots");
  const [noConsecutive, setNoConsecutive] = useState(true);
  const [limit, setLimit] = useState(24);
  const [shuffle, setShuffle] = useState(false);
  const [revealKey, setRevealKey] = useState(0);

  const handleRef = useRef<HTMLInputElement>(null);
  const { copiedKey, copy } = useCopy();

  const canonical = useMemo(() => canonicalize(handle), [handle]);
  const destination = canonical ? `${canonical}@${domain}` : "";
  const total = useMemo(
    () => (canonical ? variantCount(handle, { noConsecutive }) : 0),
    [handle, canonical, noConsecutive]
  );

  const aliases: GeneratedAlias[] = useMemo(() => {
    if (!canonical) return [];
    if (mode === "plus") return [];
    return generateAliases(handle, {
      domain,
      noConsecutive,
      limit,
      shuffle,
      seed: 1,
    });
  }, [handle, canonical, domain, noConsecutive, limit, shuffle, mode]);

  // Re-trigger the staggered reveal whenever the result set changes.
  useEffect(() => {
    setRevealKey((k) => k + 1);
  }, [aliases]);

  const copyAll = useCallback(() => {
    if (!aliases.length) return;
    copy(aliases.map((a) => a.email).join("\n"), "all");
  }, [aliases, copy]);

  /* ----------------------------------------------------- command palette */

  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commands = useMemo(
    () => [
      {
        id: "focus",
        label: "Focus handle",
        hint: "Edit the source address",
        run: () => {
          handleRef.current?.focus();
          handleRef.current?.select();
        },
      },
      {
        id: "mode",
        label: mode === "dots" ? "Switch to plus mode" : "Switch to dots mode",
        hint: "Dots survive strict validators",
        run: () => setMode((m) => (m === "dots" ? "plus" : "dots")),
      },
      {
        id: "copyall",
        label: "Copy all addresses",
        hint: `${aliases.length} on screen`,
        run: () => copyAll(),
      },
      {
        id: "noconsec",
        label: noConsecutive
          ? "Allow consecutive dots"
          : "Disallow consecutive dots",
        hint: "Toggle a..b patterns",
        run: () => setNoConsecutive((v) => !v),
      },
    ],
    [mode, noConsecutive, aliases.length, copyAll]
  );

  /* ---------------------------------------------------------- tag record */

  const [recordKey, setRecordKey] = useState("RNT003-65144");
  const tagged = useMemo(
    () =>
      canonical && recordKey.trim()
        ? aliasForKey(handle, recordKey.trim(), { domain, noConsecutive })
        : null,
    [handle, canonical, recordKey, domain, noConsecutive]
  );
  const taggedPlus = useMemo(
    () =>
      canonical && recordKey.trim()
        ? plusAlias(handle, recordKey.trim(), domain)
        : null,
    [handle, canonical, recordKey, domain]
  );

  /* ------------------------------------------------------------- tracing */

  const [trace, setTrace] = useState("e.urop.carco69@gmail.com");
  const traced = useMemo(() => {
    const value = trace.trim();
    if (!value) return null;
    const inbox = canonicalize(value);
    const mask = dottedToMask(value);
    const matches = canonical ? sameInbox(value, handle) : false;
    return {
      inbox: inbox ? `${inbox}@${domain}` : "—",
      mask,
      dotted: inbox ? maskToDotted(inbox, mask) : "—",
      matches,
      gmail: isGmail(value),
    };
  }, [trace, handle, canonical, domain]);

  /* ----------------------------------------------------------------- render */

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 pb-24 pt-10 sm:px-8">
      {/* header */}
      <header className="mb-8">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Gmail Alias Control Center
          </h1>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden shrink-0 items-center gap-1.5 border border-hairline px-2 py-1 font-mono text-xs text-muted hover:border-ink hover:text-ink sm:inline-flex"
          >
            <span>⌘K</span>
          </button>
        </div>
        <p className="mt-2 max-w-xl text-sm text-muted">
          One handle, many addresses, one inbox. Dot-aliases route the same as{" "}
          <span className="font-mono text-ink">+tag</span> but survive strict
          validators that reject the plus.
        </p>
      </header>

      {/* the collapse — fixed destination pinned at top */}
      <section className="mb-10 border border-hairline bg-white/40">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Everything routes here
          </span>
          <span className="font-mono text-xs text-signal">
            {total.toLocaleString()} variants
          </span>
        </div>
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="text-signal">
            <ArrowIcon />
          </span>
          <span className="font-mono text-base font-medium text-ink sm:text-lg">
            {destination || "—"}
          </span>
        </div>
      </section>

      {/* generate */}
      <section className="mb-12">
        <h2 className="mb-4 font-display text-lg font-medium">Generate</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Handle">
            <input
              ref={handleRef}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              spellCheck={false}
              autoCapitalize="none"
              className={inputClass}
              placeholder="europcarco69"
            />
          </Field>
          <Field label="Domain">
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              spellCheck={false}
              autoCapitalize="none"
              className={inputClass}
              placeholder="gmail.com"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-muted">
              Mode
            </span>
            <div className="mt-1.5 inline-flex">
              <Toggle pressed={mode === "dots"} onClick={() => setMode("dots")}>
                Dots
              </Toggle>
              <Toggle pressed={mode === "plus"} onClick={() => setMode("plus")}>
                Plus
              </Toggle>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-muted">
              No consecutive dots
            </span>
            <div className="mt-1.5">
              <Toggle
                pressed={noConsecutive}
                onClick={() => setNoConsecutive((v) => !v)}
              >
                {noConsecutive ? "On" : "Off"}
              </Toggle>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium uppercase tracking-wide text-muted">
              Shuffle
            </span>
            <div className="mt-1.5">
              <Toggle pressed={shuffle} onClick={() => setShuffle((v) => !v)}>
                {shuffle ? "On" : "Off"}
              </Toggle>
            </div>
          </div>

          <Field label="Limit">
            <input
              type="number"
              min={1}
              max={1024}
              value={limit}
              onChange={(e) =>
                setLimit(Math.max(1, Math.min(1024, Number(e.target.value) || 1)))
              }
              className={`${inputClass} w-24`}
            />
          </Field>
        </div>

        {mode === "plus" ? (
          <div className="mt-6 border border-hairline bg-white/40">
            <div className="border-b border-hairline px-4 py-2 text-xs text-warn">
              Plus mode — strict validators frequently reject the{" "}
              <span className="font-mono">+</span>. Use dots when a form refuses
              this address.
            </div>
            <PlusPreview
              handle={handle}
              domain={domain}
              copiedKey={copiedKey}
              onCopy={copy}
            />
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs text-muted">
                Showing {aliases.length} of {total.toLocaleString()}
              </span>
              <CopyButton
                text={aliases.map((a) => a.email).join("\n")}
                copyKey="all"
                copiedKey={copiedKey}
                onCopy={copy}
                label="Copy all"
              />
            </div>

            <ol key={revealKey} className="mt-2 border-t border-hairline">
              {aliases.map((a, i) => (
                <li
                  key={a.mask}
                  className="alias-reveal flex items-center gap-3 border-b border-hairline px-1 py-2.5"
                  style={{ animationDelay: `${Math.min(i, 24) * 18}ms` }}
                >
                  <span className="w-7 shrink-0 text-right font-mono text-xs text-muted">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <DottedLocal local={a.local} />
                    <span className="text-muted">@{domain}</span>
                  </span>
                  <span className="hidden text-muted sm:inline">
                    <ArrowIcon />
                  </span>
                  <span className="hidden shrink-0 font-mono text-xs text-signal sm:inline">
                    one inbox
                  </span>
                  <CopyButton
                    text={a.email}
                    copyKey={`a-${a.mask}`}
                    copiedKey={copiedKey}
                    onCopy={copy}
                  />
                </li>
              ))}
              {aliases.length === 0 ? (
                <li className="px-1 py-3 text-sm text-muted">
                  Enter a handle to generate aliases.
                </li>
              ) : null}
            </ol>
          </>
        )}
      </section>

      {/* tag a record */}
      <section className="mb-12">
        <h2 className="mb-1 font-display text-lg font-medium">Tag a record</h2>
        <p className="mb-4 text-sm text-muted">
          One stable address per record key — same key returns the same address
          forever.
        </p>

        <Field label="Record key" hint="e.g. an RA number">
          <input
            value={recordKey}
            onChange={(e) => setRecordKey(e.target.value)}
            spellCheck={false}
            className={inputClass}
            placeholder="RNT003-65144"
          />
        </Field>

        {tagged ? (
          <div className="mt-4 border border-hairline bg-white/40">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-sm">
                <DottedLocal local={tagged.local} />
                <span className="text-muted">@{domain}</span>
              </span>
              <CopyButton
                text={tagged.email}
                copyKey="tagged"
                copiedKey={copiedKey}
                onCopy={copy}
              />
            </div>
            {taggedPlus ? (
              <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">
                  {taggedPlus.email}
                </span>
                <span className="shrink-0 text-xs text-warn">+ may be rejected</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* trace an address */}
      <section className="mb-12">
        <h2 className="mb-1 font-display text-lg font-medium">Trace an address</h2>
        <p className="mb-4 text-sm text-muted">
          Paste any inbound address to recover its inbox and dot pattern.
        </p>

        <Field label="Address">
          <input
            value={trace}
            onChange={(e) => setTrace(e.target.value)}
            spellCheck={false}
            autoCapitalize="none"
            className={inputClass}
            placeholder="e.urop.carco69@gmail.com"
          />
        </Field>

        {traced ? (
          <dl className="mt-4 border border-hairline bg-white/40">
            <Row label="Canonical inbox">
              <span className="font-mono text-sm">{traced.inbox}</span>
            </Row>
            <Row label="Recovered mask">
              <span className="font-mono text-sm">{traced.mask}</span>
            </Row>
            <Row label="Normalized form">
              <span className="text-sm">
                <DottedLocal local={traced.dotted} />
              </span>
            </Row>
            <Row label="Same inbox as handle?">
              {traced.matches ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-sm text-signal">
                  <CheckIcon /> pass
                </span>
              ) : (
                <span className="font-mono text-sm text-warn">fail</span>
              )}
            </Row>
          </dl>
        ) : null}
      </section>

      {/* footer */}
      <footer className="border-t border-hairline pt-5 text-xs text-muted">
        Authorized use only — test only on systems you own or are permitted to
        test.
      </footer>

      {/* command palette */}
      {paletteOpen ? (
        <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />
      ) : null}
    </main>
  );
}

/* ----------------------------------------------------------- sub-pieces */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
    </div>
  );
}

function PlusPreview({
  handle,
  domain,
  copiedKey,
  onCopy,
}: {
  handle: string;
  domain: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const [tag, setTag] = useState("rnt003");
  const canonical = canonicalize(handle);
  if (!canonical) {
    return (
      <div className="px-4 py-3 text-sm text-muted">Enter a handle.</div>
    );
  }
  const alias = plusAlias(handle, tag || "tag", domain);
  return (
    <div className="px-4 py-3">
      <Field label="Tag">
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          spellCheck={false}
          autoCapitalize="none"
          className={inputClass}
          placeholder="rnt003"
        />
      </Field>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate font-mono text-sm">
          {alias.email}
        </span>
        <CopyButton
          text={alias.email}
          copyKey="plus"
          copiedKey={copiedKey}
          onCopy={onCopy}
        />
      </div>
    </div>
  );
}

function CommandPalette({
  commands,
  onClose,
}: {
  commands: { id: string; label: string; hint: string; run: () => void }[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const fire = useCallback(
    (i: number) => {
      const cmd = filtered[i];
      if (!cmd) return;
      cmd.run();
      onClose();
    },
    [filtered, onClose]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 px-4 pt-[12vh]"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-md border border-hairline bg-surface shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command…"
          className="w-full border-b border-hairline bg-transparent px-4 py-3 font-mono text-sm text-ink placeholder:text-muted/60 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              fire(active);
            }
          }}
        />
        <ul className="max-h-72 overflow-y-auto py-1">
          {filtered.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => fire(i)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left ${
                  i === active ? "bg-signal text-white" : "text-ink"
                }`}
              >
                <span className="text-sm font-medium">{c.label}</span>
                <span
                  className={`text-xs ${
                    i === active ? "text-white/80" : "text-muted"
                  }`}
                >
                  {c.hint}
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No commands.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
