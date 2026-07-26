let audioContext: AudioContext | null = null;
let lastCollisionAt = 0;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const AudioContextClass = window.AudioContext;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
  return audioContext;
};

const playTone = (
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
  delay = 0
) => {
  const context = getAudioContext();
  if (!context) return;

  const startAt = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
};

export const playPlaceSound = () => {
  playTone(310, 0.06, 0.035, 'triangle');
  playTone(190, 0.09, 0.025, 'sine', 0.025);
};

export const playCollisionSound = (impactVelocity: number) => {
  const now = performance.now();
  if (now - lastCollisionAt < 45 || impactVelocity < 0.35) return;
  lastCollisionAt = now;

  const strength = Math.min(1, impactVelocity / 4);
  playTone(120 + strength * 90, 0.045 + strength * 0.04, 0.012 + strength * 0.025, 'triangle');
};

export const playCountdownSound = (finalTick = false) => {
  playTone(finalTick ? 660 : 440, finalTick ? 0.16 : 0.09, 0.04, 'square');
};

export const playSuccessSound = () => {
  playTone(440, 0.18, 0.04, 'triangle');
  playTone(554, 0.18, 0.04, 'triangle', 0.12);
  playTone(659, 0.3, 0.05, 'triangle', 0.24);
};

export const playFailureSound = () => {
  playTone(220, 0.2, 0.04, 'sawtooth');
  playTone(165, 0.35, 0.035, 'sawtooth', 0.14);
};
