// FeastNow landing — entry module: motion bootstrap + global wiring.
// Vendor libs are loaded as classic scripts before this module, exposing
// window.gsap / window.ScrollTrigger / window.Lenis / window.Swiper.

export const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const gsap = window.gsap;
export const ScrollTrigger = window.ScrollTrigger;
export const Swiper = window.Swiper;

if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

/* ---- Lenis smooth scroll (skipped under reduced motion) ---- */
export let lenis = null;
if (!prefersReducedMotion && window.Lenis) {
  lenis = new window.Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  });
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  if (ScrollTrigger) lenis.on("scroll", ScrollTrigger.update);
}

/* ---- smooth in-page anchor scrolling (works with or without Lenis) ---- */
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute("href");
  if (id.length < 2) return;
  const el = document.querySelector(id);
  if (!el) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(el, { offset: -72 });
  else el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
});

console.info("FeastNow landing booted. reduced-motion:", prefersReducedMotion);

/* ---- intro curtain ---- */
import { initIntro } from "./intro.js";
if (document.readyState !== "loading") initIntro();
else document.addEventListener("DOMContentLoaded", initIntro);
