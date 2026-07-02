import { useCallback, useRef, useState } from 'react'
import { transcribe } from '../lib/api'

export type MicState = 'idle' | 'recording' | 'transcribing'

interface Options {
  /** Live preview while speaking (Web Speech API) and the final Whisper pass both land here. */
  onText: (text: string) => void
  onError: (message: string) => void
}

/** Voice capture: MediaRecorder feeds /api/transcribe (Whisper); Web Speech gives a live es-AR preview. */
export function useVoiceCapture({ onText, onError }: Options) {
  const [micState, setMicState] = useState<MicState>('idle')
  const recorder = useRef<MediaRecorder | null>(null)
  const recognition = useRef<SpeechRecognition | null>(null)
  const chunks = useRef<Blob[]>([])
  const pendingSend = useRef<((finalText?: string) => void) | null>(null)

  /** `thenSend` receives Whisper's final text directly — reading the input DOM here would race React's re-render. */
  const stop = useCallback((thenSend?: (finalText?: string) => void) => {
    if (thenSend) pendingSend.current = thenSend
    recognition.current?.stop()
    recognition.current = null
    recorder.current?.stop()
  }, [])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunks.current = []
      const rec = new MediaRecorder(stream)
      recorder.current = rec
      rec.ondataavailable = e => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setMicState('transcribing')
        let finalText: string | undefined
        try {
          const blob = new Blob(chunks.current, { type: 'audio/webm' })
          const { text } = await transcribe(blob)
          if (text?.trim()) {
            finalText = text.trim()
            onText(finalText)
          }
        } catch (err) {
          onError('Transcription failed: ' + (err instanceof Error ? err.message : String(err)))
        } finally {
          setMicState('idle')
          const send = pendingSend.current
          pendingSend.current = null
          send?.(finalText)
        }
      }
      rec.start()

      const SpeechRecognitionImpl = window.SpeechRecognition ?? window.webkitSpeechRecognition
      if (SpeechRecognitionImpl) {
        const sr = new SpeechRecognitionImpl()
        recognition.current = sr
        sr.continuous = true
        sr.interimResults = true
        sr.lang = 'es-AR'
        let finalText = ''
        sr.onresult = e => {
          let interim = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) finalText += e.results[i][0].transcript
            else interim += e.results[i][0].transcript
          }
          onText(finalText + interim)
        }
        sr.start()
      }

      setMicState('recording')
    } catch {
      onError('Could not access microphone.')
    }
  }, [onText, onError])

  return { micState, start, stop }
}
