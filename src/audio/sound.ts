type MistakeReason = "self" | "wrong";

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function createGameAudio() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let musicBus: GainNode | null = null;
  let sfxBus: GainNode | null = null;
  let started = false;
  let schedulerId: number | null = null;
  let nextNoteTime = 0;
  let step = 0;

  const bpm = 112;
  const stepDur = (60 / bpm) / 2; // 8th-note
  const scheduleAhead = 0.2;
  const scheduleIntervalMs = 40;
  const progression = [
    [0, 3, 7, 10], // Cm7
    [8, 12, 15, 19], // AbMaj7
    [5, 8, 12, 15], // Fm7
    [7, 10, 14, 17], // Gm7
  ];
  const arpPattern = [0, 1, 2, 1, 3, 2, 1, 2];
  const bassPattern = [0, 0, 0, 0, 2, 2, 1, 1];

  function ensureGraph(): boolean {
    if (ctx && master && musicBus && sfxBus) return true;
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;

    ctx = new Ctx();
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -26;
    comp.knee.value = 18;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;

    musicBus.gain.value = 0.42;
    sfxBus.gain.value = 0.7;
    master.gain.value = 0.68;

    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);
    return true;
  }

  function tone(params: {
    freq: number;
    type?: OscillatorType;
    start: number;
    dur: number;
    gain: number;
    attack?: number;
    release?: number;
    target?: "music" | "sfx";
    detune?: number;
    endFreq?: number;
    filterHz?: number;
  }) {
    if (!ctx || !musicBus || !sfxBus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = params.type ?? "triangle";
    osc.frequency.setValueAtTime(params.freq, params.start);
    if (typeof params.endFreq === "number") osc.frequency.exponentialRampToValueAtTime(Math.max(30, params.endFreq), params.start + params.dur);
    if (typeof params.detune === "number") osc.detune.value = params.detune;

    filter.type = "lowpass";
    filter.frequency.value = params.filterHz ?? 3000;
    filter.Q.value = 0.6;

    const attack = params.attack ?? 0.01;
    const release = params.release ?? Math.max(0.03, params.dur * 0.7);
    g.gain.setValueAtTime(0.0001, params.start);
    g.gain.linearRampToValueAtTime(params.gain, params.start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, params.start + release);

    osc.connect(filter);
    filter.connect(g);
    g.connect(params.target === "music" ? musicBus : sfxBus);

    osc.start(params.start);
    osc.stop(params.start + params.dur);
  }

  function noise(params: { start: number; dur: number; gain: number; target?: "music" | "sfx"; filterHz?: number }) {
    if (!ctx || !musicBus || !sfxBus) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * params.dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) ch[i] = (Math.random() * 2 - 1) * 0.7;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = params.filterHz ?? 1200;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, params.start);
    g.gain.linearRampToValueAtTime(params.gain, params.start + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, params.start + params.dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(params.target === "music" ? musicBus : sfxBus);
    src.start(params.start);
    src.stop(params.start + params.dur);
  }

  function scheduleMusicStep(t: number, i: number) {
    const bar = Math.floor(i / 16);
    const chord = progression[bar % progression.length];
    const rootMidi = 48 + chord[0];
    const arpNote = chord[arpPattern[i % arpPattern.length] % chord.length];
    const bassOff = bassPattern[i % bassPattern.length];

    if (i % 4 === 0) {
      tone({ freq: 110, endFreq: 48, type: "sine", start: t, dur: 0.16, gain: 0.18, target: "music", filterHz: 340 });
      noise({ start: t, dur: 0.05, gain: 0.035, target: "music", filterHz: 1800 });
    }

    if (i % 2 === 0) {
      tone({
        freq: midiToFreq(rootMidi + bassOff),
        type: "sawtooth",
        start: t,
        dur: 0.22,
        gain: 0.055,
        target: "music",
        attack: 0.004,
        release: 0.2,
        filterHz: 520,
      });
    }

    tone({
      freq: midiToFreq(60 + arpNote),
      type: i % 2 === 0 ? "triangle" : "square",
      start: t,
      dur: 0.16,
      gain: 0.045,
      target: "music",
      attack: 0.005,
      release: 0.14,
      filterHz: 2600,
    });

    if (i % 8 === 0) {
      const p1 = midiToFreq(55 + chord[0]);
      const p2 = midiToFreq(55 + chord[2]);
      tone({ freq: p1, type: "triangle", start: t, dur: stepDur * 7.6, gain: 0.022, target: "music", attack: 0.06, release: stepDur * 7.3, filterHz: 1200 });
      tone({ freq: p2, type: "triangle", start: t, dur: stepDur * 7.6, gain: 0.018, target: "music", attack: 0.06, release: stepDur * 7.3, filterHz: 1100 });
    }
  }

  function scheduleMusic() {
    if (!ctx || ctx.state !== "running") return;
    while (nextNoteTime < ctx.currentTime + scheduleAhead) {
      scheduleMusicStep(nextNoteTime, step);
      nextNoteTime += stepDur;
      step += 1;
    }
  }

  function startScheduler() {
    if (!ctx || schedulerId !== null) return;
    nextNoteTime = ctx.currentTime + 0.03;
    step = 0;
    schedulerId = window.setInterval(scheduleMusic, scheduleIntervalMs);
  }

  function stopScheduler() {
    if (schedulerId !== null) {
      window.clearInterval(schedulerId);
      schedulerId = null;
    }
  }

  async function ensureStarted() {
    if (!ensureGraph() || !ctx || !master) return;
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }
    if (!started) {
      started = true;
      startScheduler();
      const t = ctx.currentTime;
      tone({ freq: midiToFreq(60), type: "triangle", start: t, dur: 0.14, gain: 0.08, target: "sfx" });
      tone({ freq: midiToFreq(67), type: "triangle", start: t + 0.08, dur: 0.14, gain: 0.06, target: "sfx" });
    }
  }

  async function onMove(speedMul = 1) {
    await ensureStarted();
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = clamp(470 + speedMul * 30, 430, 560);
    tone({ freq: base, endFreq: base * 0.9, type: "square", start: t, dur: 0.03, gain: 0.018, target: "sfx", filterHz: 3200 });
  }

  async function onCorrect(combo: number) {
    await ensureStarted();
    if (!ctx) return;
    const t = ctx.currentTime;
    const n = clamp(combo, 1, 8);
    tone({ freq: midiToFreq(67 + (n % 3) * 2), type: "triangle", start: t, dur: 0.12, gain: 0.095, target: "sfx" });
    tone({ freq: midiToFreq(74 + (n % 4)), type: "sine", start: t + 0.06, dur: 0.16, gain: 0.072, target: "sfx" });
    noise({ start: t, dur: 0.045, gain: 0.02, target: "sfx", filterHz: 3400 });
  }

  async function onMistake(reason: MistakeReason) {
    await ensureStarted();
    if (!ctx) return;
    const t = ctx.currentTime;
    const startFreq = reason === "self" ? 210 : 260;
    tone({ freq: startFreq, endFreq: 90, type: "sawtooth", start: t, dur: 0.24, gain: 0.11, target: "sfx", filterHz: 900 });
    noise({ start: t + 0.02, dur: 0.08, gain: 0.032, target: "sfx", filterHz: 980 });
  }

  async function onToolPickup() {
    await ensureStarted();
    if (!ctx) return;
    const t = ctx.currentTime;
    tone({ freq: midiToFreq(72), type: "square", start: t, dur: 0.08, gain: 0.08, target: "sfx" });
    tone({ freq: midiToFreq(79), type: "triangle", start: t + 0.05, dur: 0.1, gain: 0.075, target: "sfx" });
    tone({ freq: midiToFreq(84), type: "sine", start: t + 0.11, dur: 0.12, gain: 0.06, target: "sfx" });
  }

  async function onStageStart(stageIndex: number) {
    await ensureStarted();
    if (!ctx) return;
    const t = ctx.currentTime;
    const root = 60 + (stageIndex % 5);
    tone({ freq: midiToFreq(root), type: "triangle", start: t, dur: 0.14, gain: 0.09, target: "sfx" });
    tone({ freq: midiToFreq(root + 7), type: "triangle", start: t + 0.1, dur: 0.16, gain: 0.075, target: "sfx" });
  }

  async function onStageComplete() {
    await ensureStarted();
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = [72, 76, 79, 84];
    for (let i = 0; i < notes.length; i += 1) {
      tone({ freq: midiToFreq(notes[i]), type: i % 2 === 0 ? "square" : "triangle", start: t + i * 0.07, dur: 0.18, gain: 0.09 - i * 0.01, target: "sfx" });
    }
  }

  async function onPause(paused: boolean) {
    await ensureStarted();
    if (!ctx || !musicBus) return;

    if (paused) {
      stopScheduler();
      if (ctx.state === "running") {
        try {
          await ctx.suspend();
        } catch {
          // ignore
        }
      }
      return;
    }

    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }
    startScheduler();
    const t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(0.42, t + 0.12);
  }

  function teardown() {
    stopScheduler();
    if (ctx) {
      ctx.close().catch(() => {
        // ignore
      });
    }
    ctx = null;
    master = null;
    musicBus = null;
    sfxBus = null;
    started = false;
  }

  return {
    ensureStarted,
    onMove,
    onCorrect,
    onMistake,
    onToolPickup,
    onStageStart,
    onStageComplete,
    onPause,
    teardown,
  };
}
