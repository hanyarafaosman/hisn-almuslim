/* ===== القنوات الدينية: دروس العلماء مرئية مجمعة في سلاسل، والبث المباشر من الحرمين ===== */
// data/videos.json (scripts/build-series.js): each series is one or more YouTube playlists of the scholar's own channel,
// in their order. Episodes play in YouTube's own player (youtube-nocookie.com) through its IFrame API, so the next
// episode starts by itself and the episode and minute reached are kept. The live channels are HLS streams of the
// Saudi Broadcasting Authority: played by the browser itself where it can (phones), otherwise with hls.js (js/vendor).

const GROUPS = ["quran", "sunnah", "seerah", "aqeedah", "fiqh", "misc"];
const YT_HOST = "https://www.youtube-nocookie.com";

export function setupVideos(ctx) {
  const { view, $, esc, icon, t, num, sep, getLang, LS, setHeader, setNav, toast, Q } = ctx;
  const state = Object.assign({ group: "quran", last: null, at: {} }, LS.get("videos", {})); // at: { series: [episode, seconds] }
  const save = () => LS.set("videos", state);
  const stale = hash => location.hash !== hash;
  const isAr = () => getLang() === "ar";
  const loading = () => `<div class="empty"><div class="spinner"></div><div>${esc(t("common.loading"))}</div></div>`;

  let DATA = null;
  const load = async () => DATA || (DATA = await fetch("data/videos.json").then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).catch(e => { DATA = null; throw e; }));
  const failed = (err, retry) => {
    const offline = !navigator.onLine || err instanceof TypeError;
    view.innerHTML = `<div class="empty">${icon("video")}<div>${esc(t(offline ? "videos.needNet" : "common.loadFailed"))}</div><br><button class="btn" id="retry">${esc(t("common.retry"))}</button></div>`;
    $("#retry").onclick = retry;
  };
  const title = s => isAr() ? s.ar : s.en;
  const by = s => isAr() ? s.by : s.byEn;
  const channel = s => { const c = DATA.channels[s.ch]; return c ? (isAr() ? c.ar : c.en) : ""; };
  // All the episodes of a series in one list: [videoId, title, seconds, part index, number within its part].
  const episodes = s => s.parts.flatMap((p, k) => p.eps.map((e, i) => [...e, k, i + 1]));
  const thumb = (id, size = "mqdefault") => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/${size}.jpg`;
  const two = n => num(Math.floor(n / 10)) + num(n % 10);
  const duration = sec => { if (!sec) return ""; const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return (h ? num(h) + ":" + two(m) : num(m)) + ":" + two(s); };
  const epName = e => e[1] || t("videos.episode", { n: e[4] });
  const partName = p => p.ar ? (isAr() ? p.ar : p.en) : "";
  // «وصلت إلى الحلقة ٣» / «متابعة الحلقة ٣», with the part's name when the series has parts (episodes are numbered in each).
  const reached = (s, at, key) => { const e = episodes(s)[at[0]]; if (!e) return t(key, { n: at[0] + 1 }); const p = s.parts.length > 1 ? partName(s.parts[e[3]]) : ""; return t(key, { n: e[4] }) + (p ? sep() + p : ""); };
  const liveIcon = c => c.id === "makkah" || c.yt === "haram" ? "kaaba" : "prayer";
  function seriesRow(s) {
    const eps = episodes(s), at = state.at[s.id];
    return `<a class="vrow" href="#/videos/${esc(s.id)}"><span class="vthumb"><img src="${thumb(eps[0][0])}" alt="" loading="lazy" decoding="async"><span class="vcount">${esc(t("count.episodes", { n: eps.length }))}</span></span>
      <span class="lbl">${esc(title(s))}${isAr() ? "" : ` <span class="ar-name" lang="ar" dir="rtl">${esc(s.ar)}</span>`}<span class="sub">${esc(by(s))}</span>${at ? `<span class="sub vreach">${esc(reached(s, at, "videos.reached"))}</span>` : ""}</span></a>`;
  }

  // ---------- the channels page ----------
  async function renderHome(g) {
    setNav("videos"); setHeader(t("videos.title")); const hash = location.hash;
    view.innerHTML = loading();
    try { await load(); } catch (e) { return stale(hash) || failed(e, () => renderHome(g)); }
    if (stale(hash)) return;
    let group = GROUPS.includes(g) ? g : GROUPS.includes(state.group) ? state.group : "quran";
    const last = state.last && DATA.series.find(s => s.id === state.last), lastAt = last && state.at[last.id];
    const liveCard = c => `<a class="resume" href="#/videos/live/${esc(c.id)}">${icon(liveIcon(c))}<div><b>${esc(isAr() ? c.ar : c.en)}</b><span>${esc(t(c.yt ? "videos.lessonsLiveSub" : "videos.liveSub", { place: isAr() ? c.at : c.atEn }))}</span></div></a>`;
    view.innerHTML = `
      <p class="riwayah-note">${esc(t("videos.intro"))}</p>
      ${isAr() ? "" : `<div class="info">${icon("translate")}<div>${esc(t("media.arabicOnly"))}</div></div>`}
      <h2 class="section-title">${esc(t("videos.live"))}</h2>
      <div class="resume-row">${DATA.live.filter(c => !c.yt).map(liveCard).join("")}</div>
      <h2 class="section-title">${esc(t("videos.lessonsLive"))}</h2>
      <div class="resume-row">${DATA.live.filter(c => c.yt).map(liveCard).join("")}</div>
      ${last && lastAt ? `<div class="resume-row" style="margin-top:10px"><a class="resume" href="#/videos/${esc(last.id)}">${icon("play")}<div><b>${esc(reached(last, lastAt, "videos.continue"))}</b><span>${esc(title(last))}</span></div></a></div>` : ""}
      <h2 class="section-title">${esc(t("videos.series"))}</h2>
      <div class="chips radio-groups" id="vgroups" role="tablist">${GROUPS.map(x => `<button class="chip" role="tab" data-g="${x}">${esc(t("media." + x))}</button>`).join("")}</div>
      <div id="vlist"></div>
      <p class="source-note">${esc(t("videos.sourceNote"))}</p>`;
    const show = x => {
      group = x; state.group = x; save();
      $("#vgroups").querySelectorAll("[data-g]").forEach(b => { const on = b.dataset.g === x; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
      // The series of the group, gathered by the channel they come from.
      $("#vlist").innerHTML = Object.keys(DATA.channels).map(k => {
        const list = DATA.series.filter(s => s.group === x && s.ch === k); if (!list.length) return "";
        return `<h3 class="vch">${esc(isAr() ? DATA.channels[k].ar : DATA.channels[k].en)}</h3><div class="list vlist">${list.map(seriesRow).join("")}</div>`;
      }).join("");
    };
    $("#vgroups").onclick = e => { const b = e.target.closest("[data-g]"); if (!b || b.dataset.g === group) return; history.replaceState(null, "", "#/videos?g=" + b.dataset.g); show(b.dataset.g); b.scrollIntoView({ inline: "nearest", block: "nearest" }); };
    show(group);
    $("#vgroups .chip.on")?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }

  // ---------- YouTube's player ----------
  let ytApi = null;
  const loadYT = () => ytApi ||= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const before = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { before?.(); resolve(window.YT); };
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.async = true;
    s.onerror = () => { ytApi = null; s.remove(); reject(new Error("YouTube")); };
    setTimeout(() => { if (!window.YT?.Player) { ytApi = null; reject(new Error("YouTube timeout")); } }, 15000);
    document.head.appendChild(s);
  });

  // ---------- one series: the player and its episodes ----------
  async function renderSeries(id, params) {
    setNav("videos"); setHeader(t("videos.title"), { back: true }); const hash = location.hash;
    view.innerHTML = loading();
    try { await load(); } catch (e) { return stale(hash) || failed(e, () => renderSeries(id, params)); }
    if (stale(hash)) return;
    const s = DATA.series.find(x => x.id === id); if (!s) { location.replace("#/videos"); return; }
    setHeader(title(s), { back: true });
    const eps = episodes(s); const asked = Number(params.get("e")) - 1;
    const saved = state.at[s.id];
    let cur = asked >= 0 && asked < eps.length ? asked : saved ? Math.min(saved[0], eps.length - 1) : 0;
    const startAt = () => saved && saved[0] === cur ? saved[1] : 0;
    const rows = s.parts.map((p, k) => {
      const list = eps.map((e, i) => [e, i]).filter(([e]) => e[3] === k);
      return (s.parts.length > 1 ? `<h2 class="section-title">${esc(partName(p) || t("videos.part", { n: k + 1 }))}</h2>` : "")
        + `<div class="list">${list.map(([e, i]) => `<button class="row" data-i="${i}"><div class="num">${num(e[4])}</div><div class="lbl"${e[1] ? ' lang="ar" dir="rtl"' : ""}>${esc(epName(e))}${e[2] ? `<span class="sub" dir="ltr">${esc(duration(e[2]))}</span>` : ""}</div>${icon("play", "chev-play")}</button>`).join("")}</div>`;
    }).join("");
    view.innerHTML = `
      <div class="vplayer" id="vp"><button class="vposter" id="vposter" type="button" aria-label="${esc(t("videos.play"))}"><img alt="" src="${thumb(eps[cur][0], "hqdefault")}"><span class="vplay">${icon("play")}</span></button></div>
      <div class="vnow">
        <div class="vnow-t"><b id="vt"></b><span id="vs"></span></div>
        <div class="vnav"><button class="icon-btn" id="vprev" aria-label="${esc(t("videos.prev"))}">${icon("next")}</button><button class="icon-btn" id="vnext" aria-label="${esc(t("videos.next"))}">${icon("prev")}</button></div>
      </div>
      <p class="riwayah-note">${esc(by(s) + sep() + t("count.episodes", { n: eps.length }))}${isAr() ? "" : `<br><span lang="ar" dir="rtl">${esc(s.ar)}</span>`}</p>
      <div id="veps">${rows}</div>
      <p class="source-note">${esc(t("videos.source", { channel: channel(s) }))} <a id="vyt" target="_blank" rel="noopener">${esc(t("videos.openYoutube"))}</a></p>`;
    const vp = $("#vp");
    const mark = () => {
      const e = eps[cur]; const p = s.parts[e[3]];
      $("#vt").textContent = epName(e); $("#vt").lang = e[1] ? "ar" : ""; $("#vt").dir = e[1] ? "rtl" : "auto";
      $("#vs").textContent = [partName(p), t("videos.episode", { n: e[4] }), duration(e[2])].filter(Boolean).join(sep());
      $("#vprev").disabled = cur <= 0; $("#vnext").disabled = cur >= eps.length - 1;
      $("#vyt").href = `https://www.youtube.com/watch?v=${encodeURIComponent(e[0])}&list=${encodeURIComponent(p.list)}`;
      view.querySelectorAll("#veps [data-i]").forEach(b => b.classList.toggle("on", Number(b.dataset.i) === cur));
    };
    const remember = sec => { state.at[s.id] = [cur, Math.floor(sec || 0)]; state.last = s.id; save(); };
    let yt = null, ready = false, plain = false, pending = null; // pending: [video, seconds] chosen while the player loads
    function play(i, at = 0) {
      cur = i; mark(); remember(at); Q.player.pause();
      const vid = eps[cur][0];
      if (plain) { frame(vid, at); return; }
      if (yt) { if (ready) yt.loadVideoById({ videoId: vid, startSeconds: at }); else pending = [vid, at]; return; }
      yt = "loading"; vp.innerHTML = `<div id="ytf"></div>`;
      loadYT().then(YT => {
        if (!document.body.contains(vp)) return;
        yt = new YT.Player("ytf", {
          host: YT_HOST, videoId: vid,
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, start: Math.floor(at), hl: getLang(), iv_load_policy: 3 },
          events: {
            onReady: () => { ready = true; if (pending) { yt.loadVideoById({ videoId: pending[0], startSeconds: pending[1] }); pending = null; } },
            onStateChange: e => {
              if (e.data === YT.PlayerState.PLAYING) Q.player.pause();
              if (e.data === YT.PlayerState.ENDED) { if (cur < eps.length - 1) play(cur + 1); else remember(0); }
            },
            // 101/150: the owner does not allow playing it in other sites; 100: removed or private.
            onError: () => { toast(t("videos.playFailed")); },
          },
        });
      }).catch(() => { plain = true; yt = null; const [v, sec] = pending || [eps[cur][0], at]; pending = null; frame(v, sec); });
    }
    // Without the IFrame API (blocked or offline at first), a plain embedded player: no automatic next episode.
    function frame(vid, at) {
      vp.innerHTML = `<iframe src="${YT_HOST}/embed/${encodeURIComponent(vid)}?autoplay=1&playsinline=1&rel=0&start=${Math.floor(at)}" title="${esc(epName(eps[cur]))}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    }
    mark();
    $("#vposter").onclick = () => play(cur, startAt());
    $("#vprev").onclick = () => { if (cur > 0) play(cur - 1); };
    $("#vnext").onclick = () => { if (cur < eps.length - 1) play(cur + 1); };
    $("#veps").onclick = e => { const b = e.target.closest("[data-i]"); if (!b) return; play(Number(b.dataset.i)); vp.scrollIntoView({ block: "nearest", behavior: "smooth" }); };
    // Keep the minute reached; stop when the page is left.
    const timer = setInterval(() => {
      if (!document.body.contains(vp)) { clearInterval(timer); try { if (ready) yt.destroy(); } catch { /* already gone */ } return; }
      if (ready && yt.getPlayerState() === 1) remember(yt.getCurrentTime());
    }, 5000);
    if (asked >= 0) view.querySelector(`#veps [data-i="${cur}"]`)?.scrollIntoView({ block: "center" });
  }

  // ---------- a live channel ----------
  let hlsLib = null;
  const loadHls = () => hlsLib ||= new Promise((resolve, reject) => {
    if (window.Hls) return resolve(window.Hls);
    const s = document.createElement("script"); s.src = "js/vendor/hls.light.min.js"; s.onload = () => resolve(window.Hls); s.onerror = () => { hlsLib = null; reject(new Error("hls.js")); };
    document.head.appendChild(s);
  });
  async function renderLive(id) {
    setNav("videos"); setHeader(t("videos.live"), { back: true }); const hash = location.hash;
    view.innerHTML = loading();
    try { await load(); } catch (e) { return stale(hash) || failed(e, () => renderLive(id)); }
    if (stale(hash)) return;
    const c = DATA.live.find(x => x.id === id); if (!c) { location.replace("#/videos"); return; }
    setHeader(isAr() ? c.ar : c.en, { back: true });
    if (c.yt) return renderLessonsLive(c);
    view.innerHTML = `
      <div class="vplayer"><video id="lv" controls playsinline autoplay preload="none"></video></div>
      <div class="vnow"><div class="vnow-t"><b>${esc(isAr() ? c.ar : c.en)}</b><span>${esc(t("videos.liveSub", { place: isAr() ? c.at : c.atEn }))}</span></div></div>
      <div class="list">${DATA.live.filter(x => x.id !== id).map(x => `<a href="#/videos/live/${esc(x.id)}" data-replace><div class="num">${icon(x.id === "makkah" ? "kaaba" : "prayer")}</div><div class="lbl">${esc(isAr() ? x.ar : x.en)}<span class="sub">${esc(t("videos.liveSub", { place: isAr() ? x.at : x.atEn }))}</span></div>${icon("back", "chev")}</a>`).join("")}</div>
      <p class="source-note">${esc(t("videos.liveNote"))}</p>`;
    view.querySelectorAll("[data-replace]").forEach(a => a.onclick = e => { e.preventDefault(); location.replace(a.getAttribute("href")); });
    const v = $("#lv"); let hls = null;
    const fail = () => { if (document.body.contains(v)) toast(t("videos.liveFailed")); };
    v.addEventListener("play", () => Q.player.pause());
    const stop = () => { if (stale(hash)) { window.removeEventListener("hashchange", stop); hls?.destroy(); v.removeAttribute("src"); v.load(); } };
    window.addEventListener("hashchange", stop);
    if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = c.url; v.addEventListener("error", fail); }
    else {
      try {
        const Hls = await loadHls(); if (stale(hash)) return;
        if (!Hls.isSupported()) { fail(); return; }
        hls = new Hls({ liveDurationInfinity: true });
        hls.on(Hls.Events.ERROR, (ev, d) => { if (d.fatal) { hls.destroy(); fail(); } });
        hls.loadSource(c.url); hls.attachMedia(v);
      } catch { fail(); return; }
    }
    v.play().catch(() => { /* the browser waits for a tap on its play button */ });
  }

  // The lessons of one of the Two Holy Mosques: its channel's live broadcast (YouTube shows the lesson being given, or the
  // time of the next one), and the recorded lessons of the same channel.
  function renderLessonsLive(c) {
    const ch = DATA.channels[c.yt]; const recorded = DATA.series.filter(s => s.ch === c.yt);
    const others = DATA.live.filter(x => x.yt && x.id !== c.id);
    Q.player.pause();
    view.innerHTML = `
      <div class="vplayer"><iframe src="${YT_HOST}/embed/live_stream?channel=${encodeURIComponent(ch.yt)}&autoplay=1&playsinline=1&rel=0&hl=${encodeURIComponent(getLang())}" title="${esc(isAr() ? c.ar : c.en)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
      <div class="vnow"><div class="vnow-t"><b>${esc(isAr() ? c.ar : c.en)}</b><span>${esc(t("videos.lessonsLiveSub", { place: isAr() ? c.at : c.atEn }))}</span></div></div>
      <p class="radio-note card">${icon("video")}<span>${esc(t("videos.lessonsLiveNote"))}</span></p>
      <div class="list" style="margin-top:12px">
        <a href="https://www.youtube.com/channel/${encodeURIComponent(ch.yt)}/streams" target="_blank" rel="noopener"><div class="num">${icon("video")}</div><div class="lbl">${esc(t("videos.schedule"))}</div>${icon("back", "chev")}</a>
        ${others.map(x => `<a href="#/videos/live/${esc(x.id)}" data-replace><div class="num">${icon(liveIcon(x))}</div><div class="lbl">${esc(isAr() ? x.ar : x.en)}<span class="sub">${esc(t("videos.lessonsLiveSub", { place: isAr() ? x.at : x.atEn }))}</span></div>${icon("back", "chev")}</a>`).join("")}
      </div>
      ${recorded.length ? `<h2 class="section-title">${esc(t("videos.recorded"))}</h2><div class="list vlist">${recorded.map(seriesRow).join("")}</div>` : ""}
      <p class="source-note">${esc(t("videos.source", { channel: isAr() ? ch.ar : ch.en }))}</p>`;
    view.querySelectorAll("[data-replace]").forEach(a => a.onclick = e => { e.preventDefault(); location.replace(a.getAttribute("href")); });
  }

  // Series whose title, teacher or channel matches, for the Home search.
  async function search(q) {
    const fold = x => String(x).normalize("NFD").replace(/\p{M}/gu, "").replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").toLowerCase();
    const want = fold(q).split(/\s+/).filter(Boolean); if (want.join("").length < 2) return [];
    await load();
    return DATA.series.filter(s => { const k = fold([s.ar, s.en, s.by, s.byEn, channel(s)].join(" ")); return want.every(w => k.includes(w)); })
      .map(s => ({ href: `#/videos/${s.id}`, name: title(s), sub: by(s) }));
  }

  return {
    render(parts, params) {
      if (!parts.length) return renderHome(params.get("g"));
      if (parts[0] === "live") return renderLive(parts[1]);
      return renderSeries(parts[0], params);
    },
    search,
  };
}
