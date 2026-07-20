// Constants
const THEME = "theme";

// The 4 selectable color styles (护眼 / 科技感 / 白色 / 简约蓝)
// light & dark are kept as valid (backward compatible) but not shown in the switcher.
const KNOWN = ["eye", "tech", "white", "blue", "light", "dark"] as const;
const DEFAULT_THEME = "tech";

// Initial color scheme (used only when nothing is stored)
function getPreferTheme(): string {
  const currentTheme = localStorage.getItem(THEME);
  if (currentTheme && (KNOWN as readonly string[]).includes(currentTheme)) {
    return currentTheme;
  }
  return DEFAULT_THEME;
}

// Use existing theme value from inline script if available, otherwise detect
let themeValue = window.theme?.themeValue ?? getPreferTheme();

function setPreference(): void {
  localStorage.setItem(THEME, themeValue);
  reflectPreference();
}

function reflectPreference(): void {
  document.firstElementChild?.setAttribute("data-theme", themeValue);

  // Mark the active swatch in both desktop popover and mobile row
  document.querySelectorAll<HTMLElement>("[data-theme-value]").forEach((el) => {
    if (el.getAttribute("data-theme-value") === themeValue) {
      el.setAttribute("aria-current", "true");
    } else {
      el.removeAttribute("aria-current");
    }
  });

  // Get a reference to the body element
  const body = document.body;

  // Check if the body element exists before using getComputedStyle
  if (body) {
    // Get the computed styles for the body element
    const computedStyles = window.getComputedStyle(body);

    // Get the background color property
    const bgColor = computedStyles.backgroundColor;

    // Set the background color in <meta theme-color ... />
    document
      .querySelector("meta[name='theme-color']")
      ?.setAttribute("content", bgColor);
  }
}

// Update the global theme API
if (window.theme) {
  window.theme.setPreference = setPreference;
  window.theme.reflectPreference = reflectPreference;
  window.theme.setTheme = (val: string) => {
    themeValue = val;
  };
  window.theme.getTheme = () => themeValue;
} else {
  window.theme = {
    themeValue,
    setPreference,
    reflectPreference,
    getTheme: () => themeValue,
    setTheme: (val: string) => {
      themeValue = val;
    },
  };
}

// Ensure theme is reflected (in case body wasn't ready when inline script ran)
reflectPreference();

let outsideBound = false;
function bindOutsideClick(): void {
  if (outsideBound) return;
  outsideBound = true;
  document.addEventListener("click", (e) => {
    const wrap = document.querySelector("#theme-style-wrap");
    if (!wrap) return;
    const details = wrap as HTMLDetailsElement;
    if (!details.open) return;
    if (e.target instanceof Node && !details.contains(e.target)) {
      details.open = false;
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const w = document.querySelector("#theme-style-wrap");
      if (w) (w as HTMLDetailsElement).open = false;
    }
  });
}

function setThemeFeature(): void {
  // make sure active state is correct after view transitions
  reflectPreference();

  // Bind clicks on each theme option (desktop popover + mobile row).
  // Clone first to avoid duplicate listeners across Astro view transitions.
  document.querySelectorAll<HTMLElement>("[data-theme-value]").forEach((item) => {
    const fresh = item.cloneNode(true) as HTMLElement;
    item.replaceWith(fresh);
    fresh.addEventListener("click", () => {
      const val = fresh.getAttribute("data-theme-value");
      if (!val) return;
      themeValue = val;
      window.theme?.setTheme(themeValue);
      setPreference();
      // close the desktop popover if open
      const wrap = document.querySelector("#theme-style-wrap");
      if (wrap) (wrap as HTMLDetailsElement).open = false;
    });
  });

  bindOutsideClick();
}

// Set up theme features after page load
setThemeFeature();

// Runs on view transitions navigation
document.addEventListener("astro:after-swap", setThemeFeature);

// Set theme-color value before page transition
// to avoid navigation bar color flickering in Android dark mode
document.addEventListener("astro:before-swap", (event) => {
  const astroEvent = event as any;
  const bgColor = document
    .querySelector("meta[name='theme-color']")
    ?.getAttribute("content");

  if (bgColor) {
    astroEvent.newDocument
      .querySelector("meta[name='theme-color']")
      ?.setAttribute("content", bgColor);
  }
});
