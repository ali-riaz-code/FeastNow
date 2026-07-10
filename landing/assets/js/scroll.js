// FeastNow landing — scroll-driven behavior: stat counters, section reveals, carousel.
// IMPORTANT: content is fully visible by default. Reveal/counter animations only
// run at the moment an element actually enters the viewport (IntersectionObserver);
// if JS or the observer never fires (headless render, hidden tab, no-JS), nothing
// is ever hidden. Never gate visibility on scroll position.
import { gsap, Swiper, prefersReducedMotion } from "./main.js";

/* ---- animated stat counters ---- */
function countUp() {
  const els = document.querySelectorAll(".stat__n");
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
export function revealOnScroll(selector) {
  if (prefersReducedMotion || !gsap || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      gsap.fromTo(entry.target,
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power3.out", delay: (i % 4) * 0.08, clearProps: "all" });
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(selector).forEach((el) => io.observe(el));
}

/* ---- explore-by-cuisine carousel ---- */
function initCarousel() {
  if (!Swiper || !document.querySelector(".explore__swiper")) return;
  new Swiper(".explore__swiper", {
    slidesPerView: "auto",
    spaceBetween: 16,
    grabCursor: true,
    navigation: { nextEl: ".explore__btn--next", prevEl: ".explore__btn--prev", disabledClass: "is-disabled" },
    pagination: { el: ".explore__pagination", clickable: true },
    a11y: { enabled: true },
  });
}

export function initScroll() {
  countUp();
  revealOnScroll("#how [data-reveal]");
  revealOnScroll("#reviews [data-reveal]");
  initCarousel();
}
