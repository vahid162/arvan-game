export function createPickupSound() {
  let audio: AudioContext | undefined;

  return {
    enable() {
      try {
        audio ??= new AudioContext();
        if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
      } catch {
        // The collection flash and counter also work when sound is unavailable.
      }
    },
    play(count: number) {
      if (audio?.state !== 'running') return;
      const now = audio.currentTime;
      const note = audio.createOscillator();
      const envelope = audio.createGain();
      note.type = 'sine';
      note.frequency.value = 560 * Math.pow(2, ((count - 1) % 5) / 12);
      envelope.gain.setValueAtTime(.001, now);
      envelope.gain.exponentialRampToValueAtTime(.07, now + .012);
      envelope.gain.exponentialRampToValueAtTime(.001, now + .15);
      note.connect(envelope).connect(audio.destination);
      note.start();
      note.stop(now + .16);
    },
    dispose() {
      if (audio) void audio.close().catch(() => undefined);
    },
  };
}
