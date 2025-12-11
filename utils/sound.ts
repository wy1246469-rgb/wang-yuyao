// Simple Web Audio API synthesizer for sound effects

let audioCtx: AudioContext | null = null;
let movementOsc: OscillatorNode | null = null;
let movementGain: GainNode | null = null;
let movementFilter: BiquadFilterNode | null = null;

const getCtx = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
};

export const resumeAudio = () => {
  const ctx = getCtx();
  if (ctx.state === 'suspended') {
    ctx.resume().catch((err) => console.error(err));
  }
};

export const playFaceChangeSound = () => {
  const ctx = getCtx();
  resumeAudio();
  
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  // High pitched 'ding'
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
  
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start();
  osc.stop(t + 0.3);
};

export const playDropSound = () => {
  const ctx = getCtx();
  resumeAudio();
  
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  // Bubbly 'pop'
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.linearRampToValueAtTime(50, t + 0.15);
  
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.linearRampToValueAtTime(0.001, t + 0.15);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start();
  osc.stop(t + 0.15);
};

export const playFartSound = () => {
  const ctx = getCtx();
  resumeAudio();

  const t = ctx.currentTime;
  const duration = 0.2 + Math.random() * 0.4; // 0.2s - 0.6s

  // Master Gain
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  masterGain.gain.setValueAtTime(0, t);
  masterGain.gain.linearRampToValueAtTime(0.8, t + 0.05); // Attack
  masterGain.gain.exponentialRampToValueAtTime(0.01, t + duration); // Decay

  // Carrier Oscillator (The main tone) - Sawtooth gives it the buzz
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  const startFreq = 150 + Math.random() * 100; // Lower base frequency
  const endFreq = 40 + Math.random() * 20;
  osc.frequency.setValueAtTime(startFreq, t);
  osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);

  // Modulator Oscillator (FM Synthesis)
  // This modulates the frequency of the carrier to create the "fluttering" texture
  const modOsc = ctx.createOscillator();
  modOsc.type = 'square';
  // Fast modulation for that "ripping" sound
  modOsc.frequency.setValueAtTime(20 + Math.random() * 30, t); 
  
  const modGain = ctx.createGain();
  // How much the pitch wobbles (Modulation Depth)
  modGain.gain.setValueAtTime(30 + Math.random() * 20, t); 
  
  modOsc.connect(modGain);
  modGain.connect(osc.frequency); // Connect modulator to carrier frequency

  // Lowpass Filter to muffle it (butt cheeks act as a low pass filter)
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, t);
  filter.Q.value = 1;

  osc.connect(filter);
  filter.connect(masterGain);

  osc.start(t);
  modOsc.start(t);
  
  osc.stop(t + duration);
  modOsc.stop(t + duration);
  
  // Clean up nodes after playing
  setTimeout(() => {
    masterGain.disconnect();
  }, (duration + 0.2) * 1000);
};

export const updateMovementSound = (speed: number) => {
  const ctx = getCtx();
  // We do not auto-resume here to prevent autoplay policy errors if no interaction yet.
  if (ctx.state === 'suspended') return;

  if (!movementOsc) {
    movementOsc = ctx.createOscillator();
    movementGain = ctx.createGain();
    movementFilter = ctx.createBiquadFilter();
    
    // Wind-like noise approximation using sawtooth + lowpass
    movementOsc.type = 'sawtooth';
    movementOsc.frequency.value = 60; // Base rumble
    
    movementFilter.type = 'lowpass';
    movementFilter.Q.value = 1;
    
    movementGain.gain.value = 0;
    
    movementOsc.connect(movementFilter);
    movementFilter.connect(movementGain);
    movementGain.connect(ctx.destination);
    
    movementOsc.start();
  }

  if (movementGain && movementFilter) {
    // Speed is pixels per frame approx.
    // Threshold to start sound
    const threshold = 10;
    const normalizedSpeed = Math.max(0, speed - threshold) / 50; 
    const targetVolume = Math.min(normalizedSpeed * 0.1, 0.1); // Max volume 0.1
    
    // Smooth volume changes
    movementGain.gain.setTargetAtTime(targetVolume, ctx.currentTime, 0.1);
    
    // Modulate filter cutoff with speed for "whoosh"
    const targetFreq = 100 + (normalizedSpeed * 800);
    movementFilter.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.1);
  }
};

export const stopMovementSound = () => {
  if (movementOsc) {
    try {
      movementOsc.stop();
      movementOsc.disconnect();
    } catch(e) {}
    movementOsc = null;
  }
  if (movementGain) {
    movementGain.disconnect();
    movementGain = null;
  }
  if (movementFilter) {
    movementFilter.disconnect();
    movementFilter = null;
  }
};