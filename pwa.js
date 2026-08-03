/** Register service worker when served over http(s). */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = (() => {
      const p = location.pathname;
      const i = p.indexOf("/variants/");
      if (i !== -1) return p.slice(0, i) + "/";
      if (p.endsWith(".html")) return p.replace(/[^/]+$/, "");
      return p.endsWith("/") ? p : p + "/";
    })();
    navigator.serviceWorker.register(base + "sw.js", { scope: base }).catch(() => {
      /* ignore — e.g. file:// */
    });
  });
}
