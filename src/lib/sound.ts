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

/**
 * Muffled descending "thunk" for dismiss/discard — deliberately duller and lower than the
 * completion boink so the two actions never sound alike. Silent if AudioContext is blocked.
 */
export function playThunk(): void {
  try {
    const audio = getContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    const filter = audio.createBiquadFilter()
    // A low-pass takes the edge off the triangle wave, giving the "apagado" (muffled) character.
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(600, audio.currentTime)
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(audio.destination)
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(300, audio.currentTime)
    osc.frequency.exponentialRampToValueAtTime(110, audio.currentTime + 0.16)
    gain.gain.setValueAtTime(0, audio.currentTime)
    gain.gain.linearRampToValueAtTime(0.16, audio.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.22)
    osc.start()
    osc.stop(audio.currentTime + 0.24)
  } catch {
    // AudioContext unavailable — dismiss still works without sound
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
