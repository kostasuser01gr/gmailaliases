export interface DotAliasOptions {
  /** Disallow consecutive dots ("a..b"). Gmail won't create such accounts and some
   *  validators reject them. Default true. */
  noConsecutive?: boolean;
}

export interface GeneratedAlias {
  local: string;   // dotted local part, e.g. "europ.carco69"
  email: string;   // full address
  mask: number;    // dot pattern
}

const GMAIL_DOMAINS = ["gmail.com", "googlemail.com"];

/** Strip domain, +tag, and dots; lowercase. All variants of one inbox map to this. */
export function canonicalize(input: string): string {
  let local = input.trim().toLowerCase();
  const at = local.indexOf("@");
  if (at !== -1) local = local.slice(0, at);
  const plus = local.indexOf("+");
  if (plus !== -1) local = local.slice(0, plus);
  return local.replace(/\./g, "");
}

export function sameInbox(a: string, b: string): boolean {
  return canonicalize(a) === canonicalize(b);
}

export function isGmail(address: string): boolean {
  const at = address.indexOf("@");
  if (at === -1) return false;
  return GMAIL_DOMAINS.includes(address.slice(at + 1).trim().toLowerCase());
}

/** bit i => dot after char i */
export function maskToDotted(local: string, mask: number): string {
  let out = "";
  for (let i = 0; i < local.length; i++) {
    out += local[i];
    if (i < local.length - 1 && mask & (1 << i)) out += ".";
  }
  return out;
}

/** Recover the mask from a (possibly dotted) address. Leading dots ignored;
 *  consecutive dots collapse. Use on inbound To/Delivered-To to identify the pattern. */
export function dottedToMask(address: string): number {
  let local = address.trim().toLowerCase();
  const at = local.indexOf("@");
  if (at !== -1) local = local.slice(0, at);
  const plus = local.indexOf("+");
  if (plus !== -1) local = local.slice(0, plus);
  let mask = 0, charIndex = -1;
  for (const ch of local) {
    if (ch === ".") { if (charIndex >= 0) mask |= 1 << charIndex; }
    else charIndex++;
  }
  return mask;
}

function hasConsecutiveDots(mask: number, gaps: number): boolean {
  for (let i = 0; i + 1 < gaps; i++) if (mask & (1 << i) && mask & (1 << (i + 1))) return true;
  return false;
}

/** All valid masks ascending. Count = 2^(n-1), or Fibonacci(n+1) when noConsecutive. */
export function validMasks(localLength: number, opts: DotAliasOptions = {}): number[] {
  const { noConsecutive = true } = opts;
  const gaps = Math.max(0, localLength - 1);
  const total = 2 ** gaps;
  const out: number[] = [];
  for (let m = 0; m < total; m++) {
    if (noConsecutive && hasConsecutiveDots(m, gaps)) continue;
    out.push(m);
  }
  return out;
}

export function variantCount(input: string, opts: DotAliasOptions = {}): number {
  return validMasks(canonicalize(input).length, opts).length;
}

/* FNV-1a 32-bit — stable across runs/platforms. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/* Deterministic xorshift32 shuffle so "give me N" is reproducible. */
function shuffleDeterministic<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = (seed >>> 0) || 1;
  const rand = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 0xffffffff; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export interface GenerateOptions extends DotAliasOptions {
  domain?: string; limit?: number; shuffle?: boolean; seed?: number;
}

export function generateAliases(input: string, opts: GenerateOptions = {}): GeneratedAlias[] {
  const { domain = "gmail.com", limit, shuffle = false, seed = 1, ...dot } = opts;
  const local = canonicalize(input);
  let masks = validMasks(local.length, dot);
  if (shuffle) masks = shuffleDeterministic(masks, seed);
  if (limit != null) masks = masks.slice(0, limit);
  return masks.map((mask) => {
    const dotted = maskToDotted(local, mask);
    return { local: dotted, email: `${dotted}@${domain}`, mask };
  });
}

/** Stable alias for a record key (e.g. an RA #). Same key => same address forever. */
export function aliasForKey(input: string, key: string,
  opts: DotAliasOptions & { domain?: string } = {}): GeneratedAlias {
  const { domain = "gmail.com", ...dot } = opts;
  const local = canonicalize(input);
  const masks = validMasks(local.length, dot);
  const mask = masks[hash32(key) % masks.length];
  const dotted = maskToDotted(local, mask);
  return { local: dotted, email: `${dotted}@${domain}`, mask };
}

/** Plus-addressing fallback. Note: many validators reject the "+". */
export function plusAlias(input: string, tag: string, domain = "gmail.com"): GeneratedAlias {
  const local = canonicalize(input);
  const clean = tag.trim().replace(/[^a-z0-9._-]/gi, "-");
  return { local: `${local}+${clean}`, email: `${local}+${clean}@${domain}`, mask: -1 };
}
