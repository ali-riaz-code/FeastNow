// FeastNow landing — entry module: motion bootstrap + global wiring.
// Vendor libs are loaded as classic scripts before this module, exposing
// window.gsap / window.ScrollTrigger / window.Lenis / window.Swiper.

export const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const gsap = window.gsap;
export const ScrollTrigger = window.ScrollTrigger;
export const Swiper = window.Swiper;

if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

/* ---- Lenis smooth scroll (skipped under reduced motion) ----
   Driven from GSAP's ticker (one clock for scroll + tweens) and with native
   CSS smooth-scrolling disabled via html.lenis-on — running both at once is
   what caused the glitchy, double-eased scrolling. */
export let lenis = null;
if (!prefersReducedMotion && window.Lenis && gsap) {
  document.documentElement.classList.add("lenis-on");
  lenis = new window.Lenis({
    duration: 0.8,                               // was 1.15 — page felt laggy behind the wheel
    easing: (t) => 1 - Math.pow(1 - t, 4),       // ease-out-quart: settles sooner than expo
    smoothWheel: true,
    wheelMultiplier: 1.3,                        // more page-travel per wheel notch
  });
  if (ScrollTrigger) lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
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
  if (lenis) lenis.scrollTo(el, { offset: -76 });
  else el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
});

/* ---- navigation: scrolled state + mobile drawer ---- */
function initNav() {
  const nav = document.getElementById("nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    if (lenis) lenis.on("scroll", onScroll);
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

/* ---- intro curtain + scroll behavior ---- */
import { initIntro } from "./intro.js";
import { initScroll } from "./scroll.js";
function boot() { initNav(); initIntro(); initScroll(); }
if (document.readyState !== "loading") boot();
else document.addEventListener("DOMContentLoaded", boot);
