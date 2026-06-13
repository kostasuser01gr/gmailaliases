"use client";

import Script from "next/script";

/**
 * Hosts the Gmail Alias Control Center app (ported from the Claude Design
 * handoff). The shell markup below is rendered once by React and never
 * re-rendered; the bundled imperative app in /console/app.js queries these
 * elements by id/class and drives all interactivity, exactly as the original
 * prototype did. Mounting happens after the script loads.
 */
declare global {
  interface Window {
    GACC?: { ui?: { init: () => void } } & Record<string, unknown>;
    __gaccInit?: boolean;
  }
}

function mountApp() {
  if (typeof window === "undefined") return;
  if (window.__gaccInit) return;
  if (!window.GACC?.ui?.init) return;
  window.__gaccInit = true;
  window.GACC.ui.init();
}

export default function AliasControlCenter() {
  return (
    <>
      <div id="app">
        {/* sidebar */}
        <aside id="sidebar">
          <div className="brand">
            <div className="logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
              </svg>
            </div>
            <div>
              <div className="name">Alias Control</div>
              <div className="sub">Gmail alias manager</div>
            </div>
          </div>
          <div className="nav-label">Workspace</div>
          <nav id="nav-items" />
          <div className="sidebar-foot">
            <div className="compliance-card">
              <div className="ttl">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Authorized use only
              </div>
              Test only on systems you own or are permitted to test.{" "}
              <a id="compliance-link">Details</a>
            </div>
          </div>
        </aside>

        {/* main */}
        <div id="main">
          <header id="topbar">
            <button className="icon-btn hamburger" id="hamburger" aria-label="Menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <div className="topbar-title">
              <h1 id="page-title">Alias Generator</h1>
              <p id="page-sub">Generate Gmail alias variations</p>
            </div>
            <div className="topbar-actions">
              <div className="quick-copy hide" id="quick-copy" />
              <button className="cmdk-trigger" id="cmdk-trigger">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <span className="label">Search &amp; commands</span>
                <span className="kbd">⌘K</span>
              </button>
              <button className="icon-btn" id="theme-toggle" aria-label="Toggle theme" />
              <button className="icon-btn" id="help-btn" aria-label="Help">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </button>
            </div>
          </header>
          <main id="view" />
        </div>
      </div>

      {/* command palette */}
      <div className="scrim hide" id="cmdk-scrim">
        <div className="cmdk">
          <div className="cmdk-input">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input id="cmdk-input" placeholder="Type a command…" autoComplete="off" />
            <span className="kbd">esc</span>
          </div>
          <div className="cmdk-list" id="cmdk-list" />
        </div>
      </div>

      <div id="toasts" />

      <Script src="/console/app.js" strategy="afterInteractive" onReady={mountApp} onLoad={mountApp} />
    </>
  );
}
