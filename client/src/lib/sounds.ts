/**
 * sounds.ts — Synthesized UI sound effects using the Web Audio API.
 *
 * All sounds are generated procedurally (no audio files) using OscillatorNode
 * and GainNode. Each sound function creates short-lived oscillators with
 * specific waveforms, frequency ramps, and gain envelopes:
 *
 *  - alertWarning:        Rising sine sweep (600→900 Hz, 0.25s)
 *  - alertCritical:       Two rapid square-wave bursts (800→1100 Hz)
 *  - newLedger:           Quick sine chirp (1200→1600 Hz, 0.15s)
 *  - connectionLost:      Descending sine tone (500→200 Hz, 0.5s)
 *  - connectionRestored:  Ascending C-E-G arpeggio (523→659→784 Hz)
 *
 * Sound preference is persisted in localStorage ("xrpl-sound-enabled").
 * The AudioContext is lazily created and auto-resumed if suspended
 * (browsers suspend until a user gesture has occurred).
 */

type SoundType = "alertWarning" | "alertCritical" | "newLedger" | "connectionLost" | "connectionRestored";

/** Lazy-initialized singleton AudioContext shared by all sound functions. */
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function isSoundEnabled(): boolean {
  return localStorage.getItem("xrpl-sound-enabled") !== "false";
}

function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem("xrpl-sound-enabled", enabled ? "true" : "false");
}

/** Rising sine sweep — used for non-critical alert notifications. */
function playAlertWarning(): void {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.25);
}

/** Two rapid square-wave bursts — urgent/critical alert sound. */
function playAlertCritical(): void {
  const ctx = getAudioContext();
  for (let i = 0; i < 2; i++) {
    const offset = i * 0.18;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(800, ctx.currentTime + offset);
    osc.frequency.linearRampToValueAtTime(1100, ctx.currentTime + offset + 0.1);
    gain.gain.setValueAtTime(0.12, ctx.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.15);
    osc.start(ctx.currentTime + offset);
    osc.stop(ctx.currentTime + offset + 0.15);
  }
}

/** Short high-pitched chirp — played when a new ledger is validated. */
function playNewLedger(): void {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

/** Descending tone — signals loss of WebSocket/node connection. */
function playConnectionLost(): void {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(500, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.4);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.5);
}

/** Ascending C-E-G arpeggio — positive feedback when connection is restored. */
function playConnectionRestored(): void {
  const ctx = getAudioContext();
  const notes = [523, 659, 784];
  notes.forEach((freq, i) => {
    const offset = i * 0.12;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime + offset);
    gain.gain.setValueAtTime(0.1, ctx.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
    osc.start(ctx.currentTime + offset);
    osc.stop(ctx.currentTime + offset + 0.2);
  });
}

const soundMap: Record<SoundType, () => void> = {
  alertWarning: playAlertWarning,
  alertCritical: playAlertCritical,
  newLedger: playNewLedger,
  connectionLost: playConnectionLost,
  connectionRestored: playConnectionRestored,
};

/** Entry point: plays the named sound if sounds are enabled and AudioContext is ready. */
function playSound(type: SoundType): void {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume().then(() => soundMap[type]());
    } else {
      soundMap[type]();
    }
  } catch {
    // silently fail
  }
}

export { playSound, isSoundEnabled, setSoundEnabled };
export type { SoundType };
