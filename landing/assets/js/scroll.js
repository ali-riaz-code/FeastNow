// FeastNow landing — scroll-driven behavior: counters, section reveals, carousel.
// IMPORTANT: content is fully visible by default. Reveal/counter animations only
// run at the moment an element actually enters the viewport (IntersectionObserver);
// if JS or the observer never fires (headless render, hidden tab, no-JS), nothing
// is ever hidden. Never gate visibility on scroll position.
import { gsap, Swiper, prefersReducedMotion } from "./main.js";

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

/* ---- reusable scroll reveal (element is hidden only as the tween starts) ---- */
export function revealOnScroll(selector, vars = {}) {
  if (prefersReducedMotion || !gsap || !("IntersectionObserver" in window)) return;
  const from = { y: 26, opacity: 0, ...vars };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      gsap.fromTo(entry.target, { ...from },
        { y: 0, x: 0, opacity: 1, rotation: 0, duration: 0.65, ease: "expo.out", delay: (i % 4) * 0.09, clearProps: "all" });
    });
  }, { threshold: 0.15 });
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
      gsap.fromTo(".cuisines__swiper .ticket",
        { y: 40, opacity: 0, rotation: 4 },
        { y: 0, opacity: 1, rotation: 0, duration: 0.6, ease: "expo.out", stagger: 0.05, clearProps: "transform,opacity" });
    });
  }, { threshold: 0.2 });
  io.observe(wrap);
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

export function initScroll() {
  countUp();
  revealTickets();
  revealOnScroll("#how [data-reveal]", { y: 44, rotation: -2 });
  revealOnScroll("#partner [data-reveal]", { y: 34 });
  revealOnScroll("#riders [data-reveal]", { y: 34 });
  initCarousel();
}
