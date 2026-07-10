// FeastNow landing — entry module (placeholder; motion bootstrap lands in Task 2)
export const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
console.info("FeastNow landing booted. reduced-motion:", prefersReducedMotion);
