const melodies = {
  start: [330, 392],
  arrival: [440, 523],
  success: [523, 659, 784],
  failure: [330, 262],
} as const;
type Cue = keyof typeof melodies;

export function createPickupSound() {
  let audio: AudioContext | undefined;
  let enabled = true;
  let disposed = false;
  let unlocking = false;
  let pendingCue: Cue | undefined;
  const active = new Set<OscillatorNode>();

  function note(context: AudioContext, frequency: number, start: number, level: number) {
    const source = context.createOscillator();
    const envelope = context.createGain();
    source.type = 'sine';
    source.frequency.value = frequency;
    envelope.gain.setValueAtTime(.001, start);
    envelope.gain.exponentialRampToValueAtTime(level, start + .012);
    envelope.gain.exponentialRampToValueAtTime(.001, start + .15);
    source.connect(envelope).connect(context.destination);
    source.onended = () => {
      active.delete(source);
      source.disconnect();
      envelope.disconnect();
    };
    active.add(source);
    source.start(start);
    source.stop(start + .16);
  }

  function silence() {
    pendingCue = undefined;
    for (const source of active) {
      source.disconnect();
      source.stop();
    }
    active.clear();
  }

  function cue(kind: Cue) {
    const context = audio;
    if (!enabled || disposed || !context) return;
    if (context.state === 'running') {
      const start = context.currentTime;
      melodies[kind].forEach((frequency, i) => note(context, frequency, start + i * .10, .035));
    } else if (unlocking) {
      pendingCue = kind;
    }
  }

  return {
    enable() {
      if (!enabled || disposed) return;
      try {
        audio ??= new AudioContext();
        if (audio.state !== 'running' && audio.state !== 'closed' && !unlocking) {
          unlocking = true;
          void audio.resume().then(() => {
            unlocking = false;
            const waiting = pendingCue;
            pendingCue = undefined;
            if (waiting) cue(waiting);
          }, () => { unlocking = false; pendingCue = undefined; });
        }
      } catch {
        unlocking = false;
      }
    },
    setEnabled(value: boolean) {
      enabled = value;
      if (!enabled) silence();
    },
    cue,
    play(count: number) {
      if (enabled && !disposed && audio?.state === 'running') {
        note(audio, 560 * Math.pow(2, ((count - 1) % 5) / 12), audio.currentTime, .055);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      silence();
      if (audio && audio.state !== 'closed') void audio.close().catch(() => undefined);
    },
  };
}
