// Cross-page motion for the auth flow. Modern (Chromium) browsers get a
// native cross-document View Transition via the `@view-transition` rule in
// auth.css — no JS needed for those. Everywhere else, outbound links get a
// short fade-out before navigating so it never reads as a hard cut.
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const supportsViewTransitions =
  "startViewTransition" in document || CSS.supports("(view-transition-name: none)");

function initFadeFallback() {
  if (prefersReducedMotion || supportsViewTransitions) return;
  document.querySelectorAll("[data-transition-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || link.target === "_blank" || event.metaKey || event.ctrlKey) return;
      event.preventDefault();
      document.body.classList.add("page-fade-out");
      setTimeout(() => { window.location.href = href; }, 180);
    });
  });
}

initFadeFallback();
