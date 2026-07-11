// FeastNow landing — scroll-driven behavior, ported from the reference site's
// motion system (pizza-amici.nl): three layers working together.
//   1. Scrub choreography — elements ride the scrollbar (envelopes fly in and
//      settle scattered, the partner stamp rotates across its section).
//   2. Parallax drifts — small position offsets on decorative elements
//      (hero cards, hexagon badge, script kickers), locomotive-scroll style.
//   3. One-shot pops — back.out entrances with rotation scatter, plus the
//      nav that hides scrolling down and returns scrolling up.
// IMPORTANT: content is fully visible by default. Opacity-gated reveals only
// run at the moment an element actually enters the viewport (IntersectionObserver);
// if JS or the observer never fires (headless render, hidden tab, no-JS), nothing
// is ever hidden. Scrub tweens move things but never hide them.
import { gsap, ScrollTrigger, Swiper, prefersReducedMotion } from "./main.js";

/* ---- animated counters (any [data-count]) ---- */
function countUp() {
  const els = document.querySelectorAll("[data-count]");
  // Ensure final values are correct with no animation available.
  const setFinal = (el) => {
    el.textContent = parseFloat(el.dataset.count).toFixed(parseInt(el.dataset.decimals || "0", 10));
  };
  if (prefersReducedMotion || !gsap || !("IntersectionObserver" in window)) {
    els.forEach(setFinal);
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      const el = entry.target;
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || "0", 10);
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target, duration: 1.4, ease: "power2.out",
        onUpdate: () => { el.textContent = obj.v.toFixed(decimals); },
      });
    });
  }, { threshold: 0.4 });
  els.forEach((el) => { setFinal(el); io.observe(el); }); // visible final value until animated
}

/* ---- one-shot entrance pop (element is hidden only as the tween starts) ----
   Relative from-offsets ("+=40") return each element to its own resting CSS
   transform (scattered ticket tilts, card rotations) with no snap at the end. */
export function revealOnScroll(selector, from = {}, opts = {}) {
  if (prefersReducedMotion || !gsap || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      gsap.from(entry.target, {
        y: "+=34", opacity: 0, ...from,
        duration: opts.duration ?? 0.7,
        ease: opts.ease ?? "back.out(1.4)",
        delay: (i % 4) * (opts.stagger ?? 0.09),
        clearProps: "all",
      });
    });
  }, { threshold: 0, rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll(selector).forEach((el) => io.observe(el));
}

/* ---- staggered ticket fan-in for the cuisine carousel ---- */
function revealTickets() {
  if (prefersReducedMotion || !gsap || !("IntersectionObserver" in window)) return;
  const wrap = document.querySelector(".cuisines__swiper");
  if (!wrap) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      gsap.from(".cuisines__swiper .ticket", {
        y: "+=46", rotation: "+=5", opacity: 0,
        duration: 0.65, ease: "back.out(1.6)", stagger: 0.05,
        clearProps: "transform,opacity",
      });
    });
  }, { threshold: 0, rootMargin: "0px 0px -10% 0px" });
  io.observe(wrap);
}

/* ---- nav hides scrolling down, returns scrolling up (reference pattern) ---- */
function navHideShow() {
  const nav = document.getElementById("nav");
  if (!nav || !ScrollTrigger) return;
  let dir = 0;
  ScrollTrigger.create({
    start: "top top",
    end: 999999,
    onUpdate: (self) => {
      if (self.direction === dir) return;
      // never hide the nav while the mobile drawer is open
      const burger = nav.querySelector(".nav__burger");
      if (burger && burger.getAttribute("aria-expanded") === "true") return;
      dir = self.direction;
      gsap.to(nav, {
        y: dir === 1 && self.scroll() > 140 ? -130 : 0,
        duration: 0.4, ease: "power2.inOut", overwrite: true,
      });
    },
  });
}

/* ---- scrub layer: elements ride the scrollbar (never opacity-gated) ---- */
function scrubChoreography(wide) {
  // hero decorations drift away at their own rates as the stage scrolls out
  const heroStage = document.querySelector(".hero__stage");
  if (heroStage) {
    const drift = (sel, y, extra = {}) => {
      if (!document.querySelector(sel)) return;
      gsap.to(sel, {
        y, ease: "none", ...extra,
        scrollTrigger: { trigger: heroStage, start: "top 65%", end: "bottom top", scrub: 1 },
      });
    };
    drift(".hero__card--left", -52);
    drift(".hero__card--right", -36);
    drift(".hex", -26);
  }

  // script kickers hand-drift upward through their section (locomotive style)
  document.querySelectorAll("section .kicker").forEach((k) => {
    const section = k.closest("section");
    if (!section) return;
    gsap.fromTo(k, { y: 22 }, {
      y: -22, ease: "none",
      scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: 1 },
    });
  });

  // envelopes fly in from the right and settle scattered (the reference's
  // signature steps move) — desktop only, mobile gets the one-shot pop instead
  if (wide) {
    const envs = gsap.utils.toArray(".how__steps .env");
    const settle = [-1.6, 1.2, -1, 1.8];
    envs.forEach((env, i) => {
      gsap.fromTo(env,
        { xPercent: 26 + (envs.length - i) * 20, rotation: 12 },
        {
          xPercent: 0, rotation: settle[i % settle.length], ease: "power2.out",
          scrollTrigger: { trigger: "#how", start: "top 85%", end: "center 45%", scrub: 1 },
        });
    });
  }

  // partner stamp rolls as the section passes (the reference's rotating pizza)
  if (document.querySelector(".partner__stamp")) {
    gsap.fromTo(".partner__stamp", { rotation: 14 }, {
      rotation: -9, ease: "none",
      scrollTrigger: { trigger: "#partner", start: "top bottom", end: "bottom top", scrub: true },
    });
  }

  // the scooter drives in from the left as the riders section arrives
  if (document.querySelector(".scooter")) {
    gsap.fromTo(".scooter", { x: -72 }, {
      x: 0, ease: "power1.out",
      scrollTrigger: { trigger: "#riders", start: "top 92%", end: "top 35%", scrub: 1 },
    });
  }

  // footer wordmark rises into place
  if (document.querySelector(".footer__mega")) {
    gsap.fromTo(".footer__mega", { yPercent: 26 }, {
      yPercent: 0, ease: "none",
      scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: 1 },
    });
  }
}

/* ---- explore-by-cuisine carousel: momentum swipe, satisfying drag ---- */
function initCarousel() {
  if (!Swiper || !document.querySelector(".cuisines__swiper")) return;
  new Swiper(".cuisines__swiper", {
    slidesPerView: "auto",
    spaceBetween: 18,
    grabCursor: true,
    freeMode: { enabled: true, momentum: true, momentumRatio: 0.8, momentumVelocityRatio: 0.9 },
    navigation: { nextEl: ".ctrl--next", prevEl: ".ctrl--prev", disabledClass: "is-disabled" },
    pagination: { el: ".cuisines__pagination", clickable: true, dynamicBullets: true, dynamicMainBullets: 5 },
    a11y: { enabled: true },
  });
}

/* ---- hero depth parallax: mouse-tracked 3D tilt (Direction 2) ----
   The hero stage and its children tilt subtly in response to cursor position,
   creating a diorama depth effect. The cart stays the anchor while cards and
   hex badge drift at different rates. Desktop only; touch/mobile skip. */
function heroDepthParallax() {
  if (prefersReducedMotion || !gsap || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const hero = document.querySelector(".hero");
  const stage = document.querySelector(".hero__stage");
  const cart = document.querySelector(".hero__stage .cart");
  const left = document.querySelector(".hero__card--left");
  const right = document.querySelector(".hero__card--right");
  const hex = document.querySelector(".hex");
  if (!hero || !stage) return;

  // quick setters — one rAF-friendly function per target property
  const tiltX = gsap.quickSetter(stage, "rotateX", "deg");
  const tiltY = gsap.quickSetter(stage, "rotateY", "deg");
  const lift = gsap.quickSetter(stage, "y", "px");

  const cartX = gsap.quickSetter(cart, "x", "px");
  const leftX = gsap.quickSetter(left, "x", "px");
  const leftY = gsap.quickSetter(left, "y", "px");
  const leftR = gsap.quickSetter(left, "rotate", "deg");
  const rightX = gsap.quickSetter(right, "x", "px");
  const hexY = gsap.quickSetter(hex, "y", "px");
  const hexR = gsap.quickSetter(hex, "rotate", "deg");

  const bounds = { w: 0, h: 0, cx: 0.5, cy: 0.5 };
  const state = { x: 0.5, y: 0.5, toX: 0.5, toY: 0.5 };

  const onResize = () => {
    const r = hero.getBoundingClientRect();
    bounds.w = r.width;
    bounds.h = r.height;
  };

  const onMove = (e) => {
    state.toX = (e.clientX - hero.getBoundingClientRect().left) / bounds.w;
    state.toY = (e.clientY - hero.getBoundingClientRect().top) / bounds.h;
  };

  const onLeave = () => { state.toX = 0.5; state.toY = 0.5; };

  onResize();
  window.addEventListener("resize", onResize, { passive: true });
  hero.addEventListener("pointermove", onMove, { passive: true });
  hero.addEventListener("pointerleave", onLeave, { passive: true });

  // lerp loop — spring-like follow instead of snap
  gsap.ticker.add(() => {
    state.x += (state.toX - state.x) * 0.08;
    state.y += (state.toY - state.y) * 0.08;

    const nx = state.x - 0.5; // -0.5 .. 0.5
    const ny = state.y - 0.5;

    // stage tilt: gentle 3D rotation
    tiltY(nx * 5);
    tiltX(-ny * 4);
    lift(-Math.abs(nx * ny) * 4);

    // cart shifts slightly opposite the stage tilt (parallax depth)
    if (cart) cartX(nx * -6);

    // left card drifts more — it's in the "foreground"
    if (left) {
      leftX(nx * -14);
      leftY(ny * -8);
      leftR(nx * -3);
    }
    // right card also in foreground, opposite drift
    if (right) rightX(nx * 12);
    // hex badge lags behind (background)
    if (hex) { hexY(ny * 3); hexR(nx * 1.5); }
  });
}

export function initScroll() {
  countUp();
  initCarousel();
  heroDepthParallax();
  if (prefersReducedMotion || !gsap || !ScrollTrigger) return;

  const wide = window.matchMedia("(min-width: 992px)").matches;

  navHideShow();
  scrubChoreography(wide);

  // one-shot pops (back.out family, rotation scatter on card-like elements)
  revealTickets();
  revealOnScroll(".cuisines__head", { y: "+=30" });
  revealOnScroll(".how__head", { y: "+=30" });
  revealOnScroll(".how__phone", { y: "+=40", rotation: "+=3" }, { ease: "back.out(1.7)" });
  if (!wide) revealOnScroll("#how [data-reveal]", { y: "+=44", rotation: "+=4" }, { ease: "back.out(1.7)" });
  revealOnScroll(".reviews__head", { y: "+=30" });
  revealOnScroll(".reviews__marquee", { y: "+=20" });
  revealOnScroll("#partner [data-reveal]", { y: "+=36", rotation: "+=2" }, { ease: "back.out(1.5)" });
  revealOnScroll("#riders [data-reveal]", { y: "+=36" });
  revealOnScroll(".footer__top", { y: "+=26" });
}
