let ctx: AudioContext | null = null

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Gentle two-tone chime for the focus timer — pulls the user back without startling them. */
export function playChime(): void {
  try {
    const audio = getContext()
    for (const [freq, at] of [[660, 0], [880, 0.22]] as const) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.connect(gain)
      gain.connect(audio.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, audio.currentTime + at)
      gain.gain.setValueAtTime(0, audio.currentTime + at)
      gain.gain.linearRampToValueAtTime(0.15, audio.currentTime + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + at + 0.5)
      osc.start(audio.currentTime + at)
      osc.stop(audio.currentTime + at + 0.55)
    }
  } catch {
    // silent without audio
  }
}

/** Short completion "boink" via WebAudio. Silent if the browser blocks AudioContext. */
export function playBoink(): void {
  try {
    const audio = getContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, audio.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, audio.currentTime + 0.12)
    gain.gain.setValueAtTime(0, audio.currentTime)
    gain.gain.linearRampToValueAtTime(0.22, audio.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18)
    osc.start()
    osc.stop(audio.currentTime + 0.2)
  } catch {
    // AudioContext unavailable — completion still works without sound
  }
}
