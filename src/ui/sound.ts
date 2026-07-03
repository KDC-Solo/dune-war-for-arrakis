// Tiny self-made WebAudio cues (no audio assets): a soft tick when an action applies and a short
// arpeggio at game end. Kept very quiet; toggleable from the header and persisted per browser.

const KEY = 'dwfa.sound';

let enabled = (() => {
  try {
    return (localStorage.getItem(KEY) ?? 'on') === 'on';
  } catch {
    return true;
  }
})();

export const soundEnabled = (): boolean => enabled;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(at: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

export type Cue = 'apply' | 'win';

/** Play a cue (no-op when sound is off or WebAudio is unavailable). */
export function play(cue: Cue): void {
  if (!enabled) return;
  if (cue === 'apply') {
    tone(0, 740, 0.06, 0.05, 'triangle');
    tone(0.045, 1100, 0.05, 0.035, 'triangle');
  } else {
    // win: a short rising arpeggio
    [523, 659, 784, 1046].forEach((f, i) => tone(i * 0.11, f, 0.22, 0.06, 'triangle'));
  }
}
