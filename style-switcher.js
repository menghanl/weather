/**
 * Top-of-page style dropdown shared by all weather variants.
 * Injects a fixed bar skinned via data-style to match the active theme.
 */
(function () {
  const STYLES = [
    {
      id: "original",
      label: "Original dark",
      dir: "",
      pickerLabel: "Style",
    },
    {
      id: "01-paper-editorial",
      label: "Paper editorial",
      dir: "variants/01-paper-editorial/",
      pickerLabel: "Edition",
    },
    {
      id: "02-terminal-mono",
      label: "Terminal mono",
      dir: "variants/02-terminal-mono/",
      pickerLabel: "skin",
    },
    {
      id: "03-soft-pastel",
      label: "Soft pastel",
      dir: "variants/03-soft-pastel/",
      pickerLabel: "Look",
    },
    {
      id: "04-neubrutal",
      label: "Neubrutal",
      dir: "variants/04-neubrutal/",
      pickerLabel: "LOOK",
    },
    {
      id: "05-swiss-minimal",
      label: "Swiss minimal",
      dir: "variants/05-swiss-minimal/",
      pickerLabel: "Variant",
    },
  ];

  function appBase() {
    const p = location.pathname;
    const i = p.indexOf("/variants/");
    if (i !== -1) return p.slice(0, i) + "/";
    if (p.endsWith(".html")) return p.replace(/[^/]+$/, "");
    return p.endsWith("/") ? p : p + "/";
  }

  function currentId() {
    const p = location.pathname;
    for (const s of STYLES) {
      if (!s.dir) continue;
      if (p.includes("/" + s.dir) || p.includes("/" + s.dir.replace(/\/$/, ""))) {
        return s.id;
      }
    }
    return "original";
  }

  function hrefFor(style) {
    const base = appBase();
    if (!style.dir) return base.replace(/\/variants\/.*$/, "/") || "/";
    return base + style.dir;
  }

  function mount() {
    if (document.getElementById("style-switcher")) return;

    const current = currentId();
    const meta = STYLES.find((s) => s.id === current) || STYLES[0];

    document.documentElement.dataset.weatherStyle = current;

    const bar = document.createElement("div");
    bar.id = "style-switcher";
    bar.dataset.style = current;
    bar.setAttribute("role", "navigation");
    bar.setAttribute("aria-label", "Visual style");

    bar.innerHTML = `
      <label for="style-switcher-select">${meta.pickerLabel}</label>
      <select id="style-switcher-select" aria-label="Choose visual style">
        ${STYLES.map(
          (s) =>
            `<option value="${s.id}"${s.id === current ? " selected" : ""}>${s.label}</option>`
        ).join("")}
      </select>
    `;

    const spacer = document.createElement("div");
    spacer.className = "style-switcher-spacer";
    spacer.setAttribute("aria-hidden", "true");

    document.body.prepend(spacer);
    document.body.prepend(bar);

    const select = bar.querySelector("select");
    select.addEventListener("change", () => {
      const style = STYLES.find((s) => s.id === select.value);
      if (!style || style.id === current) return;
      location.href = hrefFor(style);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
