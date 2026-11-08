/* ===== مقاطع الآيات: تشغيل آية واحدة من تسجيل سورة موقّت ===== */
// One detached audio element shared by a page's «listen» buttons (the Tajweed examples, the readings' examples and
// comparisons). A button carries data-k="s:a" (the verse) and, for a riwayah other than Hafs, data-r="warsh": the
// recitation is the one with verse timings for that riwayah (Q.clips). The verse is a stretch of its surah's recording,
// between its start time and the next verse's. Playback begins inside the tap, as phones require, but silent; once the
// timing is known and the file can seek, it jumps to the verse and the sound comes on; a timer set for the verse's end
// stops it (timeupdate alone would run into the next verse).
export function makeClipPlayer({ Q, t, icon, esc, toast }) {
  const au = new Audio(); au.preload = "none";
  let cur = null, tok = 0, stopAt = null, timer = 0;
  const setBtn = (b, on, loading = false) => {
    b.classList.toggle("on", on); b.classList.toggle("loading", loading);
    const label = on ? t("common.stop") : b.dataset.label || t("common.listen");
    b.innerHTML = `${icon(on ? "pause" : "play")}${b.classList.contains("icon") ? "" : `<span>${esc(label)}</span>`}`; b.setAttribute("aria-label", label);
  };
  const stop = () => { if (!au.paused) au.pause(); };
  const reset = () => { clearTimeout(timer); if (cur) { setBtn(cur, false); cur = null; } };
  function arm() {
    clearTimeout(timer); if (stopAt == null || au.paused) return;
    const left = stopAt - au.currentTime;
    if (left <= 0.03) { au.pause(); return; }
    timer = setTimeout(arm, left * 1000 / (au.playbackRate || 1));
  }
  au.addEventListener("playing", arm); au.addEventListener("seeked", arm);
  au.addEventListener("timeupdate", () => { if (stopAt != null && au.currentTime >= stopAt) au.pause(); });
  au.addEventListener("pause", () => { if (au.paused) reset(); }); // not the pause queued before the next clip started
  au.addEventListener("ended", reset);
  au.addEventListener("error", () => { if (!cur || !au.getAttribute("src")) return; reset(); toast(t("listen.loadFailed")); });
  // The app's other players stop this one, and it stops them.
  for (const id of ["audio", "qaudio"]) document.getElementById(id)?.addEventListener("play", stop);
  async function play(b) {
    if (cur === b) { stop(); return; }
    stop(); document.getElementById("audio")?.pause(); document.getElementById("qaudio")?.pause();
    const [s, a] = b.dataset.k.split(":").map(Number);
    const clips = Q.clips(b.dataset.r || "hafs"); if (!clips) { toast(t("qiraat.noTimedReciter")); return; }
    const mine = ++tok; cur = b; stopAt = null; setBtn(b, false, true);
    const fail = key => { if (mine !== tok) return; au.pause(); au.removeAttribute("src"); reset(); toast(t(key)); };
    const ready = new Promise(r => au.addEventListener("loadedmetadata", r, { once: true }));
    au.muted = true; au.src = clips.file(s);
    au.play().catch(() => fail("listen.playFailed"));
    let times = null; try { times = await clips.times(s, a); } catch { /* no timings */ }
    if (mine !== tok) return;
    if (!times) { fail("listen.loadFailed"); return; }
    await Promise.race([ready, new Promise(r => setTimeout(r, 15000))]);
    if (mine !== tok) return;
    if (!(au.readyState > 0)) { fail("listen.loadFailed"); return; }
    au.currentTime = times.start; stopAt = times.end; au.muted = false; setBtn(b, true); arm();
  }
  // A «listen» button: class tj-play, data-k="s:a", optional data-r (riwayah) and data-label; iconOnly shows no text.
  const button = (k, { r = "", label = "", cls = "", iconOnly = false } = {}) => `<button class="tj-play ${cls}${iconOnly ? " icon" : ""}" type="button" data-k="${k}"${r && r !== "hafs" ? ` data-r="${r}"` : ""}${label ? ` data-label="${esc(label)}"` : ""} aria-label="${esc(label || t("common.listen"))}">${icon("play")}${iconOnly ? "" : `<span>${esc(label || t("common.listen"))}</span>`}</button>`;
  return { play, stop, button, wire: root => root.querySelectorAll(".tj-play").forEach(b => { b.onclick = () => play(b); }) };
}
