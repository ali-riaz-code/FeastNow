// FeastNow landing — scroll-driven behavior: stat counters, section reveals, carousel.
import { gsap, ScrollTrigger, Swiper, prefersReducedMotion } from "./main.js";

/* ---- animated stat counters ---- */
function countUp() {
  document.querySelectorAll(".stat__n").forEach((el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    if (prefersReducedMotion || !gsap || !ScrollTrigger) {
      el.textContent = target.toFixed(decimals);
      return;
    }
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target, duration: 1.4, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
      onUpdate: () => { el.textContent = obj.v.toFixed(decimals); },
    });
  });
}

/* ---- reusable scroll reveal (elements stay visible without JS/motion) ---- */
export function revealOnScroll(selector) {
  if (prefersReducedMotion || !gsap || !ScrollTrigger) return;
  document.querySelectorAll(selector).forEach((el, i) => {
    gsap.from(el, {
      y: 24, opacity: 0, duration: 0.6, ease: "power3.out",
      delay: (i % 4) * 0.08,
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  });
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
