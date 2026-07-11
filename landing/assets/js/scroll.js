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

/* ---- hero cart: continuous wheel spin + steam billow (GSAP, smoother
       than CSS animation, and pauses when scrolled past) ---- */
function heroCartMotion() {
  if (prefersReducedMotion || !gsap) return;
  const wheels = document.querySelectorAll(".cart__wheel");
  if (wheels.length) {
    gsap.to(wheels, {
      rotation: 360, duration: 4, ease: "none", repeat: -1,
      transformOrigin: "50% 50%",
    });
  }
  const steamPaths = document.querySelectorAll(".cart__steam path");
  if (steamPaths.length) {
    steamPaths.forEach((p, i) => {
      gsap.to(p, {
        y: -16, scale: 1.7, opacity: 0,
        duration: 2.6 + i * 0.4, ease: "power1.out", repeat: -1,
        delay: i * 1.3,
        transformOrigin: "50% 100%",
      });
    });
  }
}

export function initScroll() {
  countUp();
  initCarousel();
  heroCartMotion();
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
