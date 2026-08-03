/**
 * Pull-to-refresh for touch devices.
 * Calls window.__onPullRefresh() when the user pulls past the threshold.
 */
(function () {
  const THRESHOLD = 64;
  const MAX_PULL = 110;
  const RESISTANCE = 0.45;

  let startY = 0;
  let pulling = false;
  let armed = false;
  let busy = false;
  let pull = 0;

  const el = document.createElement("div");
  el.id = "pull-refresh";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="pull-refresh__inner">
      <svg class="pull-refresh__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
        <path class="pull-refresh__arc" d="M6.5 6.5a7.5 7.5 0 1 1 0 10.6" />
      </svg>
      <span class="pull-refresh__label">Pull to refresh</span>
    </div>
  `;

  function mount() {
    const existing = document.getElementById("pull-refresh");
    const bar = document.getElementById("style-switcher");
    const node = existing || el;
    if (bar && bar.parentNode) {
      if (node.previousElementSibling !== bar) {
        bar.insertAdjacentElement("afterend", node);
      }
    } else if (!existing) {
      document.body.prepend(node);
    }
  }

  function atTop() {
    const y =
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;
    return y <= 0;
  }

  function setPull(px, refreshing) {
    pull = px;
    const t = Math.min(1, px / THRESHOLD);
    el.style.setProperty("--pull", `${px}px`);
    el.style.setProperty("--pull-t", String(t));
    el.classList.toggle("is-visible", px > 4 || refreshing);
    el.classList.toggle("is-armed", px >= THRESHOLD && !refreshing);
    el.classList.toggle("is-refreshing", refreshing);
    const label = el.querySelector(".pull-refresh__label");
    if (label) {
      label.textContent = refreshing
        ? "Refreshing…"
        : px >= THRESHOLD
          ? "Release to refresh"
          : "Pull to refresh";
    }
  }

  async function runRefresh() {
    if (busy) return;
    busy = true;
    setPull(THRESHOLD, true);
    try {
      const fn = window.__onPullRefresh;
      if (typeof fn === "function") await fn();
      else location.reload();
    } catch {
      /* app handles errors */
    } finally {
      // brief hold so the spinner is readable
      await new Promise((r) => setTimeout(r, 280));
      setPull(0, false);
      busy = false;
      pulling = false;
      armed = false;
    }
  }

  function onTouchStart(e) {
    if (busy || e.touches.length !== 1) return;
    if (!atTop()) {
      armed = false;
      return;
    }
    // Don't steal vertical scroll from form controls mid-interaction
    const t = e.target;
    if (t && (t.closest("input, textarea, select, button, [role='listbox']"))) {
      armed = false;
      return;
    }
    startY = e.touches[0].clientY;
    armed = true;
    pulling = false;
  }

  function onTouchMove(e) {
    if (!armed || busy || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0 || !atTop()) {
      if (pulling) setPull(0, false);
      pulling = false;
      return;
    }
    pulling = true;
    const dist = Math.min(MAX_PULL, dy * RESISTANCE);
    setPull(dist, false);
    // Prevent rubber-band / browser PTR while we own the gesture
    if (dist > 8 && e.cancelable) e.preventDefault();
  }

  function onTouchEnd() {
    if (!armed) return;
    armed = false;
    if (busy) return;
    if (pulling && pull >= THRESHOLD) {
      void runRefresh();
    } else {
      setPull(0, false);
      pulling = false;
    }
  }

  // Desktop / trackpad: optional wheel-at-top refresh (subtle)
  let wheelAcc = 0;
  let wheelTimer = null;
  function onWheel(e) {
    if (busy || !atTop()) {
      wheelAcc = 0;
      return;
    }
    if (e.deltaY >= 0) {
      wheelAcc = 0;
      setPull(0, false);
      return;
    }
    wheelAcc += -e.deltaY;
    const dist = Math.min(MAX_PULL, wheelAcc * 0.35);
    setPull(dist, false);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      if (pull >= THRESHOLD) void runRefresh();
      else {
        setPull(0, false);
        wheelAcc = 0;
      }
    }, 120);
  }

  function tryMount() {
    mount();
    // style-switcher may inject later in the same tick — re-home under the bar
    requestAnimationFrame(mount);
  }
  document.addEventListener("DOMContentLoaded", tryMount);
  if (document.readyState !== "loading") tryMount();

  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true });
  window.addEventListener("wheel", onWheel, { passive: true });
})();
