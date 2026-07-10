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

/* ---- navigation: scrolled state + mobile drawer ---- */
function initNav() {
  const nav = document.getElementById("nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  const burger = document.querySelector(".nav__burger");
  const drawer = document.getElementById("nav-drawer");
  if (burger && drawer) {
    const setOpen = (open) => {
      drawer.toggleAttribute("hidden", !open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    burger.addEventListener("click", () => setOpen(drawer.hasAttribute("hidden")));
    drawer.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  }
}

/* ---- intro curtain ---- */
import { initIntro } from "./intro.js";
function boot() { initNav(); initIntro(); }
if (document.readyState !== "loading") boot();
else document.addEventListener("DOMContentLoaded", boot);
