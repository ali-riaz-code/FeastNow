let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  const Ctor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call from any user gesture — browsers only allow sound after interaction. */
export function unlockChime(): void {
  ensureCtx();
}

/** Bright two-note ding (A5 → D6), ~0.7s. Best-effort: silent until unlocked. */
export function playChime(): void {
  try {
    const ac = ensureCtx();
    if (!ac || ac.state !== "running") return;
    const now = ac.currentTime;
    [880, 1174.66].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.35, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.5);
      osc.connect(gain).connect(ac.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.55);
    });
  } catch { /* sound is a garnish, never an error */ }
}
