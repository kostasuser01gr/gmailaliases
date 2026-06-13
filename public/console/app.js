/* Gmail Alias Control Center — bundled client app (ported from Claude Design handoff).
 * Source modules concatenated in dependency order. Mounted by AliasControlCenter.tsx. */

/* ===== js/logic.js ===== */
/* Gmail Alias Control Center — core logic (pure functions)
 * No DOM, no network. Generation, validation, normalization,
 * pattern templating, export, import parsing, and safe tester logic.
 */
(function () {
  "use strict";

  var GMAIL_DOMAINS = ["gmail.com", "googlemail.com"];

  // ---------- validation / normalization ----------

  var EMAIL_RE = /^[a-zA-Z0-9.+_-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  function splitEmail(email) {
    var at = String(email || "").trim().lastIndexOf("@");
    if (at < 0) return { local: "", domain: "" };
    return {
      local: email.slice(0, at),
      domain: email.slice(at + 1).toLowerCase(),
    };
  }

  function isValidEmail(email) {
    return EMAIL_RE.test(String(email || "").trim());
  }

  function isGmail(email) {
    var d = splitEmail(email).domain;
    return GMAIL_DOMAINS.indexOf(d) !== -1;
  }

  // Strip a leading/trailing junk; return a clean base local (no + tag, keep dots)
  function baseLocal(local) {
    var plus = local.indexOf("+");
    if (plus >= 0) local = local.slice(0, plus);
    return local;
  }

  // Canonical Gmail inbox address: lowercase, drop dots, drop +tag.
  // Two aliases with the same canonical resolve to the same inbox.
  function canonical(email) {
    var p = splitEmail(email);
    if (!p.domain) return String(email || "").toLowerCase();
    var local = baseLocal(p.local).toLowerCase().replace(/\./g, "");
    var domain = p.domain === "googlemail.com" ? "gmail.com" : p.domain;
    return local + "@" + domain;
  }

  function validateBase(email) {
    var out = { ok: true, reasons: [], normalized: "", canonical: "" };
    var v = String(email || "").trim();
    if (!v) { out.ok = false; out.reasons.push("Email is empty."); return out; }
    if (!isValidEmail(v)) { out.ok = false; out.reasons.push("Not a valid email format."); }
    var p = splitEmail(v);
    if (out.ok && GMAIL_DOMAINS.indexOf(p.domain) === -1) {
      out.ok = false;
      out.reasons.push("Domain must be gmail.com or googlemail.com.");
    }
    if (out.ok && baseLocal(p.local).length < 1) {
      out.ok = false; out.reasons.push("Local part is empty.");
    }
    if (out.ok && p.local.indexOf("+") >= 0) {
      out.reasons.push("Base contained a +tag; it was removed.");
    }
    if (out.ok) {
      out.normalized = baseLocal(p.local).toLowerCase() + "@" + p.domain;
      out.canonical = canonical(v);
    }
    return out;
  }

  // Validate the structure of a generated alias (used by the syntax tester).
  function validateAlias(alias) {
    var out = { ok: true, reasons: [], canonical: "" };
    var v = String(alias || "").trim();
    if (!v) { out.ok = false; out.reasons.push("Alias is empty."); return out; }
    if (!isValidEmail(v)) { out.ok = false; out.reasons.push("Not a structurally valid email."); }
    var p = splitEmail(v);
    if (GMAIL_DOMAINS.indexOf(p.domain) === -1) {
      out.reasons.push("Domain is not a Gmail domain (may still be valid elsewhere).");
    }
    if (/\.{2,}/.test(p.local)) { out.ok = false; out.reasons.push("Local part has consecutive dots."); }
    if (/^\./.test(p.local) || /\.$/.test(baseLocal(p.local))) {
      out.ok = false; out.reasons.push("Local part starts or ends with a dot.");
    }
    if (v.length > 254) { out.ok = false; out.reasons.push("Address exceeds 254 characters."); }
    if (p.local.length > 64) { out.ok = false; out.reasons.push("Local part exceeds 64 characters."); }
    out.canonical = canonical(v);
    if (out.ok && !out.reasons.length) out.reasons.push("Structurally valid.");
    return out;
  }

  function slug(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  // ---------- template engine ----------

  var WORDS = ["alpha","bravo","comet","delta","ember","flux","gamma","harbor","ion","juno",
    "kilo","lumen","mesa","nova","orbit","pulse","quartz","river","sigma","terra",
    "ultra","vapor","willow","xenon","yarn","zephyr","atlas","beacon","cedar","drift"];

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = "0" + s;
    return s;
  }

  function randStr(len) {
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var out = "";
    for (var i = 0; i < (len || 5); i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  // Render a template suffix for index i (1-based). ctx carries source/campaign.
  function renderTemplate(tpl, i, ctx) {
    ctx = ctx || {};
    var now = new Date();
    var width = Math.max(2, String(ctx.total || 1).length);
    return String(tpl).replace(/\{(i|date|year|month|day|random|word|source|campaign)\}/g, function (_, key) {
      switch (key) {
        case "i": return pad(i, width);
        case "date": return now.getFullYear() + "-" + pad(now.getMonth() + 1, 2) + "-" + pad(now.getDate(), 2);
        case "year": return String(now.getFullYear());
        case "month": return pad(now.getMonth() + 1, 2);
        case "day": return pad(now.getDate(), 2);
        case "random": return randStr(5);
        case "word": return WORDS[(i - 1 + Math.floor(Math.random() * WORDS.length)) % WORDS.length];
        case "source": return slug(ctx.source) || "src";
        case "campaign": return slug(ctx.campaign) || "camp";
        default: return "";
      }
    });
  }

  // ---------- dot variants ----------
  // Gmail ignores dots in the local part. Generate distinct dotted spellings.
  function dotVariants(local, count) {
    var clean = local.replace(/\./g, "");
    var chars = clean.split("");
    var gaps = chars.length - 1;
    var seen = {};
    var out = [];

    function build(mask) {
      var s = "";
      for (var k = 0; k < chars.length; k++) {
        s += chars[k];
        if (k < gaps && (mask & (1 << k))) s += ".";
      }
      return s;
    }

    function push(mask) {
      var s = build(mask);
      if (!seen[s]) { seen[s] = 1; out.push(s); }
    }

    if (gaps <= 0) { return [clean]; }

    // 0) plain, 1) fully dotted, 2) each single-dot position
    push(0);
    push((1 << gaps) - 1);
    for (var b = 0; b < gaps; b++) push(1 << b);

    // systematic enumeration for small locals, else random masks
    var maxMask = (1 << gaps);
    if (gaps <= 14) {
      for (var m = 0; m < maxMask && out.length < count; m++) push(m);
    }
    var guard = 0;
    while (out.length < count && guard < count * 40) {
      push(Math.floor(Math.random() * maxMask));
      guard++;
    }
    return out.slice(0, count);
  }

  // ---------- generation ----------
  // opts: { mode, count, source, campaign, template, separator }
  function generate(base, opts) {
    opts = opts || {};
    var v = validateBase(base);
    if (!v.ok) return { ok: false, reasons: v.reasons, aliases: [] };

    var p = splitEmail(base.trim());
    var local = baseLocal(p.local).toLowerCase();
    var domain = p.domain;
    var count = Math.max(1, Math.floor(opts.count || 1));
    var mode = opts.mode || "plus";
    var ctx = { source: opts.source, campaign: opts.campaign, total: count };
    var aliases = [];
    var seen = {};
    var patternLabel = "";

    function add(localPart, pat) {
      var a = localPart + "@" + domain;
      var key = a.toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      aliases.push({ alias: a, pattern: pat });
    }

    if (mode === "plus") {
      var tpl = (opts.template && opts.template.trim()) || "{source}-{i}";
      patternLabel = "plus: +" + tpl;
      for (var i = 1; i <= count; i++) {
        var suffix = renderTemplate(tpl, i, ctx);
        add(local + "+" + suffix, patternLabel);
      }
    } else if (mode === "dot") {
      patternLabel = "dot variants";
      var dv = dotVariants(local, count);
      for (var j = 0; j < dv.length; j++) add(dv[j], patternLabel);
    } else if (mode === "hybrid") {
      var htpl = (opts.template && opts.template.trim()) || "{source}-{i}";
      patternLabel = "hybrid: dot + +" + htpl;
      var dvs = dotVariants(local, count);
      for (var h = 0; h < count; h++) {
        var dvar = dvs[h % dvs.length];
        var suf = renderTemplate(htpl, h + 1, ctx);
        add(dvar + "+" + suf, patternLabel);
      }
    } else if (mode === "custom") {
      var ctpl = (opts.template && opts.template.trim()) || "+{source}-{i}";
      patternLabel = "custom: " + ctpl;
      for (var c = 1; c <= count; c++) {
        var rendered = renderTemplate(ctpl, c, ctx);
        // template is appended to the base local part
        add(local + rendered, patternLabel);
      }
    }

    return { ok: true, reasons: [], aliases: aliases, pattern: patternLabel, baseEmail: v.normalized };
  }

  // ---------- export ----------
  function csvCell(s) {
    s = s == null ? "" : String(s);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  var CSV_COLUMNS = [
    ["alias", "Alias"], ["baseEmail", "Base Email"], ["label", "Label"],
    ["category", "Category"], ["tags", "Tags"], ["status", "Status"],
    ["notes", "Notes"], ["createdAt", "Created At"],
    ["copiedAt", "Last Copied At"], ["copiedCount", "Copied Count"],
  ];

  function toCSV(rows) {
    var header = CSV_COLUMNS.map(function (c) { return c[1]; }).join(",");
    var lines = rows.map(function (r) {
      return CSV_COLUMNS.map(function (c) {
        var key = c[0];
        var val = r[key];
        if (key === "tags") val = (r.tags || []).join("; ");
        return csvCell(val);
      }).join(",");
    });
    return header + "\n" + lines.join("\n");
  }

  function toJSON(rows) {
    return JSON.stringify(rows, null, 2);
  }

  function toTXT(rows) {
    return rows.map(function (r) { return r.alias; }).join("\n");
  }

  // ---------- import ----------
  function parseCSVLine(line) {
    var out = [], cur = "", q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (q) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else q = false;
        } else cur += ch;
      } else {
        if (ch === '"') q = true;
        else if (ch === ",") { out.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  // Returns { records: [{alias, baseEmail, pattern, status, tags, notes}], invalid: [{line, reason}] }
  function parseImport(text, fmt) {
    text = String(text || "");
    var records = [], invalid = [];

    function pushAlias(aliasStr, extra) {
      aliasStr = String(aliasStr || "").trim();
      if (!aliasStr) return;
      var val = validateAlias(aliasStr);
      if (!isValidEmail(aliasStr)) {
        invalid.push({ value: aliasStr, reason: "Invalid email format" });
        return;
      }
      var rec = {
        alias: aliasStr,
        baseEmail: extra && extra.baseEmail ? extra.baseEmail : (baseLocal(splitEmail(aliasStr).local).toLowerCase() + "@" + (splitEmail(aliasStr).domain || "gmail.com")),
        pattern: (extra && extra.pattern) || "imported",
        status: (extra && extra.status) || "Saved",
        label: (extra && extra.label) || "",
        category: (extra && extra.category) || "Custom",
        tags: (extra && extra.tags) || [],
        notes: (extra && extra.notes) || "",
      };
      records.push(rec);
    }

    if (fmt === "json") {
      var data;
      try { data = JSON.parse(text); } catch (e) {
        return { records: [], invalid: [{ value: "(file)", reason: "Invalid JSON: " + e.message }] };
      }
      if (!Array.isArray(data)) data = [data];
      data.forEach(function (item) {
        if (typeof item === "string") pushAlias(item);
        else if (item && item.alias) pushAlias(item.alias, {
          baseEmail: item.baseEmail, pattern: item.pattern, status: item.status,
          label: item.label, category: item.category,
          tags: Array.isArray(item.tags) ? item.tags : (item.tags ? String(item.tags).split(/[;,]/).map(function (t) { return t.trim(); }).filter(Boolean) : []),
          notes: item.notes,
        });
        else invalid.push({ value: JSON.stringify(item), reason: "Missing alias field" });
      });
      return { records: records, invalid: invalid };
    }

    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });

    if (fmt === "csv") {
      if (!lines.length) return { records: [], invalid: [] };
      var header = parseCSVLine(lines[0]).map(function (h) { return h.trim().toLowerCase(); });
      var hasHeader = header.indexOf("alias") !== -1 || header.indexOf("base email") !== -1;
      var startIdx = hasHeader ? 1 : 0;
      var idx = function (name) { return header.indexOf(name); };
      for (var i = startIdx; i < lines.length; i++) {
        var cells = parseCSVLine(lines[i]);
        if (hasHeader) {
          var aliasV = idx("alias") >= 0 ? cells[idx("alias")] : cells[0];
          var tagsV = idx("tags") >= 0 ? cells[idx("tags")] : "";
          pushAlias(aliasV, {
            baseEmail: idx("base email") >= 0 ? (cells[idx("base email")] || "").trim() : "",
            pattern: idx("pattern") >= 0 ? (cells[idx("pattern")] || "").trim() : "imported",
            status: idx("status") >= 0 ? (cells[idx("status")] || "").trim() : "Saved",
            label: idx("label") >= 0 ? (cells[idx("label")] || "").trim() : "",
            category: idx("category") >= 0 ? (cells[idx("category")] || "").trim() : "Custom",
            notes: idx("notes") >= 0 ? (cells[idx("notes")] || "").trim() : "",
            tags: tagsV ? tagsV.split(/[;,]/).map(function (t) { return t.trim(); }).filter(Boolean) : [],
          });
        } else {
          pushAlias(cells[0]);
        }
      }
      return { records: records, invalid: invalid };
    }

    // txt — one alias per line
    lines.forEach(function (l) { pushAlias(l); });
    return { records: records, invalid: invalid };
  }

  // ---------- safe tester ----------
  function testSyntax(alias) {
    var r = validateAlias(alias);
    return {
      mode: "syntax",
      alias: alias,
      url: "—",
      status: r.ok ? "Pass" : "Fail",
      httpStatus: "—",
      responseTime: 0,
      detection: "None",
      notes: r.reasons.join(" "),
      timestamp: new Date().toISOString(),
    };
  }

  // Local simulation against an in-memory mock form. No network at all.
  function simulateLocal(alias) {
    var r = validateAlias(alias);
    var ok = r.ok;
    // deterministic-ish pseudo response time
    var ms = 40 + (alias.length * 7) % 180;
    return {
      mode: "simulate",
      alias: alias,
      url: "mock://local/signup-form",
      status: ok ? "Accepted (mock)" : "Rejected (mock)",
      httpStatus: ok ? 200 : 422,
      responseTime: ms,
      detection: "None — local sandbox",
      notes: ok ? "Mock endpoint accepted the alias structure." : "Mock endpoint rejected: " + r.reasons.join(" "),
      timestamp: new Date().toISOString(),
    };
  }

  // ---------- alias-vault generation engine ----------
  var SMART_SETS = {
    "Shopping Pack":     { category: "Shopping",     items: ["amazon", "ebay", "aliexpress", "skroutz", "etsy", "walmart"] },
    "Social Media Pack": { category: "Social Media", items: ["facebook", "instagram", "twitter", "tiktok", "linkedin", "reddit"] },
    "Streaming Pack":    { category: "Streaming",    items: ["netflix", "spotify", "youtube", "disney", "hbo", "primevideo"] },
    "Travel Pack":       { category: "Travel",       items: ["booking", "airbnb", "expedia", "ryanair", "uber", "wolt"] },
    "Business Pack":     { category: "Work",         items: ["client", "invoice", "support", "sales", "hr", "meetings"] },
    "Testing Pack":      { category: "Testing",      items: ["test", "qa", "dev", "staging", "demo", "sandbox"] },
    "Newsletter Pack":   { category: "Marketing",    items: ["newsletter", "updates", "promo", "deals", "digest", "weekly"] },
    "Privacy Pack":      { category: "Spam Control", items: ["spam", "signup", "trial", "public", "temp", "throwaway"] },
  };

  var SMART_SUGGESTIONS = [
    { suffix: "amazon", category: "Shopping" }, { suffix: "skroutz", category: "Shopping" },
    { suffix: "wolt", category: "Travel" }, { suffix: "booking", category: "Travel" },
    { suffix: "netflix", category: "Streaming" }, { suffix: "spotify", category: "Streaming" },
    { suffix: "facebook", category: "Social Media" }, { suffix: "instagram", category: "Social Media" },
    { suffix: "support", category: "Work" }, { suffix: "client", category: "Work" },
    { suffix: "invoice", category: "Work" }, { suffix: "newsletter", category: "Marketing" },
  ];

  function randomSuffix(len) { return randStr(len || 5); }

  // Build the inner suffix from prefix/core/suffix labels (slugged, joined by '-')
  function wrapLabels(core, prefix, suff) {
    var parts = [slug(prefix), String(core), slug(suff)].filter(function (p) { return p !== "" && p != null; });
    return parts.join("-");
  }

  // opts: { mode, count, start, prefix, suffix, includeDots, services, campaign }
  function generateAuto(base, opts) {
    opts = opts || {};
    var v = validateBase(base);
    if (!v.ok) return { ok: false, reasons: v.reasons, aliases: [] };
    var p = splitEmail(base.trim());
    var local = baseLocal(p.local).toLowerCase();
    var domain = p.domain;
    var count = Math.max(1, Math.floor(opts.count || 1));
    var start = Math.floor(opts.start != null ? opts.start : 1);
    var mode = opts.mode || "number";
    var includeDots = !!opts.includeDots;
    var now = new Date();
    var dateStr = now.getFullYear() + "-" + pad(now.getMonth() + 1, 2) + "-" + pad(now.getDate(), 2);
    var services = (opts.services && opts.services.length) ? opts.services : SMART_SUGGESTIONS.map(function (s) { return s.suffix; });
    var campaign = slug(opts.campaign) || "campaign";

    var aliases = [], seen = {};
    var dotCache = includeDots ? dotVariants(local, count + 4) : null;
    function localFor(i) {
      if (!includeDots) return local;
      return dotCache[(i + 1) % dotCache.length]; // skip plain at index... cycle dotted spellings
    }
    function add(localPart, suffixStr) {
      var a = suffixStr ? (localPart + "+" + suffixStr + "@" + domain) : (localPart + "@" + domain);
      var key = a.toLowerCase();
      if (seen[key]) return;
      seen[key] = 1;
      aliases.push({ alias: a, suffix: suffixStr || "" });
    }

    if (mode === "dot") {
      var dv = dotVariants(local, count);
      for (var d = 0; d < dv.length; d++) add(dv[d], "");
      return done("dot variations");
    }

    for (var i = 0; i < count; i++) {
      var core;
      switch (mode) {
        case "number": core = start + i; break;
        case "service": core = services[i % services.length]; break;
        case "campaign": core = count > 1 ? campaign + "-" + (start + i) : campaign; break;
        case "random": core = randomSuffix(5); break;
        case "date": core = count > 1 ? dateStr + "-" + (start + i) : dateStr; break;
        case "hybrid": core = services[i % services.length]; break;
        default: core = start + i;
      }
      var suffix = wrapLabels(core, opts.prefix, opts.suffix);
      var dotted = (mode === "hybrid") ? dotVariants(local, count + 4)[(i + 1) % (count + 4)] : localFor(i);
      add(dotted, suffix);
    }
    return done(modeLabel(mode, includeDots));

    function done(label) {
      return { ok: true, reasons: [], aliases: aliases, pattern: label, baseEmail: v.normalized };
    }
  }

  function modeLabel(mode, dots) {
    var m = { number: "number", service: "service", campaign: "campaign", random: "random", date: "date", hybrid: "hybrid (dots + service)" }[mode] || mode;
    return dots && mode !== "hybrid" ? m + " + dots" : m;
  }

  // Generate a smart preset pack
  function generatePack(base, packName) {
    var pack = SMART_SETS[packName];
    if (!pack) return { ok: false, reasons: ["Unknown pack"], aliases: [] };
    var v = validateBase(base);
    if (!v.ok) return { ok: false, reasons: v.reasons, aliases: [] };
    var p = splitEmail(base.trim());
    var local = baseLocal(p.local).toLowerCase();
    return {
      ok: true, category: pack.category, pattern: "smart set: " + packName,
      baseEmail: v.normalized,
      aliases: pack.items.map(function (s) { return { alias: local + "+" + s + "@" + p.domain, suffix: s, label: s }; }),
    };
  }

  // Validate a manually-typed suffix (the part after +)
  function validateManual(base, suffix) {
    var out = { ok: true, reasons: [], alias: "" };
    var v = validateBase(base);
    if (!v.ok) { out.ok = false; out.reasons.push("Base email is invalid."); return out; }
    var s = String(suffix == null ? "" : suffix).trim();
    if (!s) { out.ok = false; out.reasons.push("Suffix cannot be empty."); return out; }
    if (/\s/.test(s)) { out.ok = false; out.reasons.push("Suffix cannot contain spaces."); }
    if (s.charAt(0) === "+") { out.reasons.push("Leading + removed automatically."); s = s.replace(/^\++/, ""); }
    if (!/^[A-Za-z0-9._+-]+$/.test(s)) { out.ok = false; out.reasons.push("Only letters, numbers, and . _ + - are allowed."); }
    if (/\.{2,}/.test(s)) { out.ok = false; out.reasons.push("No consecutive dots."); }
    var p = splitEmail(v.normalized);
    var local = baseLocal(p.local).toLowerCase();
    if (out.ok) out.alias = local + "+" + s + "@" + p.domain;
    out.suffix = s;
    return out;
  }

  // Suggest a Gmail filter sentence for an alias
  function filterSuggestion(alias, labelName) {
    var name = labelName || "this sender";
    return 'In Gmail, create a filter for mail sent to "' + alias + '", then apply the label \u201C' + name + '\u201D so these messages are organised automatically.';
  }

  // Lightweight "health" indicator for an alias
  function aliasHealth(a) {
    if (a.status === "Blocked") return { level: "bad", text: "Blocked" };
    if (a.status === "Archived") return { level: "idle", text: "Archived" };
    if ((a.copiedCount || 0) > 0 || a.status === "Used") return { level: "good", text: "Active" };
    if (a.status === "Reserved") return { level: "warn", text: "Reserved" };
    return { level: "new", text: "New" };
  }

  // Naming recommendation from a suffix
  function namingTip(suffix) {
    var s = slug(suffix);
    if (!s) return "Use a short, lowercase word that names the service (e.g. amazon, netflix).";
    if (s.length > 20) return "Shorter labels are easier to scan \u2014 try one or two words.";
    if (/^\d+$/.test(s)) return "Numeric suffixes work, but a service name (e.g. +" + s + "-amazon) is easier to recognise later.";
    return "Looks good \u2014 \u201C" + s + "\u201D is clear and Gmail-safe.";
  }

  function uid() {
    return "a_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  window.GACC = window.GACC || {};
  window.GACC.logic = {
    GMAIL_DOMAINS: GMAIL_DOMAINS,
    isValidEmail: isValidEmail,
    isGmail: isGmail,
    splitEmail: splitEmail,
    canonical: canonical,
    validateBase: validateBase,
    validateAlias: validateAlias,
    slug: slug,
    renderTemplate: renderTemplate,
    dotVariants: dotVariants,
    generate: generate,
    generateAuto: generateAuto,
    generatePack: generatePack,
    validateManual: validateManual,
    filterSuggestion: filterSuggestion,
    aliasHealth: aliasHealth,
    namingTip: namingTip,
    randomSuffix: randomSuffix,
    SMART_SETS: SMART_SETS,
    SMART_SUGGESTIONS: SMART_SUGGESTIONS,
    toCSV: toCSV,
    toJSON: toJSON,
    toTXT: toTXT,
    CSV_COLUMNS: CSV_COLUMNS,
    parseImport: parseImport,
    testSyntax: testSyntax,
    simulateLocal: simulateLocal,
    uid: uid,
    WORDS: WORDS,
  };
})();

/* ===== js/store.js ===== */
/* Gmail Alias Control Center — store + persistence
 * Lightweight reactive store with localStorage persistence.
 */
(function () {
  "use strict";

  var KEY = "gacc:v1";
  var L = window.GACC.logic;

  var STATUSES = ["New", "Saved", "Copied", "Used", "Reserved", "Archived", "Blocked", "Invalid"];
  var CATEGORIES = ["Shopping", "Streaming", "Social Media", "Travel", "Work", "Testing", "Signups", "Marketing", "Spam Control", "Custom"];

  var ACCENTS = {
    cyan:   { a: "#22d3ee", strong: "#06b6d4", contrast: "#04141a", glow: "34,211,238" },
    indigo: { a: "#818cf8", strong: "#6366f1", contrast: "#0a0b1f", glow: "129,140,248" },
    emerald:{ a: "#34d399", strong: "#10b981", contrast: "#04140d", glow: "52,211,153" },
    amber:  { a: "#fbbf24", strong: "#f59e0b", contrast: "#1f1503", glow: "251,191,36" },
    pink:   { a: "#f472b6", strong: "#ec4899", contrast: "#1f0512", glow: "244,114,182" },
    violet: { a: "#a78bfa", strong: "#8b5cf6", contrast: "#13072a", glow: "167,139,250" },
  };

  var defaults = {
    aliases: [],
    testerResults: [],
    exportHistory: [],
    copyHistory: [],
    activity: [],
    lastCopiedId: null,
    settings: {
      theme: "dark",
      accent: "cyan",
      density: "comfortable",
      baseEmail: "europcarco69@gmail.com",
      defaultMode: "number",
      defaultTemplate: "{source}-{i}",
      defaultBatch: 10,
      maxBatch: 500,
      hardCap: 5000,
      autoSave: true,
      storageMode: "local",
      categories: CATEGORIES.slice(),
      authorizedDomains: ["example.com", "staging.mycompany.test"],
      complianceAcknowledged: false,
    },
    ui: {
      view: "generator",
      page: 1,
      pageSize: 25,
      filters: { search: "", status: "all", tag: "all", baseEmail: "all", category: "all", favorite: false, sort: "createdAt:desc" },
      selected: [],
    },
  };

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function merge(base, over) {
    var out = deepClone(base);
    if (!over) return out;
    Object.keys(over).forEach(function (k) {
      if (over[k] && typeof over[k] === "object" && !Array.isArray(over[k]) && base[k]) {
        out[k] = merge(base[k], over[k]);
      } else {
        out[k] = over[k];
      }
    });
    return out;
  }

  var state = deepClone(defaults);
  var listeners = [];

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        state.aliases = Array.isArray(parsed.aliases) ? parsed.aliases.map(normalizeAlias) : [];
        state.testerResults = Array.isArray(parsed.testerResults) ? parsed.testerResults : [];
        state.exportHistory = Array.isArray(parsed.exportHistory) ? parsed.exportHistory : [];
        state.copyHistory = Array.isArray(parsed.copyHistory) ? parsed.copyHistory : [];
        state.activity = Array.isArray(parsed.activity) ? parsed.activity : [];
        state.lastCopiedId = parsed.lastCopiedId || null;
        state.settings = merge(defaults.settings, parsed.settings || {});
        // ui filters/view persisted lightly
        if (parsed.ui) {
          state.ui = merge(defaults.ui, { view: parsed.ui.view, pageSize: parsed.ui.pageSize, filters: parsed.ui.filters });
          state.ui.selected = [];
        }
      }
    } catch (e) {
      console.warn("Failed to load state, starting fresh.", e);
    }
  }

  // ensure older records have all current fields
  function normalizeAlias(a) {
    return {
      id: a.id || L.uid(),
      baseEmail: a.baseEmail || "",
      alias: a.alias,
      pattern: a.pattern || "",
      source: a.source || "",
      label: a.label || "",
      category: a.category || "Custom",
      status: a.status || "Saved",
      notes: a.notes || "",
      tags: Array.isArray(a.tags) ? a.tags : [],
      favorite: !!a.favorite,
      pinned: !!a.pinned,
      createdAt: a.createdAt || new Date().toISOString(),
      copiedAt: a.copiedAt || null,
      copiedCount: a.copiedCount || 0,
      lastUsedAt: a.lastUsedAt || null,
    };
  }

  var saveTimer = null;
  function persist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(KEY, JSON.stringify({
          aliases: state.aliases,
          testerResults: state.testerResults.slice(0, 500),
          exportHistory: state.exportHistory.slice(0, 100),
          copyHistory: state.copyHistory.slice(0, 300),
          activity: state.activity.slice(0, 300),
          lastCopiedId: state.lastCopiedId,
          settings: state.settings,
          ui: { view: state.ui.view, pageSize: state.ui.pageSize, filters: state.ui.filters },
        }));
      } catch (e) {
        console.warn("Persist failed", e);
      }
    }, 120);
  }

  function emit() {
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { console.error(e); } });
  }

  function notify(opts) {
    opts = opts || {};
    if (opts.persist !== false) persist();
    if (opts.render !== false) emit();
  }

  // ---------- mutations ----------

  function logActivity(type, alias, meta) {
    state.activity.unshift({ id: L.uid(), type: type, alias: alias || "", meta: meta || "", at: new Date().toISOString() });
    if (state.activity.length > 300) state.activity = state.activity.slice(0, 300);
  }

  function addAliases(generated, meta) {
    // generated: array of {alias, pattern, suffix, label}; meta: {baseEmail, source, tags, notes, status, category, favorite, label}
    meta = meta || {};
    var existing = {};
    state.aliases.forEach(function (a) { existing[a.alias.toLowerCase()] = true; });
    var added = 0, dupes = 0;
    var now = new Date().toISOString();
    generated.forEach(function (g) {
      if (existing[g.alias.toLowerCase()]) { dupes++; return; }
      existing[g.alias.toLowerCase()] = true;
      state.aliases.unshift({
        id: L.uid(),
        baseEmail: meta.baseEmail || "",
        alias: g.alias,
        pattern: g.pattern || meta.pattern || "",
        source: meta.source || "",
        label: g.label || meta.label || g.suffix || "",
        category: meta.category || "Custom",
        status: meta.status || "Saved",
        notes: meta.notes || "",
        tags: (meta.tags || []).slice(),
        favorite: !!meta.favorite,
        pinned: false,
        createdAt: now,
        copiedAt: null,
        copiedCount: 0,
        lastUsedAt: null,
      });
      added++;
    });
    if (added) logActivity("saved", added === 1 ? generated[0].alias : added + " aliases", meta.pattern || "");
    notify();
    return { added: added, dupes: dupes };
  }

  function importRecords(records) {
    var existing = {};
    state.aliases.forEach(function (a) { existing[a.alias.toLowerCase()] = true; });
    var added = 0, dupes = 0;
    var now = new Date().toISOString();
    records.forEach(function (r) {
      if (existing[r.alias.toLowerCase()]) { dupes++; return; }
      existing[r.alias.toLowerCase()] = true;
      state.aliases.unshift({
        id: L.uid(),
        baseEmail: r.baseEmail || "",
        alias: r.alias,
        pattern: r.pattern || "imported",
        source: r.source || "",
        label: r.label || "",
        category: r.category || "Custom",
        status: STATUSES.indexOf(r.status) >= 0 ? r.status : "Saved",
        notes: r.notes || "",
        tags: Array.isArray(r.tags) ? r.tags : [],
        favorite: false,
        pinned: false,
        createdAt: now,
        copiedAt: null,
        copiedCount: 0,
        lastUsedAt: null,
      });
      added++;
    });
    notify();
    return { added: added, dupes: dupes };
  }

  function findAlias(id) {
    for (var i = 0; i < state.aliases.length; i++) if (state.aliases[i].id === id) return state.aliases[i];
    return null;
  }

  function markCopied(id) {
    var a = findAlias(id);
    if (!a) return;
    a.copiedCount = (a.copiedCount || 0) + 1;
    a.copiedAt = new Date().toISOString();
    if (a.status === "New" || a.status === "Saved") a.status = "Copied";
    state.lastCopiedId = id;
    state.copyHistory.unshift({ id: L.uid(), aliasId: id, alias: a.alias, at: a.copiedAt });
    if (state.copyHistory.length > 300) state.copyHistory = state.copyHistory.slice(0, 300);
    logActivity("copied", a.alias);
    notify();
  }

  function toggleFavorite(id) {
    var a = findAlias(id);
    if (!a) return;
    a.favorite = !a.favorite;
    logActivity(a.favorite ? "favorited" : "unfavorited", a.alias);
    notify();
  }

  function togglePin(id) {
    var a = findAlias(id);
    if (!a) return;
    a.pinned = !a.pinned;
    notify();
  }

  function setCategory(ids, category) {
    ids.forEach(function (id) { var a = findAlias(id); if (a) a.category = category; });
    notify();
  }

  function duplicateAlias(id) {
    var a = findAlias(id);
    if (!a) return null;
    var copy = JSON.parse(JSON.stringify(a));
    copy.id = L.uid();
    copy.alias = a.alias; // same target; user can edit suffix
    copy.status = "New";
    copy.favorite = false; copy.pinned = false;
    copy.copiedCount = 0; copy.copiedAt = null; copy.lastUsedAt = null;
    copy.createdAt = new Date().toISOString();
    copy.label = (a.label || "") + " (copy)";
    var i = state.aliases.indexOf(a);
    state.aliases.splice(i, 0, copy);
    notify();
    return copy.id;
  }

  function setStatus(ids, status) {
    ids.forEach(function (id) {
      var a = findAlias(id);
      if (a) {
        a.status = status;
        if (status === "Used") a.lastUsedAt = new Date().toISOString();
      }
    });
    logActivity("status", ids.length === 1 ? (findAlias(ids[0]) || {}).alias : ids.length + " aliases", status);
    notify();
  }

  function setField(id, field, value) {
    var a = findAlias(id);
    if (!a) return;
    a[field] = value;
    notify();
  }

  function addTag(ids, tag) {
    tag = String(tag || "").trim();
    if (!tag) return;
    ids.forEach(function (id) {
      var a = findAlias(id);
      if (a && a.tags.indexOf(tag) === -1) a.tags.push(tag);
    });
    notify();
  }

  function removeTag(id, tag) {
    var a = findAlias(id);
    if (!a) return;
    a.tags = a.tags.filter(function (t) { return t !== tag; });
    notify();
  }

  function removeAliases(ids) {
    var set = {};
    ids.forEach(function (id) { set[id] = true; });
    state.aliases = state.aliases.filter(function (a) { return !set[a.id]; });
    state.ui.selected = state.ui.selected.filter(function (id) { return !set[id]; });
    notify();
  }

  function addTesterResult(res) {
    state.testerResults.unshift(res);
    if (state.testerResults.length > 500) state.testerResults = state.testerResults.slice(0, 500);
    notify();
  }

  function clearTesterResults() {
    state.testerResults = [];
    notify();
  }

  function addExportRecord(rec) {
    state.exportHistory.unshift(rec);
    if (state.exportHistory.length > 100) state.exportHistory = state.exportHistory.slice(0, 100);
    notify();
  }

  function updateSettings(patch) {
    state.settings = merge(state.settings, patch);
    notify();
  }

  function setUI(patch, opts) {
    state.ui = merge(state.ui, patch);
    notify(opts || { persist: true });
  }

  function setFilters(patch) {
    state.ui.filters = merge(state.ui.filters, patch);
    state.ui.page = 1;
    notify();
  }

  function toggleSelected(id) {
    var i = state.ui.selected.indexOf(id);
    if (i >= 0) state.ui.selected.splice(i, 1);
    else state.ui.selected.push(id);
    notify({ persist: false });
  }

  function setSelected(ids) {
    state.ui.selected = ids.slice();
    notify({ persist: false });
  }

  function clearSelected() {
    state.ui.selected = [];
    notify({ persist: false });
  }

  function resetAll() {
    state.aliases = [];
    state.testerResults = [];
    state.exportHistory = [];
    state.copyHistory = [];
    state.activity = [];
    state.lastCopiedId = null;
    state.ui.selected = [];
    notify();
  }

  function importBackup(obj) {
    if (obj.aliases) state.aliases = obj.aliases.map(normalizeAlias);
    if (obj.testerResults) state.testerResults = obj.testerResults;
    if (obj.exportHistory) state.exportHistory = obj.exportHistory;
    if (obj.copyHistory) state.copyHistory = obj.copyHistory;
    if (obj.activity) state.activity = obj.activity;
    if (obj.settings) state.settings = merge(defaults.settings, obj.settings);
    state.ui.selected = [];
    notify();
  }

  function backup() {
    return {
      _app: "gmail-alias-control-center",
      _version: 2,
      exportedAt: new Date().toISOString(),
      aliases: state.aliases,
      testerResults: state.testerResults,
      exportHistory: state.exportHistory,
      copyHistory: state.copyHistory,
      activity: state.activity,
      settings: state.settings,
    };
  }

  // ---------- derived ----------
  function uniqueBaseEmails() {
    var s = {};
    state.aliases.forEach(function (a) { if (a.baseEmail) s[a.baseEmail] = (s[a.baseEmail] || 0) + 1; });
    return s;
  }

  function uniqueTags() {
    var s = {};
    state.aliases.forEach(function (a) { (a.tags || []).forEach(function (t) { s[t] = (s[t] || 0) + 1; }); });
    return s;
  }

  function filteredAliases() {
    var f = state.ui.filters;
    var q = (f.search || "").toLowerCase();
    var list = state.aliases.filter(function (a) {
      if (f.status !== "all" && a.status !== f.status) return false;
      if (f.category && f.category !== "all" && a.category !== f.category) return false;
      if (f.favorite && !a.favorite) return false;
      if (f.tag !== "all" && (a.tags || []).indexOf(f.tag) === -1) return false;
      if (f.baseEmail !== "all" && a.baseEmail !== f.baseEmail) return false;
      if (q) {
        var hay = (a.alias + " " + a.baseEmail + " " + a.label + " " + a.category + " " + a.pattern + " " + a.notes + " " + (a.tags || []).join(" ")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    var parts = (f.sort || "createdAt:desc").split(":");
    var key = parts[0], dir = parts[1] === "asc" ? 1 : -1;
    list.sort(function (x, y) {
      // pinned always first
      if (!!x.pinned !== !!y.pinned) return x.pinned ? -1 : 1;
      var a = x[key], b = y[key];
      if (key === "copiedCount") { a = a || 0; b = b || 0; return (a - b) * dir; }
      a = a || ""; b = b || "";
      if (a < b) return -1 * dir;
      if (a > b) return 1 * dir;
      return 0;
    });
    return list;
  }

  function isToday(iso) {
    if (!iso) return false;
    var d = new Date(iso), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }
  function generatedToday() { return state.aliases.filter(function (a) { return isToday(a.createdAt); }).length; }
  function copiedToday() { return state.copyHistory.filter(function (c) { return isToday(c.at); }).length; }
  function favoritesCount() { return state.aliases.filter(function (a) { return a.favorite; }).length; }
  function archivedCount() { return state.aliases.filter(function (a) { return a.status === "Archived"; }).length; }
  function unusedCount() { return state.aliases.filter(function (a) { return !a.lastUsedAt && (a.copiedCount || 0) === 0 && a.status !== "Archived"; }).length; }
  function uniqueCategories() {
    var s = {};
    state.aliases.forEach(function (a) { if (a.category) s[a.category] = (s[a.category] || 0) + 1; });
    return s;
  }
  function lastCopied() { return state.lastCopiedId ? findAlias(state.lastCopiedId) : null; }
  function mostCopied() {
    var best = null;
    state.aliases.forEach(function (a) { if ((a.copiedCount || 0) > 0 && (!best || a.copiedCount > best.copiedCount)) best = a; });
    return best;
  }

  function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }

  window.GACC.store = {
    STATUSES: STATUSES,
    CATEGORIES: CATEGORIES,
    ACCENTS: ACCENTS,
    get state() { return state; },
    load: load,
    subscribe: subscribe,
    persist: persist,
    emit: emit,
    addAliases: addAliases,
    importRecords: importRecords,
    findAlias: findAlias,
    markCopied: markCopied,
    toggleFavorite: toggleFavorite,
    togglePin: togglePin,
    setCategory: setCategory,
    duplicateAlias: duplicateAlias,
    logActivity: logActivity,
    setStatus: setStatus,
    setField: setField,
    addTag: addTag,
    removeTag: removeTag,
    removeAliases: removeAliases,
    addTesterResult: addTesterResult,
    clearTesterResults: clearTesterResults,
    addExportRecord: addExportRecord,
    updateSettings: updateSettings,
    setUI: setUI,
    setFilters: setFilters,
    toggleSelected: toggleSelected,
    setSelected: setSelected,
    clearSelected: clearSelected,
    resetAll: resetAll,
    importBackup: importBackup,
    backup: backup,
    uniqueBaseEmails: uniqueBaseEmails,
    uniqueTags: uniqueTags,
    uniqueCategories: uniqueCategories,
    filteredAliases: filteredAliases,
    generatedToday: generatedToday,
    copiedToday: copiedToday,
    favoritesCount: favoritesCount,
    archivedCount: archivedCount,
    unusedCount: unusedCount,
    lastCopied: lastCopied,
    mostCopied: mostCopied,
  };
})();

/* ===== js/icons.js ===== */
/* Gmail Alias Control Center — icon set (lucide-style inline SVG paths) */
(function () {
  "use strict";
  function svg(inner, opts) {
    opts = opts || {};
    return '<svg class="ic-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (opts.w || 2) +
      '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }
  var P = {
    logo: '<path d="M3 7l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    sparkles: '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z"/>',
    table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    flask: '<path d="M9 3h6M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7 14h10"/>',
    download: '<path d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    chart: '<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
    tag: '<path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82z"/><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    upload: '<path d="M12 21V9m0 0 4 4m-4-4-4 4M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
    play: '<polygon points="6 4 20 12 6 20 6 4"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    chevDown: '<polyline points="6 9 12 15 18 9"/>',
    chevRight: '<polyline points="9 18 15 12 9 6"/>',
    db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.9 7.9"/>',
    star: '<polygon points="12 2 15.1 8.6 22 9.3 17 14.1 18.2 21 12 17.6 5.8 21 7 14.1 2 9.3 8.9 8.6 12 2"/>',
    pin: '<path d="M12 17v5M9 10.8V4h6v6.8l2 3.2H7l2-3.2z"/>',
    wand: '<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  };
  window.GACC = window.GACC || {};
  window.GACC.icon = function (name, opts) { return svg(P[name] || "", opts); };
  window.GACC.icons = P;
})();

/* ===== js/exporter.js ===== */
/* Gmail Alias Control Center — export download + import helpers */
(function () {
  "use strict";
  var L = window.GACC.logic;
  var S = window.GACC.store;

  function triggerDownload(filename, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  function stamp() {
    var d = new Date();
    return d.getFullYear() + "" + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) +
      "-" + ("0" + d.getHours()).slice(-2) + ("0" + d.getMinutes()).slice(-2);
  }

  function build(rows, fmt) {
    if (fmt === "csv") return { content: L.toCSV(rows), mime: "text/csv", ext: "csv" };
    if (fmt === "json") return { content: L.toJSON(rows), mime: "application/json", ext: "json" };
    return { content: L.toTXT(rows), mime: "text/plain", ext: "txt" };
  }

  function download(rows, fmt, scopeLabel) {
    if (!rows || !rows.length) { window.GACC.ui.toast("Nothing to export", "warn"); return; }
    var b = build(rows, fmt);
    var name = "aliases-" + (scopeLabel || "export") + "-" + stamp() + "." + b.ext;
    triggerDownload(name, b.content, b.mime);
    S.addExportRecord({
      id: L.uid(), format: fmt.toUpperCase(), scope: scopeLabel || "export",
      count: rows.length, filename: name, at: new Date().toISOString(),
    });
    window.GACC.ui.toast("Exported " + rows.length + " aliases as " + fmt.toUpperCase(), "success");
  }

  function preview(rows, fmt) { return build(rows, fmt).content; }

  function backupDownload() {
    var data = JSON.stringify(S.backup(), null, 2);
    triggerDownload("gacc-backup-" + stamp() + ".json", data, "application/json");
    window.GACC.ui.toast("Backup downloaded", "success");
  }

  window.GACC.exporter = { download: download, preview: preview, build: build, triggerDownload: triggerDownload, backupDownload: backupDownload };
})();

/* ===== js/ui.js ===== */
/* Gmail Alias Control Center — UI core: helpers, shell, router, toasts, dialogs, command palette */
(function () {
  "use strict";
  var S = window.GACC.store;
  var icon = window.GACC.icon;

  // ---------- helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function attr(s) { return esc(s).replace(/"/g, "&quot;"); }

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function highlightAlias(alias) {
    var safe = esc(alias);
    return safe
      .replace(/\+/g, '<span class="plus">+</span>')
      .replace(/\.(?=[^@]*@)/g, '<span class="dot">.</span>');
  }

  function relTime(iso) {
    if (!iso) return "—";
    var d = new Date(iso), now = new Date();
    var s = Math.floor((now - d) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    if (s < 604800) return Math.floor(s / 86400) + "d ago";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // ---------- clipboard ----------
  function copyText(text) {
    return new Promise(function (resolve) {
      function fallback() {
        try {
          var ta = document.createElement("textarea");
          ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta);
          resolve(true);
        } catch (e) { resolve(false); }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { resolve(true); }, fallback);
      } else fallback();
    });
  }

  // ---------- toasts ----------
  function toast(msg, type) {
    type = type || "info";
    var ics = { success: "check", error: "x", info: "info", warn: "alert" };
    var t = el('<div class="toast ' + type + '"><span class="tic">' + icon(ics[type]) + '</span><div>' + esc(msg) + '</div></div>');
    document.getElementById("toasts").appendChild(t);
    setTimeout(function () {
      t.classList.add("out");
      setTimeout(function () { t.remove(); }, 220);
    }, 2800);
  }

  // ---------- modal / dialog ----------
  var activeModal = null;
  function closeModal() {
    if (activeModal) { activeModal.remove(); activeModal = null; }
  }
  function openModal(html, opts) {
    opts = opts || {};
    closeModal();
    var scrim = el('<div class="scrim"></div>');
    scrim.innerHTML = '<div class="modal ' + (opts.wide ? "wide" : "") + '">' + html + "</div>";
    scrim.addEventListener("mousedown", function (e) { if (e.target === scrim && !opts.sticky) closeModal(); });
    document.body.appendChild(scrim);
    activeModal = scrim;
    return scrim;
  }

  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var danger = opts.danger;
      var m = openModal(
        '<div class="modal-head"><h3>' + esc(opts.title) + '</h3>' +
        (opts.message ? '<p>' + esc(opts.message) + '</p>' : '') + '</div>' +
        '<div class="modal-foot">' +
        '<button class="btn btn-ghost" data-act="cancel">' + esc(opts.cancel || "Cancel") + '</button>' +
        '<button class="btn ' + (danger ? "btn-danger" : "btn-primary") + '" data-act="ok">' + esc(opts.confirm || "Confirm") + '</button>' +
        '</div>'
      );
      m.querySelector('[data-act="cancel"]').onclick = function () { closeModal(); resolve(false); };
      m.querySelector('[data-act="ok"]').onclick = function () { closeModal(); resolve(true); };
    });
  }

  function promptDialog(opts) {
    return new Promise(function (resolve) {
      var m = openModal(
        '<div class="modal-head"><h3>' + esc(opts.title) + '</h3>' +
        (opts.message ? '<p>' + esc(opts.message) + '</p>' : '') + '</div>' +
        '<div class="modal-body"><input class="input" id="prompt-in" placeholder="' + attr(opts.placeholder || "") + '" value="' + attr(opts.value || "") + '"></div>' +
        '<div class="modal-foot"><button class="btn btn-ghost" data-act="cancel">Cancel</button>' +
        '<button class="btn btn-primary" data-act="ok">' + esc(opts.confirm || "Save") + '</button></div>'
      );
      var input = m.querySelector("#prompt-in");
      input.focus(); input.select();
      function done(v) { closeModal(); resolve(v); }
      m.querySelector('[data-act="cancel"]').onclick = function () { done(null); };
      m.querySelector('[data-act="ok"]').onclick = function () { done(input.value.trim() || null); };
      input.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); done(input.value.trim() || null); } };
    });
  }

  // ---------- navigation / router ----------
  var NAV = [
    { id: "generator", label: "Generator", icon: "wand" },
    { id: "registry", label: "Vault", icon: "inbox" },
    { id: "tester", label: "Safe Tester", icon: "flask" },
    { id: "data", label: "Export / Import", icon: "download" },
    { id: "analytics", label: "Analytics", icon: "chart" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];
  var TITLES = {
    generator: ["Alias Generator", "Auto, manual & smart-set Gmail alias creation"],
    registry: ["Alias Vault", "Search, organise, favorite & track every saved alias"],
    tester: ["Safe Tester", "Validate aliases with syntax checks and a local sandbox"],
    data: ["Export & Import", "Move aliases in and out as CSV, JSON or TXT"],
    analytics: ["Analytics", "Usage, copy history & activity at a glance"],
    settings: ["Settings", "Base inbox, defaults, categories & data management"],
  };

  function navigate(view) {
    if (!TITLES[view]) view = "generator";
    S.setUI({ view: view });
  }

  function renderShell() {
    var st = S.state;
    // sidebar nav counts
    var counts = {
      registry: st.aliases.length,
      tester: st.testerResults.length,
    };
    var navHtml = NAV.map(function (n) {
      var c = counts[n.id];
      return '<a class="nav-item" data-nav="' + n.id + '">' + icon(n.icon) +
        '<span>' + n.label + '</span>' +
        (c ? '<span class="count">' + c + '</span>' : '') + '</a>';
    }).join("");

    document.getElementById("nav-items").innerHTML = navHtml;
    document.querySelectorAll("#nav-items .nav-item").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-nav") === st.ui.view);
      a.onclick = function () { navigate(a.getAttribute("data-nav")); closeDrawer(); };
    });

    var t = TITLES[st.ui.view];
    document.getElementById("page-title").textContent = t[0];
    document.getElementById("page-sub").textContent = t[1];
    renderQuickCopy();
  }

  function renderQuickCopy() {
    var el2 = document.getElementById("quick-copy");
    if (!el2) return;
    var last = S.lastCopied();
    if (!last) { el2.classList.add("hide"); return; }
    el2.classList.remove("hide");
    el2.innerHTML = icon("copy") + '<span class="qc-alias">' + esc(last.alias) + '</span>';
    el2.title = "Copy " + last.alias;
    el2.onclick = function () { copyText(last.alias).then(function () { S.markCopied(last.id); toast("Copied: " + last.alias, "success"); }); };
  }

  // ---------- theme / accent ----------
  function applyTheme() {
    var s = S.state.settings;
    document.documentElement.setAttribute("data-theme", s.theme);
    document.documentElement.setAttribute("data-density", s.density);
    var ac = S.ACCENTS[s.accent] || S.ACCENTS.cyan;
    var r = document.documentElement.style;
    r.setProperty("--accent", ac.a);
    r.setProperty("--accent-strong", ac.strong);
    r.setProperty("--accent-contrast", ac.contrast);
    r.setProperty("--accent-glow", ac.glow);
    var ti = document.getElementById("theme-toggle");
    if (ti) ti.innerHTML = icon(s.theme === "dark" ? "sun" : "moon");
  }
  function toggleTheme() {
    S.updateSettings({ theme: S.state.settings.theme === "dark" ? "light" : "dark" });
  }

  // ---------- mobile drawer ----------
  function openDrawer() {
    document.getElementById("sidebar").classList.add("open");
    var s = el('<div id="drawer-scrim"></div>');
    s.onclick = closeDrawer;
    document.body.appendChild(s);
  }
  function closeDrawer() {
    document.getElementById("sidebar").classList.remove("open");
    var s = document.getElementById("drawer-scrim");
    if (s) s.remove();
  }

  // ---------- command palette ----------
  var cmdkOpen = false, cmdkIndex = 0, cmdkFiltered = [];
  function commands() {
    return [
      { group: "Create", label: "Generate aliases", icon: "wand", sc: "G", run: function () { navigate("generator"); setTimeout(function () { var v = GACC.views.generator; if (v.quickGenerate) v.quickGenerate(); }, 30); } },
      { group: "Create", label: "Generate smart set (all packs)", icon: "layers", sc: "\u21E7G", run: function () { navigate("generator"); setTimeout(function () { var v = GACC.views.generator; if (v.quickSmartSet) v.quickSmartSet(); }, 30); } },
      { group: "Create", label: "Create manual alias", icon: "edit", sc: "N", run: openManual },
      { group: "Actions", label: "Copy latest alias", icon: "copy", sc: "C", run: copyLatest },
      { group: "Actions", label: "Export all as CSV", icon: "file", sc: "\u2318E", run: function () { GACC.exporter.download(S.state.aliases, "csv", "all"); } },
      { group: "Actions", label: "Export all as JSON", icon: "code", run: function () { GACC.exporter.download(S.state.aliases, "json", "all"); } },
      { group: "Actions", label: "Clear unsaved preview", icon: "refresh", run: function () { navigate("generator"); toast("Preview is cleared on navigation", "info"); } },
      { group: "Navigate", label: "Open Alias Vault", icon: "inbox", run: function () { navigate("registry"); } },
      { group: "Navigate", label: "Open Safe Tester", icon: "flask", run: function () { navigate("tester"); } },
      { group: "Navigate", label: "Open Export / Import", icon: "download", run: function () { navigate("data"); } },
      { group: "Navigate", label: "Open Analytics", icon: "chart", run: function () { navigate("analytics"); } },
      { group: "Navigate", label: "Open Settings", icon: "settings", run: function () { navigate("settings"); } },
      { group: "Preferences", label: "Toggle dark / light theme", icon: S.state.settings.theme === "dark" ? "sun" : "moon", run: toggleTheme },
    ];
  }

  function openManual() {
    navigate("generator");
    setTimeout(function () {
      var tabs = document.querySelectorAll("#gen-tabs button");
      if (tabs[1]) tabs[1].click();
      setTimeout(function () { var s = document.getElementById("ma-suffix"); if (s) s.focus(); }, 40);
    }, 30);
  }
  function copyLatest() {
    var last = S.lastCopied() || S.state.aliases[0];
    if (!last) return toast("No aliases yet", "warn");
    copyText(last.alias).then(function () { S.markCopied(last.id); toast("Copied: " + last.alias, "success"); });
  }
  function focusSearch() {
    navigate("registry");
    setTimeout(function () { var s = document.getElementById("vault-search"); if (s) s.focus(); }, 40);
  }
  function saveCurrent() {
    if (S.state.ui.view !== "generator") { navigate("generator"); return toast("Configure an alias, then Save", "info"); }
    var btn = document.querySelector("#pv-save-all") || document.querySelector('[data-msave="save"]') || document.querySelector("#sm-save");
    if (btn && !btn.disabled) btn.click();
    else toast("Generate or type an alias first", "warn");
  }
  function renderCmdk(filter) {
    var all = commands();
    var q = (filter || "").toLowerCase();
    cmdkFiltered = all.filter(function (c) { return c.label.toLowerCase().indexOf(q) !== -1; });
    if (cmdkIndex >= cmdkFiltered.length) cmdkIndex = 0;
    var list = document.getElementById("cmdk-list");
    var lastGroup = null, html = "";
    cmdkFiltered.forEach(function (c, i) {
      if (c.group !== lastGroup) { html += '<div class="cmdk-group">' + esc(c.group) + '</div>'; lastGroup = c.group; }
      html += '<div class="cmdk-item ' + (i === cmdkIndex ? "active" : "") + '" data-i="' + i + '">' +
        icon(c.icon) + '<span>' + esc(c.label) + '</span>' + (c.sc ? '<span class="kbd sc">' + esc(c.sc) + '</span>' : '') + '</div>';
    });
    if (!cmdkFiltered.length) html = '<div class="empty" style="padding:32px"><p>No commands found</p></div>';
    list.innerHTML = html;
    list.querySelectorAll(".cmdk-item").forEach(function (it) {
      it.onmousemove = function () { cmdkIndex = +it.getAttribute("data-i"); paintCmdkActive(); };
      it.onclick = function () { runCmdk(+it.getAttribute("data-i")); };
    });
  }
  function paintCmdkActive() {
    document.querySelectorAll("#cmdk-list .cmdk-item").forEach(function (it) {
      it.classList.toggle("active", +it.getAttribute("data-i") === cmdkIndex);
    });
  }
  function runCmdk(i) {
    var c = cmdkFiltered[i];
    if (c) { closeCmdk(); c.run(); }
  }
  function openCmdk() {
    if (cmdkOpen) return;
    cmdkOpen = true; cmdkIndex = 0;
    document.getElementById("cmdk-scrim").classList.remove("hide");
    var input = document.getElementById("cmdk-input");
    input.value = ""; renderCmdk("");
    setTimeout(function () { input.focus(); }, 10);
  }
  function closeCmdk() {
    cmdkOpen = false;
    document.getElementById("cmdk-scrim").classList.add("hide");
  }

  // ---------- main render dispatch ----------
  function render() {
    renderShell();
    var container = document.getElementById("view");
    var view = S.state.ui.view;
    var V = window.GACC.views[view];
    if (V) {
      container.innerHTML = '<div class="view-wrap fade-in">' + V.render() + "</div>";
      if (V.mount) V.mount(container);
    }
  }

  // ---------- compliance first-run ----------
  function maybeShowCompliance() {
    if (S.state.settings.complianceAcknowledged) return;
    showComplianceModal(true);
  }
  function showComplianceModal(firstRun) {
    var m = openModal(
      '<div class="modal-head"><h3>' + icon("shield") + ' Authorized & legitimate use only</h3></div>' +
      '<div class="modal-body">' +
      '<p style="margin:0 0 14px;color:var(--text-dim);line-height:1.6">This tool generates Gmail address variations (plus-addressing and dot-spellings — both standard, supported Gmail features) to help you organize your own inbox, label signups, and run QA on systems you control. Note: strict signup validators frequently reject the <b>+</b> in plus-addresses, while dot-spellings pass and reach the same inbox — prefer dots when a form refuses your alias.</p>' +
      '<div class="notice warn" style="margin-bottom:12px">' + icon("alert") + '<div>Only test aliases against websites, forms, systems, and domains that <b>you own, control, or are explicitly authorized to test.</b></div></div>' +
      '<div class="notice info">' + icon("info") + '<div>This app does <b>not</b> perform account-creation automation, ban evasion, CAPTCHA bypass, proxy rotation, fingerprint spoofing, or any abuse/evasion behavior. Outbound testing here is limited to syntax checks and a local sandbox.</div></div>' +
      '</div>' +
      '<div class="modal-foot">' +
      (firstRun ? '' : '<button class="btn btn-ghost" data-act="close">Close</button>') +
      '<button class="btn btn-primary" data-act="ok">' + (firstRun ? "I understand & agree" : "Got it") + '</button></div>',
      { sticky: firstRun }
    );
    if (m.querySelector('[data-act="close"]')) m.querySelector('[data-act="close"]').onclick = closeModal;
    m.querySelector('[data-act="ok"]').onclick = function () {
      S.updateSettings({ complianceAcknowledged: true });
      closeModal();
    };
  }

  // ---------- init ----------
  function init() {
    S.load();
    applyTheme();
    S.subscribe(function () { applyTheme(); render(); });
    render();

    document.getElementById("hamburger").onclick = openDrawer;
    document.getElementById("theme-toggle").onclick = toggleTheme;
    document.getElementById("compliance-link").onclick = function () { showComplianceModal(false); };
    document.getElementById("cmdk-trigger").onclick = openCmdk;
    document.getElementById("help-btn").onclick = function () { showComplianceModal(false); };

    var cmdkInput = document.getElementById("cmdk-input");
    cmdkInput.oninput = function () { cmdkIndex = 0; renderCmdk(cmdkInput.value); };
    document.getElementById("cmdk-scrim").addEventListener("mousedown", function (e) {
      if (e.target.id === "cmdk-scrim") closeCmdk();
    });

    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); cmdkOpen ? closeCmdk() : openCmdk(); return; }
      if (e.key === "Escape") { if (cmdkOpen) closeCmdk(); else if (activeModal && !activeModal.querySelector(".modal")) {} else closeModal(); return; }
      if (cmdkOpen) {
        if (e.key === "ArrowDown") { e.preventDefault(); cmdkIndex = Math.min(cmdkIndex + 1, cmdkFiltered.length - 1); paintCmdkActive(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); cmdkIndex = Math.max(cmdkIndex - 1, 0); paintCmdkActive(); }
        else if (e.key === "Enter") { e.preventDefault(); runCmdk(cmdkIndex); }
      } else {
        // global shortcuts (ignore when typing in a field)
        var tag = (e.target.tagName || "").toLowerCase();
        var typing = tag === "input" || tag === "textarea" || tag === "select";
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveCurrent(); return; }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") { e.preventDefault(); GACC.exporter.download(S.state.aliases, "csv", "all"); return; }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === "/" && !typing) { e.preventDefault(); focusSearch(); return; }
        if (typing) return;
        var k = e.key;
        if (k === "G" && e.shiftKey) { navigate("generator"); setTimeout(function () { if (GACC.views.generator.quickSmartSet) GACC.views.generator.quickSmartSet(); }, 30); return; }
        switch (k.toLowerCase()) {
          case "g": navigate("generator"); setTimeout(function () { if (GACC.views.generator.quickGenerate) GACC.views.generator.quickGenerate(); }, 30); break;
          case "n": openManual(); break;
          case "c": copyLatest(); break;
          case "s": saveCurrent(); break;
        }
      }
    });

    maybeShowCompliance();
  }

  window.GACC.ui = {
    esc: esc, attr: attr, el: el, icon: icon,
    highlightAlias: highlightAlias, relTime: relTime, fmtDate: fmtDate,
    copyText: copyText, toast: toast,
    openModal: openModal, closeModal: closeModal, confirmDialog: confirmDialog, promptDialog: promptDialog,
    navigate: navigate, render: render, applyTheme: applyTheme,
    showComplianceModal: showComplianceModal,
    init: init,
  };
})();

/* ===== js/views/generator.js ===== */
/* Gmail Alias Control Center — Generator view (Auto / Manual / Smart Sets) */
(function () {
  "use strict";
  var L = window.GACC.logic, S = window.GACC.store, U = window.GACC.ui;
  var icon = U.icon, esc = U.esc, attr = U.attr;

  var gen = null;
  var VALID_MODES = ["number", "service", "campaign", "random", "date", "dot", "hybrid"];
  function ensureState() {
    if (gen) return;
    var s = S.state.settings;
    var dm = VALID_MODES.indexOf(s.defaultMode) !== -1 ? s.defaultMode : "number";
    gen = {
      tab: "auto",
      mode: dm,
      count: s.defaultBatch || 10,
      start: 1,
      prefix: "",
      suffix: "",
      services: "",
      campaign: "",
      includeDots: false,
      category: "Custom",
      tags: "",
      preview: [],
      selected: {},
      manualSuffix: "",
      manualLabel: "",
      manualCategory: "Custom",
      manualTags: "",
      manualNotes: "",
      pack: null,
      packPreview: [],
    };
  }

  var MODES = [
    { id: "number", label: "Number", hint: "+1, +2, +3 …" },
    { id: "service", label: "Service", hint: "+amazon, +netflix …" },
    { id: "campaign", label: "Campaign", hint: "+summer2026" },
    { id: "random", label: "Random", hint: "+x7k92" },
    { id: "date", label: "Date", hint: "+2026-06-12" },
    { id: "dot", label: "Dots", hint: "e.u.r.o.p…" },
    { id: "hybrid", label: "Hybrid", hint: "dots + +service" },
  ];

  function base() { return S.state.settings.baseEmail; }

  // ---------------- main render ----------------
  function render() {
    ensureState();
    return infoBox() + baseBar() +
      '<div class="segmented mb" id="gen-tabs" style="width:100%">' +
        [["auto", "Auto generate", "wand"], ["manual", "Manual creator", "edit"], ["smart", "Smart sets", "layers"]].map(function (t) {
          return '<button class="' + (gen.tab === t[0] ? "active accent" : "") + '" data-tab="' + t[0] + '" style="flex:1">' + icon(t[2]) + ' ' + esc(t[1]) + '</button>';
        }).join("") +
      '</div>' +
      (gen.tab === "auto" ? autoTab() : gen.tab === "manual" ? manualTab() : smartTab());
  }

  function infoBox() {
    return '<div class="notice info mb">' + icon("info") +
      '<div><b>Gmail aliases all reach the same inbox.</b> Adding <span class="mono">+label</span> or extra dots to <span class="mono">' + esc(base()) + '</span> still delivers to that one account — they\'re for organising, filtering, and seeing where mail comes from. Don\'t use them for spam, abuse, ban evasion, or breaking a site\'s rules.</div></div>' +
      '<div class="notice warn mb">' + icon("alert") +
      '<div><b>Strict forms often reject the <span class="mono">+</span>.</b> Many signup validators refuse plus-addresses as "invalid", but dot-spellings like <span class="mono">e.urop.carco69@gmail.com</span> pass the same validators and route to the identical inbox. <b>Prefer the Dots mode</b> whenever a form refuses your alias.</div></div>';
  }

  function baseBar() {
    return '<div class="card mb"><div class="card-pad" style="padding:14px 18px">' +
      '<div class="row" style="gap:12px;flex-wrap:wrap">' +
        '<label style="font-size:12.5px;font-weight:600;color:var(--text-dim);display:flex;align-items:center;gap:6px">Base inbox' +
          '<span class="tip">' + icon("info") + '<span class="tip-body">This is your real Gmail address. Every alias you generate is a variation of it and lands in this same inbox.</span></span>' +
        '</label>' +
        '<input class="input mono flex1" id="gen-base" value="' + attr(base()) + '" spellcheck="false" style="min-width:220px">' +
        '<span id="gen-base-msg" style="font-size:12px"></span>' +
      '</div></div></div>';
  }

  // ---------------- AUTO ----------------
  function autoTab() {
    var s = S.state.settings;
    var needsStart = ["number", "campaign", "date"].indexOf(gen.mode) !== -1;
    var needsServices = gen.mode === "service" || gen.mode === "hybrid";
    var needsCampaign = gen.mode === "campaign";
    var canDot = ["number", "service", "campaign", "random", "date"].indexOf(gen.mode) !== -1;

    return '<div class="grid cols-2" style="grid-template-columns:1.05fr 1fr;align-items:start">' +
      '<div class="card"><div class="card-head">' + icon("wand") + '<div><h3>Auto generate</h3><div class="sub">Bulk-create alias variations</div></div></div>' +
      '<div class="card-pad">' +
        '<div class="field"><label>Generation mode</label><select class="select" id="au-mode">' +
          MODES.map(function (m) { return '<option value="' + m.id + '"' + (m.id === gen.mode ? " selected" : "") + '>' + esc(m.label) + ' — ' + esc(m.hint) + '</option>'; }).join("") +
        '</select></div>' +
        '<div class="grid cols-2" style="gap:14px">' +
          '<div class="field" style="margin-bottom:0"><label>Amount</label><input class="input mono" id="au-count" type="number" min="1" max="' + s.maxBatch + '" value="' + gen.count + '"></div>' +
          (needsStart ? '<div class="field" style="margin-bottom:0"><label>Starting number</label><input class="input mono" id="au-start" type="number" min="0" value="' + gen.start + '"></div>' : '<div></div>') +
        '</div>' +
        (needsServices ? '<div class="field mt"><label>Services <span class="muted">comma-separated, optional</span></label><input class="input mono" id="au-services" value="' + attr(gen.services) + '" placeholder="amazon, netflix, booking"></div>' : '') +
        (needsCampaign ? '<div class="field mt"><label>Campaign name</label><input class="input" id="au-campaign" value="' + attr(gen.campaign) + '" placeholder="summer2026"></div>' : '') +
        '<div class="grid cols-2 mt" style="gap:14px">' +
          '<div class="field" style="margin-bottom:0"><label>Prefix label <span class="muted">{prefix}</span></label><input class="input mono" id="au-prefix" value="' + attr(gen.prefix) + '" placeholder="acc"></div>' +
          '<div class="field" style="margin-bottom:0"><label>Suffix label <span class="muted">{suffix}</span></label><input class="input mono" id="au-suffix" value="' + attr(gen.suffix) + '" placeholder="2026"></div>' +
        '</div>' +
        (canDot ? '<label class="checkbox-row mt"><input type="checkbox" class="cb" id="au-dots"' + (gen.includeDots ? " checked" : "") + '><label for="au-dots">Include dot variations in the local part (hybrid)</label></label>' : '') +
        '<div class="grid cols-2 mt" style="gap:14px">' +
          '<div class="field" style="margin-bottom:0"><label>Category</label>' + categorySelect("au-category", gen.category) + '</div>' +
          '<div class="field" style="margin-bottom:0"><label>Tags <span class="muted">comma-sep</span></label><input class="input" id="au-tags" value="' + attr(gen.tags) + '" placeholder="work, signups"></div>' +
        '</div>' +
        '<label class="checkbox-row mt"><input type="checkbox" class="cb" id="au-autosave"' + (s.autoSave ? " checked" : "") + '><label for="au-autosave">Auto-save generated aliases to the vault</label></label>' +
        '<button class="btn btn-primary btn-block mt-lg" id="au-gen">' + icon("wand") + 'Generate aliases <span class="kbd" style="margin-left:4px">G</span></button>' +
      '</div></div>' +
      previewCard("au") +
    '</div>';
  }

  // ---------------- MANUAL ----------------
  function manualTab() {
    var v = gen.manualSuffix ? L.validateManual(base(), gen.manualSuffix) : null;
    return '<div class="grid cols-2" style="align-items:start">' +
      '<div class="card"><div class="card-head">' + icon("edit") + '<div><h3>Manual alias creator</h3><div class="sub">Type a label, get a validated alias</div></div></div>' +
      '<div class="card-pad">' +
        '<div class="field"><label>Alias label / suffix</label>' +
          '<div class="row" style="gap:0;align-items:stretch">' +
            '<span class="input mono" style="border-right:0;border-radius:var(--r-sm) 0 0 var(--r-sm);width:auto;color:var(--text-faint);display:flex;align-items:center;white-space:nowrap">' + esc(localPlus()) + '</span>' +
            '<input class="input mono" id="ma-suffix" value="' + attr(gen.manualSuffix) + '" placeholder="amazon" style="border-radius:0 var(--r-sm) var(--r-sm) 0;flex:1" autocomplete="off" spellcheck="false">' +
          '</div>' +
          '<div class="hint" id="ma-tip"></div>' +
        '</div>' +
        '<div class="grid cols-2" style="gap:14px">' +
          '<div class="field" style="margin-bottom:0"><label>Name / label</label><input class="input" id="ma-label" value="' + attr(gen.manualLabel) + '" placeholder="Amazon account"></div>' +
          '<div class="field" style="margin-bottom:0"><label>Category</label>' + categorySelect("ma-category", gen.manualCategory) + '</div>' +
        '</div>' +
        '<div class="field mt"><label>Tags <span class="muted">comma-separated</span></label><input class="input" id="ma-tags" value="' + attr(gen.manualTags) + '" placeholder="shopping, client"></div>' +
        '<div class="field"><label>Notes</label>' +
          '<div class="row gap-sm mb" style="flex-wrap:wrap">' + noteTemplates().map(function (n, i) { return '<span class="chip var" data-note="' + i + '">' + esc(n.label) + '</span>'; }).join("") + '</div>' +
          '<textarea class="textarea" id="ma-notes" placeholder="optional">' + esc(gen.manualNotes) + '</textarea></div>' +
      '</div></div>' +
      '<div class="card"><div class="card-head">' + icon("eye") + '<div><h3>Preview &amp; save</h3><div class="sub">Validated before saving</div></div></div>' +
      '<div class="card-pad">' +
        manualPreview(v) +
      '</div></div>' +
    '</div>';
  }

  function localPlus() {
    var p = L.splitEmail(base());
    var local = (p.local || "").split("+")[0].toLowerCase();
    return local + "+";
  }

  function manualPreview(v) {
    if (!gen.manualSuffix) {
      return '<div class="empty"><div class="ic">' + icon("at") + '</div><h4>Type a label</h4><p>Enter a word like <span class="mono">amazon</span> to build <span class="mono">' + esc(localPlus()) + 'amazon@…</span></p></div>';
    }
    var exists = v.ok && S.state.aliases.some(function (a) { return a.alias.toLowerCase() === v.alias.toLowerCase(); });
    if (!v.ok) {
      return '<div class="notice danger">' + icon("alert") + '<div>' + v.reasons.map(esc).join("<br>") + '</div></div>';
    }
    return '<div class="preview-item" style="font-size:15px;padding:14px 16px">' + U.highlightAlias(v.alias) + '</div>' +
      (exists ? '<div class="notice warn mt">' + icon("alert") + '<div>This alias already exists in your vault.</div></div>'
              : '<div class="notice info mt">' + icon("check") + '<div>Valid &amp; Gmail-safe. Reaches <b>' + esc(base()) + '</b>.</div></div>') +
      '<div class="notice info mt" style="align-items:flex-start">' + icon("inbox") + '<div style="font-size:11.5px">' + esc(L.filterSuggestion(v.alias, gen.manualLabel || v.suffix)) + '</div></div>' +
      '<div class="grid cols-2 mt-lg" style="gap:10px">' +
        '<button class="btn btn-primary" data-msave="save"' + (exists ? " disabled" : "") + '>' + icon("save") + 'Save alias</button>' +
        '<button class="btn" data-msave="copy"' + (exists ? " disabled" : "") + '>' + icon("copy") + 'Save &amp; copy</button>' +
        '<button class="btn" data-msave="used"' + (exists ? " disabled" : "") + '>' + icon("check") + 'Save &amp; mark used</button>' +
        '<button class="btn" data-msave="fav"' + (exists ? " disabled" : "") + '>' + icon("star") + 'Save as favorite</button>' +
      '</div>';
  }

  // ---------------- SMART SETS ----------------
  function smartTab() {
    var packs = Object.keys(L.SMART_SETS);
    return '<div class="grid cols-2" style="grid-template-columns:1fr 1fr;align-items:start">' +
      '<div class="card"><div class="card-head">' + icon("layers") + '<div><h3>Smart sets</h3><div class="sub">Preset alias packs by use-case</div></div>' +
        '<div class="right"><button class="btn btn-sm btn-primary" id="sm-all">' + icon("wand") + 'Generate all <span class="kbd" style="margin-left:3px">⇧G</span></button></div></div>' +
      '<div class="card-pad"><div class="grid cols-2" style="gap:10px">' +
        packs.map(function (p) {
          var items = L.SMART_SETS[p].items;
          return '<button class="pack" data-pack="' + attr(p) + '"><div class="row spread"><span class="p-name">' + esc(p) + '</span>' + icon("plus") + '</div>' +
            '<div class="p-items">' + esc(items.slice(0, 4).join(", ")) + '…</div></button>';
        }).join("") +
      '</div></div></div>' +
      '<div class="card"><div class="card-head">' + icon("sparkles") + '<div><h3>Smart suggestions</h3><div class="sub">Common aliases — click to save &amp; copy</div></div></div>' +
      '<div class="card-pad"><div style="display:flex;flex-direction:column;gap:7px">' +
        L.SMART_SUGGESTIONS.map(function (sg) {
          var p = L.splitEmail(base());
          var alias = (p.local || "").split("+")[0].toLowerCase() + "+" + sg.suffix + "@" + p.domain;
          var exists = S.state.aliases.some(function (a) { return a.alias.toLowerCase() === alias.toLowerCase(); });
          return '<div class="sugg" data-sugg="' + attr(sg.suffix) + '" data-cat="' + attr(sg.category) + '">' +
            '<span class="s-alias">' + U.highlightAlias(alias) + '</span>' +
            '<span class="s-cat">' + esc(sg.category) + '</span>' +
            '<span class="s-add">' + icon(exists ? "check" : "plus") + '</span></div>';
        }).join("") +
      '</div></div></div>' +
      (gen.pack ? packPreviewCard() : '') +
    '</div>';
  }

  function packPreviewCard() {
    var pack = L.SMART_SETS[gen.pack];
    return '<div class="card span-2"><div class="card-head">' + icon("eye") + '<div><h3>' + esc(gen.pack) + '</h3><div class="sub">' + gen.packPreview.length + ' aliases · category ' + esc(pack.category) + '</div></div>' +
      '<div class="right"><button class="btn btn-sm btn-primary" id="sm-save">' + icon("save") + 'Save pack</button></div></div>' +
      '<div class="card-pad"><div class="grid cols-2" style="gap:8px">' +
        gen.packPreview.map(function (a) {
          var exists = S.state.aliases.some(function (x) { return x.alias.toLowerCase() === a.alias.toLowerCase(); });
          return '<div class="preview-item"><span class="flex1">' + U.highlightAlias(a.alias) + '</span>' + (exists ? '<span class="muted" style="font-size:11px">saved</span>' : '') + '</div>';
        }).join("") +
      '</div></div></div>';
  }

  // ---------------- shared preview (auto) ----------------
  function previewCard(prefix) {
    var list = gen.preview;
    var body;
    if (!list.length) {
      body = '<div class="empty"><div class="ic">' + icon("at") + '</div><h4>Nothing generated yet</h4><p>Configure a mode and press Generate to preview aliases before saving.</p></div>';
    } else {
      var selCount = list.filter(function (a) { return gen.selected[a.alias]; }).length;
      body = '<div class="row spread mb"><label class="row gap-sm" style="font-size:12.5px;font-weight:600;cursor:pointer"><input type="checkbox" class="cb" id="pv-all"' + (selCount === list.length ? " checked" : "") + '> Select all (' + selCount + '/' + list.length + ')</label>' +
        '<button class="btn btn-sm btn-ghost" id="pv-copy">' + icon("copy") + 'Copy all</button></div>' +
        '<div class="preview-list">' + list.map(function (a) {
          var exists = S.state.aliases.some(function (x) { return x.alias.toLowerCase() === a.alias.toLowerCase(); });
          return '<label class="preview-item" style="cursor:pointer">' +
            '<input type="checkbox" class="cb pv-cb" data-alias="' + attr(a.alias) + '"' + (gen.selected[a.alias] ? " checked" : "") + '>' +
            '<span class="flex1">' + U.highlightAlias(a.alias) + '</span>' +
            (exists ? '<span class="muted" style="font-size:11px">saved</span>' : '') +
            '<button type="button" class="icon-btn pv-copy1" data-alias="' + attr(a.alias) + '" style="width:28px;height:28px">' + icon("copy") + '</button></label>';
        }).join("") + '</div>' +
        '<div class="grid cols-2 mt-lg" style="gap:10px">' +
          '<button class="btn btn-primary" id="pv-save-sel">' + icon("save") + 'Save selected</button>' +
          '<button class="btn" id="pv-save-all">' + icon("save") + 'Save all</button>' +
        '</div>';
    }
    return '<div class="card"><div class="card-head">' + icon("eye") + '<div><h3>Preview</h3><div class="sub" id="pv-sub">' + (list.length ? list.length + " generated" : "Live preview before saving") + '</div></div></div>' +
      '<div class="card-pad" id="pv-box">' + body + '</div></div>';
  }

  // ---------------- helpers ----------------
  function categorySelect(id, val) {
    return '<select class="select" id="' + id + '">' + S.state.settings.categories.map(function (c) {
      return '<option' + (c === val ? " selected" : "") + '>' + esc(c) + '</option>';
    }).join("") + '</select>';
  }
  function noteTemplates() {
    return [
      { label: "Signup", text: "Used to sign up for this service." },
      { label: "Newsletter", text: "Newsletter / marketing list — unsubscribe link saved." },
      { label: "Client", text: "Shared with a client / external contact." },
      { label: "Trial", text: "Free trial — remember to cancel before renewal." },
    ];
  }

  function autoOpts() {
    return {
      mode: gen.mode, count: gen.count, start: gen.start,
      prefix: gen.prefix, suffix: gen.suffix, includeDots: gen.includeDots,
      services: gen.services.split(",").map(function (s) { return L.slug(s); }).filter(Boolean),
      campaign: gen.campaign,
    };
  }

  function runGenerate(save) {
    var v = L.validateBase(base());
    if (!v.ok) return U.toast(v.reasons[0], "error");
    var res = L.generateAuto(base(), autoOpts());
    if (!res.aliases.length) return U.toast("No aliases generated", "warn");
    gen.preview = res.aliases;
    gen.selected = {};
    res.aliases.forEach(function (a) { gen.selected[a.alias] = true; });
    if (save) savePreview(res.aliases, "all");
    else U.render();
  }

  function savePreview(items, scope) {
    var toSave = scope === "selected" ? items.filter(function (a) { return gen.selected[a.alias]; }) : items;
    if (!toSave.length) return U.toast("Nothing selected", "warn");
    var tags = gen.tags.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
    var r = S.addAliases(toSave, { baseEmail: L.validateBase(base()).normalized, category: gen.category, tags: tags, pattern: gen.preview.length ? (S.findAlias ? "" : "") : "", status: "Saved" });
    if (r.added) U.toast("Saved " + r.added + " aliases" + (r.dupes ? " (" + r.dupes + " dupes skipped)" : ""), "success");
    else U.toast("All " + r.dupes + " already in vault", "warn");
  }

  function validateBaseUI() {
    var msg = document.getElementById("gen-base-msg");
    if (!msg) return;
    var v = L.validateBase(base());
    msg.innerHTML = v.ok ? '<span class="text-good">' + icon("check") + ' reaches this inbox</span>' : '<span class="text-bad">' + esc(v.reasons[0]) + '</span>';
  }

  // ---------------- mount ----------------
  function mount(root) {
    root.querySelectorAll("#gen-tabs button").forEach(function (b) {
      b.onclick = function () { gen.tab = b.getAttribute("data-tab"); U.render(); };
    });
    var baseInp = root.querySelector("#gen-base");
    if (baseInp) baseInp.oninput = function () {
      S.state.settings.baseEmail = baseInp.value.trim();
      S.persist();
      validateBaseUI();
      if (gen.tab === "manual") refreshManual(root);
    };
    validateBaseUI();

    if (gen.tab === "auto") mountAuto(root);
    else if (gen.tab === "manual") mountManual(root);
    else mountSmart(root);
  }

  function mountAuto(root) {
    bindVal(root, "#au-mode", function (v) { gen.mode = v; U.render(); });
    bindNum(root, "#au-count", function (v) { gen.count = v; });
    bindNum(root, "#au-start", function (v) { gen.start = v; });
    bindText(root, "#au-prefix", function (v) { gen.prefix = v; });
    bindText(root, "#au-suffix", function (v) { gen.suffix = v; });
    bindText(root, "#au-services", function (v) { gen.services = v; });
    bindText(root, "#au-campaign", function (v) { gen.campaign = v; });
    bindVal(root, "#au-category", function (v) { gen.category = v; });
    bindText(root, "#au-tags", function (v) { gen.tags = v; });
    var dots = root.querySelector("#au-dots"); if (dots) dots.onchange = function () { gen.includeDots = dots.checked; };
    var asave = root.querySelector("#au-autosave"); if (asave) asave.onchange = function () { S.updateSettings({ autoSave: asave.checked }); };
    var g = root.querySelector("#au-gen"); if (g) g.onclick = function () { runGenerate(S.state.settings.autoSave); };
    mountPreview(root);
  }

  function mountPreview(root) {
    var all = root.querySelector("#pv-all");
    if (all) all.onchange = function () {
      gen.preview.forEach(function (a) { gen.selected[a.alias] = all.checked; });
      U.render();
    };
    root.querySelectorAll(".pv-cb").forEach(function (cb) {
      cb.onchange = function () { gen.selected[cb.getAttribute("data-alias")] = cb.checked; };
    });
    root.querySelectorAll(".pv-copy1").forEach(function (b) {
      b.onclick = function (e) { e.preventDefault(); U.copyText(b.getAttribute("data-alias")).then(function () { U.toast("Copied", "success"); }); };
    });
    var ca = root.querySelector("#pv-copy");
    if (ca) ca.onclick = function () { U.copyText(gen.preview.map(function (a) { return a.alias; }).join("\n")).then(function () { U.toast("Copied " + gen.preview.length + " aliases", "success"); }); };
    var ss = root.querySelector("#pv-save-sel"); if (ss) ss.onclick = function () { savePreview(gen.preview, "selected"); };
    var sa = root.querySelector("#pv-save-all"); if (sa) sa.onclick = function () { savePreview(gen.preview, "all"); };
  }

  function refreshManual(root) {
    var box = root.querySelector(".card-pad #ma-tip") ? root : root;
    // re-render preview side only
    var v = gen.manualSuffix ? L.validateManual(base(), gen.manualSuffix) : null;
    var card = root.querySelectorAll(".card")[1];
    if (card) {
      var pad = card.querySelector(".card-pad");
      pad.innerHTML = manualPreview(v);
      wireManualSave(root);
    }
    var tip = root.querySelector("#ma-tip");
    if (tip) tip.innerHTML = gen.manualSuffix ? '<span class="text-dim">' + esc(L.namingTip(gen.manualSuffix)) + '</span>' : "";
  }

  function wireManualSave(root) {
    root.querySelectorAll("[data-msave]").forEach(function (b) {
      b.onclick = function () {
        var v = L.validateManual(base(), gen.manualSuffix);
        if (!v.ok) return U.toast(v.reasons[0], "error");
        var act = b.getAttribute("data-msave");
        var tags = gen.manualTags.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
        var meta = {
          baseEmail: L.validateBase(base()).normalized, category: gen.manualCategory,
          tags: tags, notes: gen.manualNotes, label: gen.manualLabel || v.suffix,
          status: act === "used" ? "Used" : "Saved", favorite: act === "fav",
        };
        var r = S.addAliases([{ alias: v.alias, suffix: v.suffix }], meta);
        if (!r.added) return U.toast("Already in vault", "warn");
        if (act === "copy") U.copyText(v.alias).then(function () { S.markCopied(S.state.aliases[0].id); });
        U.toast(act === "copy" ? "Saved & copied" : act === "fav" ? "Saved as favorite" : act === "used" ? "Saved & marked used" : "Alias saved", "success");
        gen.manualSuffix = ""; gen.manualLabel = ""; gen.manualNotes = "";
        U.render();
      };
    });
  }

  function mountManual(root) {
    bindText(root, "#ma-label", function (v) { gen.manualLabel = v; });
    bindVal(root, "#ma-category", function (v) { gen.manualCategory = v; });
    bindText(root, "#ma-tags", function (v) { gen.manualTags = v; });
    var notes = root.querySelector("#ma-notes"); if (notes) notes.oninput = function () { gen.manualNotes = notes.value; };
    root.querySelectorAll("[data-note]").forEach(function (c) {
      c.onclick = function () {
        var n = noteTemplates()[+c.getAttribute("data-note")];
        gen.manualNotes = (gen.manualNotes ? gen.manualNotes + " " : "") + n.text;
        var ta = root.querySelector("#ma-notes"); if (ta) ta.value = gen.manualNotes;
      };
    });
    var suf = root.querySelector("#ma-suffix");
    if (suf) suf.oninput = function () { gen.manualSuffix = suf.value; refreshManual(root); };
    wireManualSave(root);
    var tip = root.querySelector("#ma-tip");
    if (tip && gen.manualSuffix) tip.innerHTML = '<span class="text-dim">' + esc(L.namingTip(gen.manualSuffix)) + '</span>';
  }

  function mountSmart(root) {
    root.querySelectorAll("[data-pack]").forEach(function (b) {
      b.onclick = function () {
        gen.pack = b.getAttribute("data-pack");
        var res = L.generatePack(base(), gen.pack);
        gen.packPreview = res.ok ? res.aliases : [];
        U.render();
      };
    });
    var save = root.querySelector("#sm-save");
    if (save) save.onclick = function () {
      var res = L.generatePack(base(), gen.pack);
      var r = S.addAliases(res.aliases, { baseEmail: res.baseEmail, category: res.category, pattern: res.pattern, status: "Saved" });
      U.toast(r.added ? "Saved " + r.added + " from " + gen.pack + (r.dupes ? " (" + r.dupes + " dupes)" : "") : "All already saved", r.added ? "success" : "warn");
    };
    var all = root.querySelector("#sm-all");
    if (all) all.onclick = function () { generateAllPacks(); };
    root.querySelectorAll("[data-sugg]").forEach(function (b) {
      b.onclick = function () {
        var suffix = b.getAttribute("data-sugg"), cat = b.getAttribute("data-cat");
        var v = L.validateManual(base(), suffix);
        if (!v.ok) return U.toast(v.reasons[0], "error");
        var r = S.addAliases([{ alias: v.alias, suffix: suffix, label: suffix }], { baseEmail: L.validateBase(base()).normalized, category: cat, status: "Saved" });
        U.copyText(v.alias).then(function () {
          if (r.added) { S.markCopied(S.state.aliases[0].id); U.toast("Saved & copied " + v.alias, "success"); }
          else U.toast("Already saved — copied " + v.alias, "info");
        });
      };
    });
  }

  function generateAllPacks() {
    var total = 0, dupes = 0;
    Object.keys(L.SMART_SETS).forEach(function (p) {
      var res = L.generatePack(base(), p);
      if (res.ok) { var r = S.addAliases(res.aliases, { baseEmail: res.baseEmail, category: res.category, pattern: res.pattern, status: "Saved" }); total += r.added; dupes += r.dupes; }
    });
    U.toast(total ? "Saved " + total + " aliases from all packs" + (dupes ? " (" + dupes + " dupes)" : "") : "All packs already saved", total ? "success" : "warn");
  }

  function bindVal(root, sel, fn) { var e = root.querySelector(sel); if (e) e.onchange = function () { fn(e.value); }; }
  function bindText(root, sel, fn) { var e = root.querySelector(sel); if (e) e.oninput = function () { fn(e.value); }; }
  function bindNum(root, sel, fn) { var e = root.querySelector(sel); if (e) e.oninput = function () { fn(Math.max(0, +e.value || 0)); }; }

  // expose for shortcuts
  function quickGenerate() { gen.tab = "auto"; runGenerate(S.state.settings.autoSave); }
  function quickSmartSet() { gen.tab = "smart"; generateAllPacks(); }

  window.GACC.views = window.GACC.views || {};
  window.GACC.views.generator = { render: render, mount: mount, quickGenerate: quickGenerate, quickSmartSet: quickSmartSet };
})();

/* ===== js/views/registry.js ===== */
/* Gmail Alias Control Center — Alias Vault (registry) */
(function () {
  "use strict";
  var L = window.GACC.logic, S = window.GACC.store, U = window.GACC.ui;
  var icon = U.icon, esc = U.esc, attr = U.attr;

  function statusBadge(s) {
    return '<span class="badge st-' + s.replace(/\s+/g, ".") + '"><span class="dot"></span>' + esc(s) + '</span>';
  }

  function render() {
    var st = S.state;
    var f = st.ui.filters;
    var filtered = S.filteredAliases();
    var selected = st.ui.selected;

    return dashboardCards() + filterBar(f) + bulkBar(selected) +
      '<div class="card">' + (st.aliases.length ? (filtered.length ? tableBlock(filtered, st.ui, selected) : noMatch()) : emptyVault()) + '</div>';
  }

  function dashboardCards() {
    var st = S.state;
    var cards = [
      ["Total saved", st.aliases.length, "inbox"],
      ["Generated today", S.generatedToday(), "wand"],
      ["Copied today", S.copiedToday(), "copy"],
      ["Unused", S.unusedCount(), "clock"],
      ["Favorites", S.favoritesCount(), "star"],
      ["Archived", S.archivedCount(), "archive"],
    ];
    return '<div class="grid mb" style="grid-template-columns:repeat(6,minmax(0,1fr));gap:12px">' +
      cards.map(function (c) {
        return '<div class="stat" style="padding:14px 16px"><div class="lbl">' + icon(c[2]) + esc(c[0]) + '</div><div class="num" style="font-size:26px">' + c[1] + '</div></div>';
      }).join("") + '</div>';
  }

  function filterBar(f) {
    var bases = S.uniqueBaseEmails(), tags = S.uniqueTags(), cats = S.uniqueCategories();
    var opt = function (val, cur, label) { return '<option value="' + attr(val) + '"' + (cur === val ? " selected" : "") + '>' + esc(label) + '</option>'; };
    var statusOpts = '<option value="all">All statuses</option>' + S.STATUSES.map(function (s) { return opt(s, f.status, s); }).join("");
    var catOpts = '<option value="all">All categories</option>' + Object.keys(cats).map(function (c) { return opt(c, f.category, c + " (" + cats[c] + ")"); }).join("");
    var tagOpts = '<option value="all">All tags</option>' + Object.keys(tags).map(function (t) { return opt(t, f.tag, t + " (" + tags[t] + ")"); }).join("");
    var baseOpts = '<option value="all">All inboxes</option>' + Object.keys(bases).map(function (b) { return opt(b, f.baseEmail, b + " (" + bases[b] + ")"); }).join("");

    return '<div class="card-head" style="flex-wrap:wrap;gap:10px;border:1px solid var(--border);border-radius:var(--r-lg);background:var(--card);margin-bottom:16px">' +
      '<div class="row" style="flex:1;min-width:200px"><div style="position:relative;flex:1">' +
        '<span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text-faint)">' + icon("search") + '</span>' +
        '<input class="input" id="vault-search" value="' + attr(f.search) + '" placeholder="Search aliases, labels, notes…  ( / )" style="padding-left:36px"></div></div>' +
      '<div class="row wrap gap-sm">' +
        '<button class="btn btn-sm ' + (f.favorite ? "btn-primary" : "") + '" id="vault-fav">' + icon("star") + 'Favorites</button>' +
        '<select class="select" id="vault-status" style="width:auto">' + statusOpts + '</select>' +
        '<select class="select" id="vault-category" style="width:auto">' + catOpts + '</select>' +
        '<select class="select" id="vault-tag" style="width:auto">' + tagOpts + '</select>' +
        '<select class="select" id="vault-base" style="width:auto;max-width:180px">' + baseOpts + '</select>' +
      '</div></div>';
  }

  function bulkBar(selected) {
    if (!selected.length) return "";
    return '<div class="card" style="margin-bottom:16px;background:rgba(var(--accent-glow),.05)"><div class="card-pad" style="padding:12px 18px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
      '<b class="text-accent">' + selected.length + ' selected</b>' +
      '<button class="btn btn-sm" data-bulk="copy">' + icon("copy") + 'Copy</button>' +
      '<button class="btn btn-sm" data-bulk="favorite">' + icon("star") + 'Favorite</button>' +
      '<button class="btn btn-sm" data-bulk="used">' + icon("check") + 'Used</button>' +
      '<button class="btn btn-sm" data-bulk="reserved">' + icon("bookmark") + 'Reserve</button>' +
      '<button class="btn btn-sm" data-bulk="category">' + icon("tag") + 'Category</button>' +
      '<button class="btn btn-sm" data-bulk="tag">' + icon("tag") + 'Tag</button>' +
      '<button class="btn btn-sm" data-bulk="archived">' + icon("archive") + 'Archive</button>' +
      '<button class="btn btn-sm" data-bulk="blocked">' + icon("shield") + 'Block</button>' +
      '<button class="btn btn-sm" data-bulk="export">' + icon("download") + 'Export</button>' +
      '<button class="btn btn-sm btn-danger" data-bulk="delete">' + icon("trash") + 'Delete</button>' +
      '<button class="btn btn-sm btn-ghost" data-bulk="clear" style="margin-left:auto">Clear</button>' +
    '</div></div>';
  }

  function emptyVault() {
    return '<div class="empty"><div class="ic">' + icon("inbox") + '</div><h4>Your vault is empty</h4><p>Generate or manually create aliases — saved ones land here with full tracking, categories, favorites and tags.</p>' +
      '<button class="btn btn-primary mt" data-go="generator">' + icon("wand") + 'Open Generator</button></div>';
  }
  function noMatch() {
    return '<div class="empty"><div class="ic">' + icon("search") + '</div><h4>No matches</h4><p>No aliases match your current filters.</p><button class="btn mt" data-clear-filters>' + icon("refresh") + 'Clear filters</button></div>';
  }

  function sortArrow(ui, key) {
    var p = (ui.filters.sort || "").split(":");
    return p[0] === key ? ' <span class="arrow">' + (p[1] === "asc" ? "↑" : "↓") + "</span>" : "";
  }

  function tableBlock(filtered, ui, selected) {
    var page = ui.page, size = ui.pageSize;
    var totalPages = Math.max(1, Math.ceil(filtered.length / size));
    if (page > totalPages) page = totalPages;
    var slice = filtered.slice((page - 1) * size, page * size);
    var selSet = {}; selected.forEach(function (id) { selSet[id] = true; });
    var allOnPage = slice.length && slice.every(function (a) { return selSet[a.id]; });

    var head = '<tr><th style="width:36px"><input type="checkbox" class="cb" id="vault-all"' + (allOnPage ? " checked" : "") + '></th>' +
      '<th style="width:34px"></th>' +
      '<th class="sortable" data-sort="alias">Alias' + sortArrow(ui, "alias") + '</th>' +
      '<th class="sortable" data-sort="category">Category' + sortArrow(ui, "category") + '</th>' +
      '<th class="sortable" data-sort="status">Status' + sortArrow(ui, "status") + '</th>' +
      '<th>Tags</th>' +
      '<th class="sortable nowrap" data-sort="copiedCount">Copies' + sortArrow(ui, "copiedCount") + '</th>' +
      '<th class="sortable nowrap" data-sort="createdAt">Created' + sortArrow(ui, "createdAt") + '</th>' +
      '<th style="width:124px"></th></tr>';

    var rows = slice.map(function (a) {
      var h = L.aliasHealth(a);
      var tagsHtml = (a.tags || []).slice(0, 3).map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join(" ") || '<span class="muted">—</span>';
      return '<tr class="' + (selSet[a.id] ? "sel" : "") + '" data-id="' + a.id + '">' +
        '<td><input type="checkbox" class="cb row-cb"' + (selSet[a.id] ? " checked" : "") + '></td>' +
        '<td><button class="star ' + (a.favorite ? "on" : "") + '" data-act="fav" title="Favorite">' + icon("star") + '</button></td>' +
        '<td><div class="row gap-sm"><span class="health ' + h.level + '" title="' + attr(h.text) + '"></span>' +
          (a.pinned ? '<span class="pin on" style="width:16px;height:16px" title="Pinned">' + icon("pin") + '</span>' : '') +
          '<div style="min-width:0"><div class="alias-cell">' + U.highlightAlias(a.alias) + '</div>' +
          '<div class="muted" style="font-size:11px">' + (a.label ? esc(a.label) : esc(a.baseEmail)) + '</div></div></div></td>' +
        '<td><span class="chip cat">' + esc(a.category || "Custom") + '</span></td>' +
        '<td>' + statusBadge(a.status) + '</td>' +
        '<td><div class="row wrap gap-sm">' + tagsHtml + '</div></td>' +
        '<td class="mono">' + (a.copiedCount || 0) + '</td>' +
        '<td class="nowrap muted" title="' + attr(U.fmtDate(a.createdAt)) + '">' + U.relTime(a.createdAt) + '</td>' +
        '<td><div class="cell-actions">' +
          ab("copy", "copy", "Copy") + ab("check", "used", "Mark used") + ab("edit", "edit", "Edit") + ab("trash", "delete", "Delete") +
        '</div></td></tr>';
    }).join("");

    var foot = pagerFoot(filtered, page, size, totalPages);
    return '<div class="table-wrap"><table class="data"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>' + foot;
  }
  function ab(ic, act, title) { return '<button class="icon-btn" style="width:30px;height:30px" data-act="' + act + '" title="' + attr(title) + '">' + icon(ic) + '</button>'; }

  function pagerFoot(filtered, page, size, totalPages) {
    var pager = "";
    if (totalPages > 1) {
      var btns = ['<button data-pg="' + (page - 1) + '"' + (page === 1 ? " disabled" : "") + '>‹</button>'];
      var start = Math.max(1, Math.min(page - 2, totalPages - 4)), end = Math.min(totalPages, start + 4);
      for (var i = start; i <= end; i++) btns.push('<button data-pg="' + i + '" class="' + (i === page ? "active" : "") + '">' + i + '</button>');
      btns.push('<button data-pg="' + (page + 1) + '"' + (page === totalPages ? " disabled" : "") + '>›</button>');
      pager = '<div class="pager">' + btns.join("") + '</div>';
    }
    return '<div class="card-pad" style="padding:13px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
      '<span class="muted" style="font-size:12.5px">Showing ' + ((page - 1) * size + 1) + '–' + Math.min(page * size, filtered.length) + ' of ' + filtered.length + '</span>' +
      '<div style="margin-left:auto" class="row gap-sm"><span class="muted" style="font-size:12.5px">Rows</span>' +
        '<select class="select" id="vault-size" style="width:auto;padding:6px 28px 6px 10px">' + [25, 50, 100, 250].map(function (n) { return '<option' + (n === size ? " selected" : "") + '>' + n + '</option>'; }).join("") + '</select>' + pager + '</div></div>';
  }

  // ---------- edit dialog (with batch editor / filter tip) ----------
  function openEdit(a) {
    var statusSel = S.STATUSES.filter(function (s) { return s !== "Invalid"; }).map(function (s) { return '<option' + (a.status === s ? " selected" : "") + '>' + esc(s) + '</option>'; }).join("");
    var catSel = S.state.settings.categories.map(function (c) { return '<option' + (a.category === c ? " selected" : "") + '>' + esc(c) + '</option>'; }).join("");
    var m = U.openModal(
      '<div class="modal-head"><h3>Edit alias</h3><p class="mono">' + esc(a.alias) + '</p></div>' +
      '<div class="modal-body">' +
        '<div class="grid cols-2" style="gap:14px">' +
          '<div class="field" style="margin-bottom:0"><label>Label / name</label><input class="input" id="ed-label" value="' + attr(a.label || "") + '"></div>' +
          '<div class="field" style="margin-bottom:0"><label>Category</label><select class="select" id="ed-cat">' + catSel + '</select></div>' +
          '<div class="field" style="margin-bottom:0"><label>Status</label><select class="select" id="ed-status">' + statusSel + '</select></div>' +
          '<div class="field" style="margin-bottom:0"><label>Tags <span class="muted">comma-sep</span></label><input class="input" id="ed-tags" value="' + attr((a.tags || []).join(", ")) + '"></div>' +
        '</div>' +
        '<div class="field mt"><label>Notes</label><textarea class="textarea" id="ed-notes">' + esc(a.notes || "") + '</textarea></div>' +
        '<div class="row gap-sm mt"><button class="btn btn-sm" id="ed-fav">' + icon("star") + (a.favorite ? "Unfavorite" : "Favorite") + '</button>' +
          '<button class="btn btn-sm" id="ed-pin">' + icon("pin") + (a.pinned ? "Unpin" : "Pin") + '</button>' +
          '<button class="btn btn-sm" id="ed-dup">' + icon("box") + 'Duplicate</button></div>' +
        '<div class="notice info mt" style="align-items:flex-start">' + icon("inbox") + '<div style="font-size:11.5px">' + esc(L.filterSuggestion(a.alias, a.label || a.category)) + '</div></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-act="cancel">Cancel</button><button class="btn btn-primary" data-act="save">Save changes</button></div>'
    );
    m.querySelector('[data-act="cancel"]').onclick = U.closeModal;
    m.querySelector("#ed-fav").onclick = function () { S.toggleFavorite(a.id); U.closeModal(); };
    m.querySelector("#ed-pin").onclick = function () { S.togglePin(a.id); U.closeModal(); };
    m.querySelector("#ed-dup").onclick = function () { S.duplicateAlias(a.id); U.closeModal(); U.toast("Alias duplicated", "success"); };
    m.querySelector('[data-act="save"]').onclick = function () {
      S.setField(a.id, "label", m.querySelector("#ed-label").value.trim());
      S.setField(a.id, "category", m.querySelector("#ed-cat").value);
      S.setField(a.id, "status", m.querySelector("#ed-status").value);
      S.setField(a.id, "tags", m.querySelector("#ed-tags").value.split(",").map(function (t) { return t.trim(); }).filter(Boolean));
      S.setField(a.id, "notes", m.querySelector("#ed-notes").value.trim());
      U.closeModal(); U.toast("Alias updated", "success");
    };
  }

  // ---------- mount ----------
  function mount(root) {
    var go = root.querySelector("[data-go]"); if (go) go.onclick = function () { U.navigate("generator"); };
    var cf = root.querySelector("[data-clear-filters]"); if (cf) cf.onclick = function () { S.setFilters({ search: "", status: "all", tag: "all", baseEmail: "all", category: "all", favorite: false }); };

    var search = root.querySelector("#vault-search");
    if (search) { var t; search.oninput = function () { clearTimeout(t); t = setTimeout(function () { S.setFilters({ search: search.value }); }, 180); }; }
    bindSel(root, "#vault-status", function (v) { S.setFilters({ status: v }); });
    bindSel(root, "#vault-category", function (v) { S.setFilters({ category: v }); });
    bindSel(root, "#vault-tag", function (v) { S.setFilters({ tag: v }); });
    bindSel(root, "#vault-base", function (v) { S.setFilters({ baseEmail: v }); });
    var favBtn = root.querySelector("#vault-fav"); if (favBtn) favBtn.onclick = function () { S.setFilters({ favorite: !S.state.ui.filters.favorite }); };
    var size = root.querySelector("#vault-size"); if (size) size.onchange = function () { S.setUI({ pageSize: +size.value, page: 1 }); };

    root.querySelectorAll("th.sortable").forEach(function (th) {
      th.onclick = function () {
        var key = th.getAttribute("data-sort"), p = (S.state.ui.filters.sort || "").split(":");
        S.setFilters({ sort: key + ":" + ((p[0] === key && p[1] === "desc") ? "asc" : "desc") });
      };
    });
    root.querySelectorAll(".pager button[data-pg]").forEach(function (b) { b.onclick = function () { if (!b.disabled) S.setUI({ page: +b.getAttribute("data-pg") }); }; });

    var all = root.querySelector("#vault-all");
    if (all) all.onchange = function () {
      var ui = S.state.ui, filtered = S.filteredAliases();
      var ids = filtered.slice((ui.page - 1) * ui.pageSize, ui.page * ui.pageSize).map(function (a) { return a.id; });
      if (all.checked) { var cur = ui.selected.slice(); ids.forEach(function (id) { if (cur.indexOf(id) === -1) cur.push(id); }); S.setSelected(cur); }
      else S.setSelected(ui.selected.filter(function (id) { return ids.indexOf(id) === -1; }));
    };

    root.querySelectorAll("tr[data-id]").forEach(function (tr) {
      var id = tr.getAttribute("data-id");
      var cb = tr.querySelector(".row-cb"); if (cb) cb.onchange = function () { S.toggleSelected(id); };
      tr.querySelectorAll("[data-act]").forEach(function (btn) {
        btn.onclick = function (e) {
          e.stopPropagation();
          var a = S.findAlias(id); if (!a) return;
          var act = btn.getAttribute("data-act");
          if (act === "copy") U.copyText(a.alias).then(function () { S.markCopied(id); U.toast("Copied: " + a.alias, "success"); });
          else if (act === "fav") S.toggleFavorite(id);
          else if (act === "used") { S.setStatus([id], "Used"); U.toast("Marked used", "success"); }
          else if (act === "edit") openEdit(a);
          else if (act === "duplicate") { S.duplicateAlias(id); U.toast("Duplicated", "success"); }
          else if (act === "delete") U.confirmDialog({ title: "Delete alias?", message: a.alias, confirm: "Delete", danger: true }).then(function (ok) { if (ok) { S.removeAliases([id]); U.toast("Deleted", "success"); } });
        };
      });
    });

    root.querySelectorAll("[data-bulk]").forEach(function (b) { b.onclick = function () { bulkAction(b.getAttribute("data-bulk")); }; });
  }

  function bulkAction(act) {
    var ids = S.state.ui.selected.slice();
    if (!ids.length) return;
    var picked = S.state.aliases.filter(function (a) { return ids.indexOf(a.id) !== -1; });
    if (act === "clear") return S.clearSelected();
    if (act === "copy") return U.copyText(picked.map(function (a) { return a.alias; }).join("\n")).then(function () { U.toast("Copied " + ids.length, "success"); });
    if (act === "favorite") { ids.forEach(function (id) { var a = S.findAlias(id); if (a && !a.favorite) S.toggleFavorite(id); }); return U.toast("Favorited " + ids.length, "success"); }
    if (act === "used") { S.setStatus(ids, "Used"); return U.toast("Marked " + ids.length + " used", "success"); }
    if (act === "reserved") { S.setStatus(ids, "Reserved"); return U.toast("Reserved " + ids.length, "success"); }
    if (act === "archived") { S.setStatus(ids, "Archived"); return U.toast("Archived " + ids.length, "success"); }
    if (act === "blocked") { S.setStatus(ids, "Blocked"); return U.toast("Blocked " + ids.length, "success"); }
    if (act === "export") return GACC.exporter.download(picked, "csv", "selected");
    if (act === "category") {
      catPicker(function (c) { S.setCategory(ids, c); U.toast("Set category to " + c, "success"); });
      return;
    }
    if (act === "tag") { U.promptDialog({ title: "Add tag to " + ids.length + " aliases", placeholder: "tag" }).then(function (v) { if (v) { S.addTag(ids, v); U.toast("Tag added", "success"); } }); return; }
    if (act === "delete") U.confirmDialog({ title: "Delete " + ids.length + " aliases?", message: "This cannot be undone.", confirm: "Delete all", danger: true }).then(function (ok) { if (ok) { S.removeAliases(ids); U.toast("Deleted " + ids.length, "success"); } });
  }

  function catPicker(cb) {
    var m = U.openModal(
      '<div class="modal-head"><h3>Set category</h3></div>' +
      '<div class="modal-body"><div class="row wrap gap-sm">' +
        S.state.settings.categories.map(function (c) { return '<button class="btn" data-cat="' + attr(c) + '">' + esc(c) + '</button>'; }).join("") +
      '</div></div><div class="modal-foot"><button class="btn btn-ghost" data-act="cancel">Cancel</button></div>'
    );
    m.querySelector('[data-act="cancel"]').onclick = U.closeModal;
    m.querySelectorAll("[data-cat]").forEach(function (b) { b.onclick = function () { U.closeModal(); cb(b.getAttribute("data-cat")); }; });
  }

  function bindSel(root, sel, fn) { var e = root.querySelector(sel); if (e) e.onchange = function () { fn(e.value); }; }

  window.GACC.views = window.GACC.views || {};
  window.GACC.views.registry = { render: render, mount: mount };
})();

/* ===== js/views/tester.js ===== */
/* Gmail Alias Control Center — Safe Tester view */
(function () {
  "use strict";
  var L = window.GACC.logic, S = window.GACC.store, U = window.GACC.ui;
  var icon = U.icon, esc = U.esc, attr = U.attr;

  var mode = "syntax";   // syntax | simulate | authorized
  var running = false;
  var stopFlag = false;

  function render() {
    var st = S.state;
    var results = st.testerResults;
    var aliasOptions = st.aliases.slice(0, 200);

    var modes = [
      { id: "syntax", label: "Syntax", icon: "code" },
      { id: "simulate", label: "Local Simulation", icon: "box" },
      { id: "authorized", label: "Authorized URL", icon: "globe" },
    ];

    return '' +
    '<div class="notice info mb">' + icon("shield") + '<div><b>Safe testing only.</b> Syntax & local simulation run entirely in your browser with no network requests. The authorized-URL workflow is shown as a guided, safety-gated mockup — this app never performs live external submissions, ban evasion, CAPTCHA bypass, or automated signups.</div></div>' +
    '<div class="grid cols-2" style="grid-template-columns:1fr 1fr;align-items:start">' +
      '<div class="card">' +
        '<div class="card-head">' + icon("flask") + '<div><h3>Run a test</h3><div class="sub">Pick a mode and a set of aliases</div></div></div>' +
        '<div class="card-pad">' +
          '<div class="field"><label>Test mode</label><div class="segmented" id="t-mode">' +
            modes.map(function (m) { return '<button class="' + (m.id === mode ? "active accent" : "") + '" data-m="' + m.id + '">' + esc(m.label) + '</button>'; }).join("") +
          '</div></div>' +
          renderModeBody(aliasOptions) +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-head">' + icon("list") + '<div><h3>Results</h3><div class="sub">' + results.length + ' recorded</div></div>' +
          '<div class="right">' +
            (running ? '<button class="btn btn-sm btn-danger" id="t-stop">' + icon("stop") + 'Stop</button>' : '') +
            '<button class="btn btn-sm btn-ghost" id="t-clear">' + icon("trash") + 'Clear</button>' +
          '</div>' +
        '</div>' +
        '<div class="card-pad" id="t-results">' + renderResults(results) + '</div>' +
      '</div>' +
    '</div>';
  }

  function aliasSourceField(aliasOptions) {
    return '<div class="field"><label>Aliases to test</label>' +
      '<textarea class="textarea mono" id="t-input" placeholder="one alias per line…\nname+test@gmail.com">' +
        esc(aliasOptions.slice(0, 25).map(function (a) { return a.alias; }).join("\n")) +
      '</textarea>' +
      '<div class="hint">Pre-filled from your registry. Edit freely — one alias per line.</div></div>';
  }

  function renderModeBody(aliasOptions) {
    if (mode === "syntax") {
      return aliasSourceField(aliasOptions) +
        '<div class="notice info" style="margin-bottom:14px">' + icon("code") + '<div>Checks each alias for structural validity (format, dots, length, Gmail domain). No network.</div></div>' +
        '<button class="btn btn-primary btn-block" id="t-run">' + icon("play") + 'Run syntax test</button>';
    }
    if (mode === "simulate") {
      return aliasSourceField(aliasOptions) +
        '<div class="notice info" style="margin-bottom:14px">' + icon("box") + '<div>Submits each alias to an in-memory mock form with a simulated response time. Fully local — nothing leaves your browser.</div></div>' +
        '<button class="btn btn-primary btn-block" id="t-run">' + icon("play") + 'Run local simulation</button>';
    }
    // authorized — safety-gated mockup
    var domains = S.state.settings.authorizedDomains;
    return aliasSourceField(aliasOptions) +
      '<div class="field"><label>Target URL <span class="muted">must match an authorized domain</span></label>' +
        '<input class="input mono" id="t-url" placeholder="https://staging.mycompany.test/signup"></div>' +
      '<div class="field"><label>Authorized domains <span class="muted">(from Settings)</span></label>' +
        '<div class="row wrap gap-sm">' + (domains.length ? domains.map(function (d) { return '<span class="chip">' + icon("globe") + esc(d) + '</span>'; }).join("") : '<span class="muted">None configured</span>') + '</div></div>' +
      '<label class="checkbox-row mt"><input type="checkbox" class="cb" id="t-confirm"><label for="t-confirm">I own this URL or have explicit written permission to test it. I will respect the site\'s Terms of Service and robots.txt.</label></label>' +
      '<div class="notice warn mt">' + icon("alert") + '<div><b>Live external testing is disabled in this environment.</b> The controls below illustrate the safety workflow — domain allowlist, explicit confirmation, throttling, and automatic stop on 403/429/CAPTCHA. Use a dedicated, authorized testing environment to run real requests.</div></div>' +
      '<button class="btn btn-primary btn-block mt" id="t-run" disabled title="Disabled in this environment">' + icon("globe") + 'Run authorized test (disabled)</button>' +
      '<button class="btn btn-block mt-sm" id="t-dryrun">' + icon("shield") + 'Preview safety checks (dry run)</button>';
  }

  function detectionPill(det) {
    if (/captcha/i.test(det)) return '<span class="text-warn">' + esc(det) + '</span>';
    if (/none/i.test(det)) return '<span class="text-good">' + esc(det) + '</span>';
    return esc(det);
  }

  function renderResults(results) {
    if (!results.length) {
      return '<div class="empty"><div class="ic">' + icon("flask") + '</div><h4>No results yet</h4><p>Run a syntax or local-simulation test to see structured results here.</p></div>';
    }
    var rows = results.slice(0, 80).map(function (r) {
      var ok = /pass|accepted/i.test(r.status);
      return '<tr>' +
        '<td><div class="alias-cell" style="font-size:12px">' + U.highlightAlias(r.alias) + '</div></td>' +
        '<td><span class="badge ' + (ok ? "st-Used" : "st-Invalid") + '"><span class="dot"></span>' + esc(r.status) + '</span></td>' +
        '<td class="mono nowrap">' + esc(String(r.httpStatus)) + '</td>' +
        '<td class="mono nowrap">' + (r.responseTime ? r.responseTime + "ms" : "—") + '</td>' +
        '<td style="font-size:12px">' + detectionPill(r.detection) + '</td>' +
        '<td class="nowrap muted" style="font-size:11px">' + U.relTime(r.timestamp) + '</td>' +
      '</tr>';
    }).join("");
    return '<div class="table-wrap" style="max-height:520px;overflow-y:auto"><table class="data">' +
      '<thead><tr><th>Alias</th><th>Status</th><th>HTTP</th><th>Time</th><th>Detection</th><th>When</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  function getAliases(root) {
    var raw = (root.querySelector("#t-input") || {}).value || "";
    return raw.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function runBatch(aliases, fn) {
    running = true; stopFlag = false;
    U.render();
    var i = 0;
    function step() {
      if (stopFlag || i >= aliases.length) {
        running = false; U.render();
        U.toast(stopFlag ? "Testing stopped" : "Tested " + i + " aliases", stopFlag ? "warn" : "success");
        return;
      }
      S.addTesterResult(fn(aliases[i]));
      i++;
      setTimeout(step, 90); // safe throttle delay between tests
    }
    step();
  }

  function mount(root) {
    root.querySelectorAll("#t-mode button").forEach(function (b) {
      b.onclick = function () { mode = b.getAttribute("data-m"); U.render(); };
    });
    var stop = root.querySelector("#t-stop");
    if (stop) stop.onclick = function () { stopFlag = true; };
    var clear = root.querySelector("#t-clear");
    if (clear) clear.onclick = function () {
      U.confirmDialog({ title: "Clear all results?", confirm: "Clear", danger: true }).then(function (ok) { if (ok) { S.clearTesterResults(); U.toast("Results cleared", "success"); } });
    };

    var run = root.querySelector("#t-run");
    if (run && !run.disabled) run.onclick = function () {
      var aliases = getAliases(root);
      if (!aliases.length) return U.toast("Add at least one alias", "warn");
      if (mode === "syntax") runBatch(aliases, L.testSyntax);
      else if (mode === "simulate") runBatch(aliases, L.simulateLocal);
    };

    var dry = root.querySelector("#t-dryrun");
    if (dry) dry.onclick = function () { dryRun(root); };
  }

  function dryRun(root) {
    var url = (root.querySelector("#t-url") || {}).value || "";
    var confirmed = (root.querySelector("#t-confirm") || {}).checked;
    var aliases = getAliases(root);
    var domains = S.state.settings.authorizedDomains;
    var checks = [];
    function add(ok, label) { checks.push({ ok: ok, label: label }); }

    add(!!url, "Target URL provided");
    var host = "";
    try { host = new URL(url).hostname; } catch (e) {}
    var allowed = host && domains.some(function (d) { return host === d || host.endsWith("." + d); });
    add(!!allowed, allowed ? "URL host “" + host + "” is on the authorized domain allowlist" : "URL host is NOT on the authorized allowlist");
    add(confirmed, "Ownership / permission confirmed");
    add(aliases.length > 0, aliases.length + " aliases queued");
    add(aliases.length <= 50, "Batch within safe per-run limit (≤ 50)");

    var passed = checks.every(function (c) { return c.ok; });
    var body = '<div class="modal-head"><h3>' + icon("shield") + ' Safety pre-flight</h3><p>These checks must all pass before a real authorized test could run in a permitted environment.</p></div>' +
      '<div class="modal-body"><div style="display:flex;flex-direction:column;gap:9px">' +
      checks.map(function (c) {
        return '<div class="row" style="gap:10px"><span style="color:var(--' + (c.ok ? "good" : "bad") + ');display:grid;place-items:center;width:18px">' + icon(c.ok ? "check" : "x") + '</span><span style="font-size:13px">' + esc(c.label) + '</span></div>';
      }).join("") + '</div>' +
      '<div class="notice ' + (passed ? "info" : "warn") + ' mt">' + icon(passed ? "info" : "alert") + '<div>' +
        (passed
          ? 'All checks passed. In an authorized environment, requests would run <b>one at a time with a delay</b>, and testing would <b>stop automatically</b> on any 403, 429, or CAPTCHA / bot-protection response.'
          : 'One or more checks failed. Resolve them before any external test could proceed.') +
      '</div></div>' +
      '<div class="notice warn mt">' + icon("alert") + '<div>If CAPTCHA or bot protection is detected, testing pauses with: <i>"CAPTCHA or bot protection detected. Testing has been paused. Continue manually or use an authorized testing environment."</i></div></div>' +
      '</div><div class="modal-foot"><button class="btn btn-primary" data-act="ok">Close</button></div>';
    var m = U.openModal(body);
    m.querySelector('[data-act="ok"]').onclick = U.closeModal;
  }

  window.GACC.views = window.GACC.views || {};
  window.GACC.views.tester = { render: render, mount: mount };
})();

/* ===== js/views/data.js ===== */
/* Gmail Alias Control Center — Export / Import view */
(function () {
  "use strict";
  var L = window.GACC.logic, S = window.GACC.store, U = window.GACC.ui, X = window.GACC.exporter;
  var icon = U.icon, esc = U.esc, attr = U.attr;

  var expScope = "all", expFmt = "csv", expTag = "all", expBase = "all";
  var importParsed = null, importFmt = "csv";

  function scopeRows() {
    var all = S.state.aliases;
    switch (expScope) {
      case "filtered": return S.filteredAliases();
      case "selected": var ids = S.state.ui.selected; return all.filter(function (a) { return ids.indexOf(a.id) !== -1; });
      case "unused": return all.filter(function (a) { return !a.lastUsedAt && (a.copiedCount || 0) === 0 && a.status !== "Archived"; });
      case "copied": return all.filter(function (a) { return (a.copiedCount || 0) > 0; });
      case "favorites": return all.filter(function (a) { return a.favorite; });
      case "tag": return all.filter(function (a) { return expTag !== "all" && (a.tags || []).indexOf(expTag) !== -1; });
      case "base": return all.filter(function (a) { return expBase !== "all" && a.baseEmail === expBase; });
      default: return all;
    }
  }

  function render() {
    var st = S.state;
    var tags = Object.keys(S.uniqueTags());
    var bases = Object.keys(S.uniqueBaseEmails());
    var scopes = [
      ["all", "All aliases", st.aliases.length],
      ["filtered", "Current registry filter", S.filteredAliases().length],
      ["selected", "Selected in registry", st.ui.selected.length],
      ["unused", "Unused only", st.aliases.filter(function (a) { return !a.lastUsedAt && (a.copiedCount || 0) === 0 && a.status !== "Archived"; }).length],
      ["copied", "Copied only", st.aliases.filter(function (a) { return (a.copiedCount || 0) > 0; }).length],
      ["favorites", "Favorites only", st.aliases.filter(function (a) { return a.favorite; }).length],
      ["tag", "By tag", null],
      ["base", "By base email", null],
    ];
    var rows = scopeRows();

    return '<div class="grid cols-2" style="align-items:start">' +
      // EXPORT
      '<div class="card">' +
        '<div class="card-head">' + icon("download") + '<div><h3>Export</h3><div class="sub">CSV, JSON or TXT</div></div></div>' +
        '<div class="card-pad">' +
          '<div class="field"><label>Scope</label><div class="grid" style="grid-template-columns:1fr 1fr;gap:8px">' +
            scopes.map(function (s) {
              return '<button class="btn ' + (expScope === s[0] ? "btn-primary" : "") + '" data-scope="' + s[0] + '" style="justify-content:space-between">' +
                '<span>' + esc(s[1]) + '</span>' + (s[2] != null ? '<span class="mono" style="opacity:.7">' + s[2] + '</span>' : icon("chevRight")) + '</button>';
            }).join("") +
          '</div></div>' +
          (expScope === "tag" ? '<div class="field"><label>Tag</label><select class="select" id="exp-tag">' + (tags.length ? tags.map(function (t) { return '<option' + (t === expTag ? " selected" : "") + '>' + esc(t) + '</option>'; }).join("") : '<option>— no tags —</option>') + '</select></div>' : "") +
          (expScope === "base" ? '<div class="field"><label>Base email</label><select class="select" id="exp-base">' + (bases.length ? bases.map(function (b) { return '<option' + (b === expBase ? " selected" : "") + '>' + esc(b) + '</option>'; }).join("") : '<option>— none —</option>') + '</select></div>' : "") +
          '<div class="field"><label>Format</label><div class="segmented" id="exp-fmt">' +
            ["csv", "json", "txt"].map(function (f) { return '<button class="' + (expFmt === f ? "active accent" : "") + '" data-fmt="' + f + '">' + f.toUpperCase() + '</button>'; }).join("") +
          '</div></div>' +
          '<div class="field"><label>Preview <span class="muted mono">' + rows.length + ' rows</span></label>' +
            '<pre class="input mono" style="max-height:180px;overflow:auto;white-space:pre;font-size:11.5px;margin:0">' + esc(previewText(rows)) + '</pre></div>' +
          '<button class="btn btn-primary btn-block" id="exp-go"' + (rows.length ? "" : " disabled") + '>' + icon("download") + 'Download ' + expFmt.toUpperCase() + ' (' + rows.length + ')</button>' +
          exportHistory(st.exportHistory) +
        '</div>' +
      '</div>' +
      // IMPORT
      '<div class="card">' +
        '<div class="card-head">' + icon("upload") + '<div><h3>Import</h3><div class="sub">Paste or upload — deduped on import</div></div></div>' +
        '<div class="card-pad">' +
          '<div class="field"><label>Format</label><div class="segmented" id="imp-fmt">' +
            ["csv", "json", "txt"].map(function (f) { return '<button class="' + (importFmt === f ? "active accent" : "") + '" data-fmt="' + f + '">' + f.toUpperCase() + '</button>'; }).join("") +
          '</div></div>' +
          '<div class="field"><label>Paste data</label><textarea class="textarea mono" id="imp-text" placeholder="' + attr(importPlaceholder()) + '" style="min-height:130px"></textarea></div>' +
          '<div class="row gap-sm"><button class="btn flex1" id="imp-file">' + icon("file") + 'Choose file…</button>' +
            '<button class="btn btn-primary flex1" id="imp-parse">' + icon("eye") + 'Preview import</button></div>' +
          '<input type="file" id="imp-input" accept=".csv,.json,.txt" style="display:none">' +
          '<div id="imp-preview" class="mt"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function importPlaceholder() {
    if (importFmt === "json") return '[{"alias":"name+x@gmail.com","tags":["work"]}]  or  ["name+a@gmail.com", ...]';
    if (importFmt === "csv") return 'Base Email,Alias,Pattern,Status,Tags,Notes\n...';
    return 'name+a@gmail.com\nname+b@gmail.com';
  }

  function previewText(rows) {
    if (!rows.length) return "(no rows in this scope)";
    var sample = rows.slice(0, 30);
    var txt = X.preview(sample, expFmt);
    if (rows.length > 30) txt += "\n… +" + (rows.length - 30) + " more";
    return txt;
  }

  function exportHistory(hist) {
    if (!hist.length) return "";
    return '<div class="divider"></div><div class="section-title">Recent exports</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px">' +
      hist.slice(0, 6).map(function (h) {
        return '<div class="row" style="font-size:12.5px;gap:10px"><span class="chip">' + esc(h.format) + '</span>' +
          '<span class="muted">' + esc(h.scope) + '</span><span class="mono">' + h.count + ' rows</span>' +
          '<span class="muted nowrap" style="margin-left:auto">' + U.relTime(h.at) + '</span></div>';
      }).join("") + '</div>';
  }

  function renderImportPreview(parsed) {
    var existing = {};
    S.state.aliases.forEach(function (a) { existing[a.alias.toLowerCase()] = true; });
    var seenInBatch = {};
    var fresh = [], dupes = 0;
    parsed.records.forEach(function (r) {
      var key = r.alias.toLowerCase();
      if (existing[key] || seenInBatch[key]) { dupes++; return; }
      seenInBatch[key] = true; fresh.push(r);
    });
    importParsed = { records: parsed.records, fresh: fresh };

    var box = document.getElementById("imp-preview");
    var stats = '<div class="grid" style="grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">' +
      statCard("New", fresh.length, "good") +
      statCard("Duplicates", dupes, "warn") +
      statCard("Invalid", parsed.invalid.length, parsed.invalid.length ? "bad" : "dim") +
    '</div>';

    var sample = fresh.slice(0, 8).map(function (r) { return '<div class="preview-item" style="font-size:12px">' + U.highlightAlias(r.alias) + '</div>'; }).join("");
    var invalidList = parsed.invalid.length ? '<div class="section-title mt">Invalid rows</div>' +
      parsed.invalid.slice(0, 5).map(function (iv) { return '<div class="notice danger" style="margin-bottom:6px;padding:8px 11px"><div><span class="mono">' + esc(iv.value.slice(0, 50)) + '</span> — ' + esc(iv.reason) + '</div></div>'; }).join("") : "";

    box.innerHTML = stats +
      (fresh.length ? '<div class="preview-list" style="max-height:200px">' + sample + (fresh.length > 8 ? '<div class="muted" style="text-align:center;font-size:12px;padding:4px">+ ' + (fresh.length - 8) + ' more</div>' : "") + '</div>' : '<div class="notice warn">' + icon("alert") + '<div>No new aliases to import.</div></div>') +
      invalidList +
      (fresh.length ? '<button class="btn btn-primary btn-block mt" id="imp-confirm">' + icon("check") + 'Import ' + fresh.length + ' aliases</button>' : "");

    var cf = box.querySelector("#imp-confirm");
    if (cf) cf.onclick = function () {
      var r = S.importRecords(importParsed.fresh);
      U.toast("Imported " + r.added + " aliases", "success");
      U.navigate("registry");
    };
  }

  function statCard(label, n, color) {
    return '<div class="stat" style="padding:12px 14px"><div class="lbl">' + esc(label) + '</div><div class="num text-' + (color === "dim" ? "dim" : color) + '" style="font-size:24px">' + n + '</div></div>';
  }

  function mount(root) {
    root.querySelectorAll("[data-scope]").forEach(function (b) { b.onclick = function () { expScope = b.getAttribute("data-scope"); U.render(); }; });
    root.querySelectorAll("#exp-fmt button").forEach(function (b) { b.onclick = function () { expFmt = b.getAttribute("data-fmt"); U.render(); }; });
    var et = root.querySelector("#exp-tag"); if (et) et.onchange = function () { expTag = et.value; U.render(); };
    var eb = root.querySelector("#exp-base"); if (eb) eb.onchange = function () { expBase = eb.value; U.render(); };
    var go = root.querySelector("#exp-go"); if (go) go.onclick = function () { X.download(scopeRows(), expFmt, expScope); };

    root.querySelectorAll("#imp-fmt button").forEach(function (b) { b.onclick = function () { importFmt = b.getAttribute("data-fmt"); U.render(); }; });
    var fileBtn = root.querySelector("#imp-file");
    var fileInput = root.querySelector("#imp-input");
    var text = root.querySelector("#imp-text");
    if (fileBtn) fileBtn.onclick = function () { fileInput.click(); };
    if (fileInput) fileInput.onchange = function () {
      var f = fileInput.files[0]; if (!f) return;
      var ext = (f.name.split(".").pop() || "").toLowerCase();
      if (["csv", "json", "txt"].indexOf(ext) !== -1) importFmt = ext;
      var reader = new FileReader();
      reader.onload = function () {
        // re-render to reflect detected format, then refill text
        U.render();
        var t = document.querySelector("#imp-text");
        if (t) { t.value = reader.result; renderImportPreview(L.parseImport(reader.result, importFmt)); }
      };
      reader.readAsText(f);
    };
    var parse = root.querySelector("#imp-parse");
    if (parse) parse.onclick = function () {
      var v = (text.value || "").trim();
      if (!v) return U.toast("Paste or choose a file first", "warn");
      renderImportPreview(L.parseImport(v, importFmt));
    };
  }

  window.GACC.views = window.GACC.views || {};
  window.GACC.views.data = { render: render, mount: mount };
})();

/* ===== js/views/analytics.js ===== */
/* Gmail Alias Control Center — Analytics view */
(function () {
  "use strict";
  var S = window.GACC.store, U = window.GACC.ui;
  var icon = U.icon, esc = U.esc;

  function render() {
    var st = S.state;
    var all = st.aliases;
    if (!all.length) {
      return '<div class="card"><div class="empty"><div class="ic">' + icon("chart") + '</div><h4>No data yet</h4><p>Save some aliases and your analytics, copy history and activity will appear here.</p><button class="btn btn-primary mt" data-go="generator">' + icon("wand") + 'Open Generator</button></div></div>';
    }
    var total = all.length;
    var copied = all.filter(function (a) { return (a.copiedCount || 0) > 0; }).length;
    var totalCopies = all.reduce(function (n, a) { return n + (a.copiedCount || 0); }, 0);

    var cards = '<div class="grid mb" style="grid-template-columns:repeat(6,minmax(0,1fr));gap:12px">' +
      [["Total saved", total, "inbox"], ["Generated today", S.generatedToday(), "wand"],
       ["Copied today", S.copiedToday(), "copy"], ["Unused", S.unusedCount(), "clock"],
       ["Favorites", S.favoritesCount(), "star"], ["Archived", S.archivedCount(), "archive"]]
      .map(function (c) { return '<div class="stat" style="padding:14px 16px"><div class="lbl">' + icon(c[2]) + esc(c[0]) + '</div><div class="num" style="font-size:26px">' + c[1] + '</div></div>'; }).join("") + '</div>';

    // copy spotlight
    var last = S.lastCopied(), most = S.mostCopied();
    var spotlight = '<div class="grid cols-2 mb" style="align-items:stretch">' +
      spotCard("Last copied", last, last ? U.relTime(last.copiedAt) : "", "copy") +
      spotCard("Most copied", most, most ? (most.copiedCount + " copies") : "", "history") +
    '</div>';

    var statusCounts = {}; all.forEach(function (a) { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });
    var cats = S.uniqueCategories(), tags = S.uniqueTags();

    var byStatus = '<div class="card"><div class="card-head">' + icon("list") + '<div><h3>By status</h3></div></div><div class="card-pad">' +
      Object.keys(statusCounts).sort(function (a, b) { return statusCounts[b] - statusCounts[a]; }).map(function (s) { return bar(s, statusCounts[s], total); }).join("") + '</div></div>';
    var byCat = '<div class="card"><div class="card-head">' + icon("tag") + '<div><h3>By category</h3></div></div><div class="card-pad">' +
      (Object.keys(cats).length ? Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; }).map(function (c) { return bar(c, cats[c], total); }).join("") : '<p class="muted">No categories.</p>') + '</div></div>';

    var tagList = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a]; });
    var byTag = '<div class="card mb"><div class="card-head">' + icon("tag") + '<div><h3>Top tags</h3></div></div><div class="card-pad">' +
      (tagList.length ? '<div class="row wrap gap-sm">' + tagList.map(function (t) { return '<span class="chip">' + esc(t) + ' <b class="text-accent">' + tags[t] + '</b></span>'; }).join("") + '</div>' : '<p class="muted">No tags yet.</p>') + '</div></div>';

    // recently copied + activity
    var recentCopied = st.copyHistory.slice(0, 6);
    var copyCard = '<div class="card"><div class="card-head">' + icon("copy") + '<div><h3>Recently copied</h3><div class="sub">' + totalCopies + ' total copies · ' + copied + ' aliases</div></div></div><div class="card-pad">' +
      (recentCopied.length ? '<div class="timeline">' + recentCopied.map(function (c) {
        return '<div class="tl-item"><div class="tl-ic">' + icon("copy") + '</div><div class="tl-main"><div class="tl-alias">' + U.highlightAlias(c.alias) + '</div><div class="tl-meta">' + U.relTime(c.at) + '</div></div></div>';
      }).join("") + '</div>' : '<p class="muted">Nothing copied yet.</p>') + '</div></div>';

    var actIcons = { copied: "copy", saved: "save", status: "edit", favorited: "star", unfavorited: "star" };
    var activity = '<div class="card"><div class="card-head">' + icon("history") + '<div><h3>Activity log</h3></div></div><div class="card-pad">' +
      (st.activity.length ? '<div class="timeline">' + st.activity.slice(0, 8).map(function (e) {
        return '<div class="tl-item"><div class="tl-ic">' + icon(actIcons[e.type] || "info") + '</div><div class="tl-main"><div class="tl-alias">' + esc(e.alias) + '</div>' +
          '<div class="tl-meta">' + esc(e.type) + (e.meta ? ' · ' + esc(e.meta) : '') + ' · ' + U.relTime(e.at) + '</div></div></div>';
      }).join("") + '</div>' : '<p class="muted">No activity yet.</p>') + '</div></div>';

    return cards + spotlight +
      '<div class="grid cols-2 mb" style="align-items:start">' + byStatus + byCat + '</div>' +
      byTag +
      '<div class="grid cols-2" style="align-items:start">' + copyCard + activity + '</div>';
  }

  function spotCard(title, a, meta, ic) {
    if (!a) return '<div class="card"><div class="card-pad"><div class="lbl" style="font-size:12px;color:var(--text-faint);font-weight:600;display:flex;gap:7px;align-items:center">' + icon(ic) + esc(title) + '</div><p class="muted mt-sm" style="margin:8px 0 0">None yet</p></div></div>';
    return '<div class="card"><div class="card-pad"><div class="row spread"><div class="lbl" style="font-size:12px;color:var(--text-faint);font-weight:600;display:flex;gap:7px;align-items:center">' + icon(ic) + esc(title) + '</div><span class="muted" style="font-size:11.5px">' + esc(meta) + '</span></div>' +
      '<div class="alias-cell mt-sm" style="font-size:14px;margin-top:8px">' + U.highlightAlias(a.alias) + '</div>' +
      '<button class="btn btn-sm mt-sm" data-copy="' + U.attr(a.alias) + '" style="margin-top:10px">' + icon("copy") + 'Copy again</button></div></div>';
  }

  function pct(n, t) { return t ? Math.round((n / t) * 100) : 0; }
  function bar(label, n, total) {
    return '<div style="margin-bottom:12px"><div class="row spread" style="margin-bottom:5px"><span style="font-size:13px">' + esc(label) + '</span>' +
      '<span class="muted mono" style="font-size:12px">' + n + ' · ' + pct(n, total) + '%</span></div>' +
      '<div class="bar"><span style="width:' + Math.max(2, pct(n, total)) + '%"></span></div></div>';
  }

  function mount(root) {
    var go = root.querySelector("[data-go]"); if (go) go.onclick = function () { U.navigate("generator"); };
    root.querySelectorAll("[data-copy]").forEach(function (b) {
      b.onclick = function () { U.copyText(b.getAttribute("data-copy")).then(function () { U.toast("Copied", "success"); }); };
    });
  }

  window.GACC.views = window.GACC.views || {};
  window.GACC.views.analytics = { render: render, mount: mount };
})();

/* ===== js/views/settings.js ===== */
/* Gmail Alias Control Center — Settings view */
(function () {
  "use strict";
  var S = window.GACC.store, U = window.GACC.ui, X = window.GACC.exporter, L = window.GACC.logic;
  var icon = U.icon, esc = U.esc, attr = U.attr;

  function render() {
    var s = S.state.settings;
    var accents = Object.keys(S.ACCENTS);

    return '<div class="grid cols-2" style="align-items:start">' +
      // appearance
      card("settings", "Appearance", "Theme, accent & density",
        field("Theme",
          seg("set-theme", [["dark", "Dark"], ["light", "Light"]], s.theme)) +
        field("Accent color",
          '<div class="swatch-row" id="set-accent">' + accents.map(function (a) {
            var c = S.ACCENTS[a];
            return '<div class="swatch ' + (s.accent === a ? "active" : "") + '" data-accent="' + a + '" title="' + a + '" style="background:linear-gradient(135deg,' + c.a + ',' + c.strong + ')"></div>';
          }).join("") + '</div>') +
        field("Density",
          seg("set-density", [["comfortable", "Comfortable"], ["compact", "Compact"]], s.density))
      ) +
      // generation defaults
      card("wand", "Generation defaults", "Pre-fill the generator",
        field("Base inbox",
          '<input class="input mono" id="set-base" value="' + attr(s.baseEmail) + '" spellcheck="false">' +
          '<div class="hint">Every alias is a variation of this address and lands in this inbox.</div>') +
        field("Default mode",
          '<select class="select" id="set-mode">' + [["number","Number"],["service","Service"],["campaign","Campaign"],["random","Random"],["date","Date"],["dot","Dots"],["hybrid","Hybrid"]].map(function(o){return '<option value="'+o[0]+'"'+(s.defaultMode===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('') + '</select>') +
        field("Default batch count",
          '<input class="input mono" id="set-batch" type="number" min="1" max="' + s.maxBatch + '" value="' + s.defaultBatch + '">') +
        '<label class="checkbox-row"><input type="checkbox" class="cb" id="set-autosave"' + (s.autoSave ? " checked" : "") + '><label for="set-autosave">Auto-save generated aliases to the vault</label></label>'
      ) +
      // categories
      card("tag", "Categories", "Organise aliases by use-case",
        '<div class="row wrap gap-sm" id="set-cats" style="margin-bottom:12px">' +
          s.categories.map(function (c) {
            return '<span class="chip cat">' + esc(c) + (c === "Custom" ? "" : '<button data-rmcat="' + attr(c) + '" title="Remove">' + icon("x") + '</button>') + '</span>';
          }).join("") +
        '</div>' +
        '<div class="row gap-sm"><input class="input flex1" id="set-cat-in" placeholder="New category"><button class="btn" id="set-cat-add">' + icon("plus") + 'Add</button></div>'
      ) +
      // safety limits
      card("shield", "Safety limits", "Guardrails for batch size",
        field("Max batch per generation",
          '<input class="input mono" id="set-maxbatch" type="number" min="1" max="' + s.hardCap + '" value="' + s.maxBatch + '">' +
          '<div class="hint">Hard ceiling: ' + s.hardCap + '. Larger batches show a performance warning.</div>') +
        '<div class="notice warn">' + icon("alert") + '<div>Generating very large batches can slow your browser. Keep batches reasonable for your use case.</div></div>'
      ) +
      // authorized domains
      card("globe", "Authorized domains", "Allowlist for the tester's authorized-URL workflow",
        '<div class="row wrap gap-sm" id="set-domains" style="margin-bottom:12px">' +
          (s.authorizedDomains.length ? s.authorizedDomains.map(function (d) {
            return '<span class="chip">' + icon("globe") + esc(d) + '<button data-rm="' + attr(d) + '" title="Remove">' + icon("x") + '</button></span>';
          }).join("") : '<span class="muted">No domains configured.</span>') +
        '</div>' +
        '<div class="row gap-sm"><input class="input mono flex1" id="set-domain-in" placeholder="staging.mycompany.test"><button class="btn" id="set-domain-add">' + icon("plus") + 'Add</button></div>' +
        '<div class="notice info mt">' + icon("info") + '<div>Only add domains you own or are authorized to test. This list gates the safety pre-flight in the tester.</div></div>'
      ) +
      // storage
      card("db", "Storage", "Where your data lives",
        field("Storage mode",
          seg("set-storage", [["local", "Local (this browser)"], ["supabase", "Supabase (cloud)"]], s.storageMode)) +
        '<div class="notice info">' + icon("info") + '<div>This app runs fully on <b>local storage</b> in your browser — your data never leaves your device. Cloud sync (Supabase) is shown as an option and would require backend configuration in a full deployment.</div></div>'
      ) +
      // data management
      card("save", "Data management", "Backup, restore & reset",
        '<div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">' +
          '<button class="btn" id="set-backup">' + icon("download") + 'Download backup</button>' +
          '<button class="btn" id="set-restore">' + icon("upload") + 'Restore backup</button>' +
        '</div>' +
        '<input type="file" id="set-restore-input" accept=".json" style="display:none">' +
        '<div class="divider"></div>' +
        '<div class="notice danger">' + icon("alert") + '<div><b>Danger zone.</b> Resetting permanently deletes all aliases, test results and history from this browser.</div></div>' +
        '<button class="btn btn-danger btn-block mt-sm" id="set-reset">' + icon("trash") + 'Reset all data</button>'
      ) +
    '</div>' +
    '<div class="card mt" style="margin-top:16px"><div class="card-pad"><div class="row" style="gap:12px"><span style="color:var(--accent)">' + icon("shield") + '</span>' +
      '<div style="font-size:12.5px;color:var(--text-dim);line-height:1.55"><b style="color:var(--text)">Compliance:</b> This tool is for legitimate personal, business, QA and <b>authorized</b> testing only. It performs no account-creation automation, ban evasion, CAPTCHA bypass, proxy rotation or fingerprint spoofing. ' +
      '<a id="set-compliance" style="color:var(--accent);cursor:pointer;font-weight:600">Read the full notice →</a></div></div></div></div>';
  }

  function card(ic, title, sub, body) {
    return '<div class="card"><div class="card-head">' + icon(ic) + '<div><h3>' + esc(title) + '</h3><div class="sub">' + esc(sub) + '</div></div></div><div class="card-pad">' + body + '</div></div>';
  }
  function field(label, body) { return '<div class="field"><label>' + esc(label) + '</label>' + body + '</div>'; }
  function seg(id, opts, val) {
    return '<div class="segmented" id="' + id + '">' + opts.map(function (o) {
      return '<button class="' + (o[0] === val ? "active accent" : "") + '" data-v="' + o[0] + '">' + esc(o[1]) + '</button>';
    }).join("") + '</div>';
  }

  function mount(root) {
    segHandler(root, "set-theme", function (v) { S.updateSettings({ theme: v }); });
    segHandler(root, "set-density", function (v) { S.updateSettings({ density: v }); });
    bindSel(root, "set-mode", function (v) { S.updateSettings({ defaultMode: v }); });
    segHandler(root, "set-storage", function (v) {
      if (v === "supabase") U.toast("Supabase sync requires backend setup — staying on local storage", "info");
      S.updateSettings({ storageMode: v });
    });

    var baseInp = root.querySelector("#set-base");
    if (baseInp) baseInp.onchange = function () { S.updateSettings({ baseEmail: baseInp.value.trim() }); U.toast("Base inbox updated", "success"); };
    var autosave = root.querySelector("#set-autosave");
    if (autosave) autosave.onchange = function () { S.updateSettings({ autoSave: autosave.checked }); };

    // categories
    var catAdd = root.querySelector("#set-cat-add"), catIn = root.querySelector("#set-cat-in");
    function addCat() {
      var v = (catIn.value || "").trim();
      if (!v) return;
      var list = S.state.settings.categories.slice();
      if (list.indexOf(v) === -1) { list.push(v); S.updateSettings({ categories: list }); U.toast("Category added", "success"); }
    }
    if (catAdd) catAdd.onclick = addCat;
    if (catIn) catIn.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); addCat(); } };
    root.querySelectorAll("#set-cats [data-rmcat]").forEach(function (b) {
      b.onclick = function () {
        var c = b.getAttribute("data-rmcat");
        S.updateSettings({ categories: S.state.settings.categories.filter(function (x) { return x !== c; }) });
      };
    });

    root.querySelectorAll("#set-accent .swatch").forEach(function (sw) {
      sw.onclick = function () { S.updateSettings({ accent: sw.getAttribute("data-accent") }); };
    });

    numHandler(root, "set-batch", "defaultBatch");
    var maxb = root.querySelector("#set-maxbatch");
    if (maxb) maxb.onchange = function () {
      var v = Math.max(1, Math.min(S.state.settings.hardCap, +maxb.value || 1));
      S.updateSettings({ maxBatch: v });
      U.toast("Max batch set to " + v, "success");
    };

    var addBtn = root.querySelector("#set-domain-add");
    var addIn = root.querySelector("#set-domain-in");
    function addDomain() {
      var v = (addIn.value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!v) return;
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) return U.toast("Enter a valid domain", "error");
      var list = S.state.settings.authorizedDomains.slice();
      if (list.indexOf(v) === -1) { list.push(v); S.updateSettings({ authorizedDomains: list }); U.toast("Domain added", "success"); }
    }
    if (addBtn) addBtn.onclick = addDomain;
    if (addIn) addIn.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); addDomain(); } };
    root.querySelectorAll("#set-domains [data-rm]").forEach(function (b) {
      b.onclick = function () {
        var d = b.getAttribute("data-rm");
        S.updateSettings({ authorizedDomains: S.state.settings.authorizedDomains.filter(function (x) { return x !== d; }) });
      };
    });

    var backup = root.querySelector("#set-backup");
    if (backup) backup.onclick = function () { X.backupDownload(); };
    var restore = root.querySelector("#set-restore");
    var restoreIn = root.querySelector("#set-restore-input");
    if (restore) restore.onclick = function () { restoreIn.click(); };
    if (restoreIn) restoreIn.onchange = function () {
      var f = restoreIn.files[0]; if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj = JSON.parse(reader.result);
          U.confirmDialog({ title: "Restore backup?", message: "This replaces your current data with the backup contents.", confirm: "Restore" }).then(function (ok) {
            if (ok) { S.importBackup(obj); U.toast("Backup restored", "success"); }
          });
        } catch (e) { U.toast("Invalid backup file", "error"); }
      };
      reader.readAsText(f);
    };

    var reset = root.querySelector("#set-reset");
    if (reset) reset.onclick = function () {
      U.confirmDialog({ title: "Reset all data?", message: "Every alias, test result and export record will be permanently deleted from this browser.", confirm: "Yes, delete everything", danger: true }).then(function (ok) {
        if (ok) { S.resetAll(); U.toast("All data cleared", "success"); U.navigate("generator"); }
      });
    };

    var cl = root.querySelector("#set-compliance");
    if (cl) cl.onclick = function () { U.showComplianceModal(false); };
  }

  function segHandler(root, id, fn) {
    var seg = root.querySelector("#" + id);
    if (!seg) return;
    seg.querySelectorAll("button").forEach(function (b) { b.onclick = function () { fn(b.getAttribute("data-v")); }; });
  }
  function bindSel(root, id, fn) { var e = root.querySelector("#" + id); if (e) e.onchange = function () { fn(e.value); }; }
  function numHandler(root, id, key, isText) {
    var inp = root.querySelector("#" + id);
    if (!inp) return;
    inp.onchange = function () {
      var v = isText ? inp.value.trim() : Math.max(1, +inp.value || 1);
      var patch = {}; patch[key] = v; S.updateSettings(patch);
    };
  }

  window.GACC.views = window.GACC.views || {};
  window.GACC.views.settings = { render: render, mount: mount };
})();
