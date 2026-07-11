// FeastNow landing — intro curtain: letters rise, curtain lifts with a curved
// edge, then the hero assembles (awning drops, ticker falls, headline rises,
// the food cart rolls in from the right, flanking cards fly in from their
// sides — then the steam billow starts).
import { gsap, ScrollTrigger, prefersReducedMotion, lenis } from "./main.js";

/** Start the cart steam billow — called after the hero assembly finishes. */
export function startSteam() {
  if (!gsap) return;
  const paths = document.querySelectorAll(".cart__steam path");
  if (!paths.length) return;
  paths.forEach((p, i) => {
    gsap.to(p, {
      y: -16, scale: 1.7, opacity: 0,
      duration: 2.6 + i * 0.4, ease: "power1.out", repeat: -1,
      delay: i * 1.3,
      transformOrigin: "50% 100%",
    });
  });
}

export function initIntro() {
  const intro = document.getElementById("intro");
  const done = () => {
    intro?.remove();
    document.body.classList.remove("intro-active");
    startSteam();
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
    // awning canopy drops in from above
    tl.from(".hero__awning", { y: -80, opacity: 0, duration: 0.5 }, "-=0.4")
      .from("#ticker", { yPercent: -100, duration: 0.45 }, "-=0.45")
      .from("#nav .nav__row", { y: -18, opacity: 0, duration: 0.45 }, "<0.05")
      .from(".hero__tag", { opacity: 0, y: 14, duration: 0.4 }, "<0.1")
      .from(".hero__title .w", { y: 46, opacity: 0, duration: 0.55, stagger: 0.06 }, "<")
      .from(".hero__sub", { y: 20, opacity: 0, duration: 0.45 }, "-=0.3")
      .from(".hero__cta .btn", { y: 16, opacity: 0, duration: 0.4, stagger: 0.08, clearProps: "all" }, "-=0.3");

    const wheels = qa(".hero__stage .cart__wheel");
    // cart rolls in from right with a slight settle
    tl.from(".cart", { x: 130, opacity: 0, duration: 0.85, ease: "expo.out", clearProps: "all" }, "-=0.75");
    if (wheels.length) tl.from(wheels, { rotation: -420, duration: 0.9, ease: "expo.out", clearProps: "all" }, "<");
    // hex badge scales in with a pop
    tl.fromTo(".hex",
      { scale: 0, rotation: -8, opacity: 0 },
      { scale: 1, rotation: 0, opacity: 1, duration: 0.5, ease: "back.out(1.4)", clearProps: "all" }, "-=0.35");
    // flanking cards fly in from their respective sides
    tl.from(".hero__card--left", { x: -60, opacity: 0, duration: 0.5, ease: "power3.out", clearProps: "all" }, "-=0.3");
    tl.from(".hero__card--right", { x: 60, opacity: 0, duration: 0.5, ease: "power3.out", clearProps: "all" }, "-=0.2");
    // receipt dangle drops in
    tl.from(".hero__receipt", { y: -30, opacity: 0, duration: 0.45, ease: "back.out(1.2)", clearProps: "all" }, "-=0.25");
  }
}
