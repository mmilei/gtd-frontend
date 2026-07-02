let ctx: AudioContext | null = null

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
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
