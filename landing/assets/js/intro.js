// FeastNow landing — intro curtain: letters rise, curtain lifts with a curved
// edge, then the hero assembles (ticker drops, headline words rise, the food
// cart rolls in on spinning wheels).
import { gsap, ScrollTrigger, prefersReducedMotion, lenis } from "./main.js";

export function initIntro() {
  const intro = document.getElementById("intro");
  const done = () => {
    intro?.remove();
    document.body.classList.remove("intro-active");
    lenis?.start();
    if (ScrollTrigger) ScrollTrigger.refresh();
  };

  // Reduced motion, no GSAP, or missing overlay: skip straight to the page.
  if (!intro || prefersReducedMotion || !gsap) { done(); return; }

  lenis?.stop();
  window.scrollTo(0, 0);

  const q = (sel) => document.querySelector(sel);
  const qa = (sel) => gsap.utils.toArray(sel);

  const tl = gsap.timeline({ defaults: { ease: "expo.out" }, onComplete: done });

  // --- inside the curtain ---
  tl.from(".intro__hat", { y: -34, opacity: 0, duration: 0.55 })
    .from(".intro__word span", { y: 44, opacity: 0, duration: 0.5, stagger: 0.045 }, "-=0.25")
    .from(".intro__script", { opacity: 0, y: 10, duration: 0.4 }, "-=0.15");

  // --- curtain lifts (curved edge trails behind) ---
  tl.to(intro, { yPercent: -112, duration: 0.9, ease: "expo.inOut", delay: 0.55 });

  // --- hero assembles under it (guard: only on pages that have a hero) ---
  if (q("#hero")) {
    tl.from("#ticker", { yPercent: -100, duration: 0.45 }, "-=0.45")
      .from("#nav .nav__row", { y: -18, opacity: 0, duration: 0.45 }, "<0.05")
      .from(".hero__tag", { opacity: 0, y: 14, duration: 0.4 }, "<0.1")
      .from(".hero__title .w", { y: 46, opacity: 0, duration: 0.55, stagger: 0.06 }, "<")
      .from(".hero__sub", { y: 20, opacity: 0, duration: 0.45 }, "-=0.3")
      .from(".hero__cta .btn", { y: 16, opacity: 0, duration: 0.4, stagger: 0.08, clearProps: "all" }, "-=0.3");

    const wheels = qa(".hero__stage .cart__wheel");
    tl.from(".cart", { x: 110, opacity: 0, duration: 0.8, ease: "expo.out", clearProps: "all" }, "-=0.75");
    if (wheels.length) tl.from(wheels, { rotation: -420, duration: 0.9, ease: "expo.out", clearProps: "all" }, "<");
    // fromTo + clearProps: these carry CSS hover transitions, so the tween
    // must own the inline transform and then remove it. .hex is positioned
    // with the CSS `translate` property, which GSAP transforms leave alone.
    tl.fromTo(".hex",
      { scale: 0, rotation: -8, opacity: 0 },
      { scale: 1, rotation: 0, opacity: 1, duration: 0.5, ease: "back.out(1.4)", clearProps: "all" }, "-=0.35");
    tl.from(".hero__card", { y: 34, opacity: 0, duration: 0.45, stagger: 0.12, clearProps: "all" }, "-=0.3");
  }
}
