// FeastNow landing — intro curtain roll-up.
import { gsap, ScrollTrigger, prefersReducedMotion } from "./main.js";

export function initIntro() {
  const intro = document.getElementById("intro");
  const done = () => {
    intro?.remove();
    document.body.classList.remove("intro-active");
    if (ScrollTrigger) ScrollTrigger.refresh();
  };

  // Reduced motion, no GSAP, or missing overlay: skip straight to the page.
  if (!intro || prefersReducedMotion || !gsap) { done(); return; }

  const logo = intro.querySelector(".intro__logo");
  const tl = gsap.timeline({ defaults: { ease: "expo.out" }, onComplete: done });
  tl.from(logo, { y: 26, opacity: 0, duration: 0.6 })
    .to(intro, { yPercent: -100, duration: 0.85, delay: 0.7 })   // hold, then curtain up
    .from("main", { y: 22, opacity: 0, duration: 0.6 }, "<0.15"); // page settles in
}
