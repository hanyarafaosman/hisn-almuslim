/* ===== حصن ونور — installing the app on the device =====
   Browsers never let a website install itself: the person has to agree. So the install window opens by itself
   a moment after the app starts, with the shortest way the browser allows:
   - Chrome, Edge, Samsung Internet… (Android and computer): one "Install" button (the browser's own install prompt);
   - iPhone and iPad: the three taps of Share › Add to Home Screen (Apple gives websites no install button);
   - the browser inside Facebook, Instagram, TikTok…: open the link in the real browser first;
   - Safari on a Mac: File › Add to Dock. */
export function setupInstall({ $, esc, icon, t, th, LS, toast, copyText, sheet, closeSheet, SITE }) {
  const ASKED = "installAsked";           // when the window last opened by itself
  const AGAIN = 3 * 24 * 60 * 60 * 1000;  // after "Later", it opens by itself again 3 days on
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); // iPadOS says "Macintosh"
  const android = /Android/.test(ua);
  // Browsers built into other apps cannot install anything. On Android they are WebViews ("; wv)" in the user agent).
  const inApp = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Snapchat|TikTok|musical_ly|BytedanceWebview|LinkedInApp|MicroMessenger|Telegram/.test(ua)
    || (ios && /GSA\//.test(ua)) || (android && /; wv\)/.test(ua));
  const macSafari = !ios && /Macintosh/.test(ua) && /Version\/[\d.]+.*Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);
  const chromium = "onbeforeinstallprompt" in window;

  let deferred = null, booted = false, related = false;
  // "installed" is remembered after an install from this browser; Chrome offers its prompt again only once the app is removed.
  const installed = () => matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: window-controls-overlay)").matches
    || navigator.standalone === true || document.referrer.startsWith("android-app://") || !!window.Capacitor || related || LS.get("installed", false);
  const hideCards = () => document.querySelectorAll(".in-card").forEach(x => x.remove());

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); deferred = e; LS.set("installed", false);
    // Chrome may offer this only after some time on the page: open the window then.
    if (booted) auto(1500);
  });
  window.addEventListener("appinstalled", () => { deferred = null; LS.set("installed", true); closeSheet(); hideCards(); toast(t("install.installed")); });
  // Chrome knows whether this app is already installed (manifest related_applications, platform "webapp").
  navigator.getInstalledRelatedApps?.().then(apps => { if (apps.length) { related = true; hideCards(); } }).catch(() => {});

  // How this browser installs: its own prompt, the steps of a menu, or first moving to a browser that can.
  const way = () => deferred ? "prompt" : inApp ? "inApp" : ios ? "ios" : macSafari ? "mac" : chromium || android ? "menu" : "other";

  async function prompt() {
    const e = deferred; if (!e) return open();
    closeSheet(); deferred = null; // each prompt can be shown only once
    e.prompt();
    const { outcome } = await e.userChoice.catch(() => ({}));
    if (outcome === "accepted") LS.set("installed", true);
  }

  function open() {
    const w = way();
    const step = (n, html) => `<li><span class="n">${n}</span><div>${html}</div></li>`;
    const ic = n => `<svg class="in-ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
    const copyBtn = cls => `<button class="btn ${cls} block" id="in-copy">${icon("copy")}${esc(t("install.copyLink"))}</button>`;
    const body = {
      prompt: `<div class="in-actions"><button class="btn block" id="in-go">${icon("install")}${esc(t("install.now"))}</button><button class="btn ghost block" data-close>${esc(t("install.later"))}</button></div>`,
      ios: `<ol class="in-steps">${step(1, th("install.iosStep1", {}, { icon: ic("ios-share") }, esc))}${step(2, th("install.iosStep2", {}, { icon: ic("add-box") }, esc))}${step(3, esc(t("install.iosStep3")))}</ol>`,
      inApp: `<p class="in-note">${esc(t("install.inApp"))}</p><div class="in-actions">${android ? `<button class="btn block" id="in-browser">${icon("globe")}${esc(t("install.openBrowser"))}</button>${copyBtn("ghost")}` : copyBtn("")}</div><p class="in-hint">${esc(t("install.inAppHint"))}</p>`,
      mac: `<p class="in-note">${esc(t("install.macSafari"))}</p>`,
      menu: `<p class="in-note">${esc(t("settings.installManual"))}</p>`,
      other: `<p class="in-note">${esc(t("install.otherBrowser"))}</p><div class="in-actions">${copyBtn("ghost")}</div>`,
    }[w];
    const root = sheet(t("install.title", { app: t("app.name") }), `<div class="in-app"><img src="icons/icon-192.png" alt="" width="56" height="56"><p>${esc(t("install.lead"))}</p></div>${body}`);
    root.classList.add("install");
    const go = $("#in-go", root); if (go) go.onclick = prompt;
    const copy = $("#in-copy", root); if (copy) copy.onclick = () => copyText(SITE);
    // Opens the app's address in Chrome (an Android "intent:" link); where Chrome is missing the page simply stays.
    const br = $("#in-browser", root); if (br) br.onclick = () => {
      const u = new URL(SITE);
      location.href = `intent://${u.host}${u.pathname}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(SITE)};end`;
    };
  }

  // Opens the window by itself, unless the app is installed, it opened by itself less than 3 days ago,
  // or this browser cannot install (Firefox on a computer). Waits while another window is open.
  let timer = 0;
  function auto(delay) {
    clearTimeout(timer);
    timer = setTimeout(function tryOpen() {
      if (installed() || Date.now() - LS.get(ASKED, 0) < AGAIN) return;
      const w = way();
      // Chrome without its prompt yet: wait for it (Chrome offers it after a little use of the site).
      if (w === "other" || (w === "menu" && chromium)) return;
      if (document.getElementById("sheet") || document.visibilityState !== "visible") { timer = setTimeout(tryOpen, 8000); return; }
      LS.set(ASKED, Date.now()); open();
    }, delay);
  }

  return {
    installed,
    open,
    // Called once the app has drawn its first page.
    start() { booted = true; auto(2500); },
    // An "Install the app" row (home page, settings), or "" once the app is installed.
    card() {
      if (installed()) return "";
      return `<div class="card in-card"><div class="setting"><span class="ic">${icon("install")}</span><div class="lbl">${esc(t("settings.install"))}<small>${esc(t("settings.installHint"))}</small></div><button class="btn small" data-install>${esc(t("settings.installBtn"))}</button></div></div>`;
    },
    bind(root) { root.querySelectorAll("[data-install]").forEach(b => b.onclick = prompt); },
  };
}
