import { Mic, SendHorizontal, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useVoiceCapture } from '../state/useVoiceCapture'

interface Props {
  busy: boolean
  onSend: (text: string) => void
  onError: (message: string) => void
}

/** Speech-recognition languages offered for voice capture (BCP-47 tags). */
const MIC_LANGS: { value: string; label: string }[] = [
  { value: 'es-AR', label: 'ES' },
  { value: 'en-US', label: 'EN' },
  { value: 'pt-BR', label: 'PT' },
]

/** Persistent capture bar. `c` focuses it from anywhere (Ctrl+K belongs to the search overlay). */
export function CaptureBar({ busy, onSend, onError }: Props) {
  const [text, setText] = useState('')
  const [lang, setLang] = useState('es-AR')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { micState, start, stop } = useVoiceCapture({
    onText: setText,
    onError,
    lang,
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Plain `c`, no modifiers: `/` used to fill this role but suggested a slash-command grammar
      // that doesn't exist (typed text goes verbatim to the classifier), and Ctrl+K was dropped
      // here because the global search overlay owns that shortcut.
      const inField = (e.target as HTMLElement | null)?.closest('input, textarea, [role="dialog"]')
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey && !inField) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function submit() {
    if (micState === 'recording') {
      // finish the recording first, then send Whisper's final text (falls back to the live preview)
      stop(finalText => {
        const value = (finalText ?? inputRef.current?.value ?? '').trim()
        if (!value || busy) return
        setText('')
        onSend(value)
      })
      return
    }
    const value = inputRef.current?.value.trim() ?? ''
    if (!value || busy) return
    setText('')
    onSend(value)
  }

  function autoResize() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }

  return (
    <form
      className="shrink-0 border-t border-line bg-surface px-4 py-3"
      onSubmit={e => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="mx-auto flex max-w-2xl items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => {
            setText(e.target.value)
            autoResize()
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          placeholder='Capture anything — a task, an idea, something to delegate…  ("c" to focus)'
          spellCheck={false}
          className="max-h-36 min-h-9 flex-1 resize-none rounded-card border border-line bg-bg px-3.5 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:border-accent/60 focus:outline-none"
        />
        <select
          value={lang}
          onChange={e => setLang(e.target.value)}
          disabled={micState !== 'idle'}
          title="Voice input language"
          aria-label="Voice input language"
          className="h-9 shrink-0 rounded-card border border-line bg-bg px-1.5 font-mono text-[11px] text-ink-muted transition-colors hover:border-line-strong focus:border-accent/60 focus:outline-none disabled:opacity-50"
        >
          {MIC_LANGS.map(l => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => (micState === 'idle' ? start() : micState === 'recording' ? stop() : undefined)}
          disabled={micState === 'transcribing'}
          title={micState === 'recording' ? 'Stop recording' : 'Record voice'}
          aria-label={micState === 'recording' ? 'Stop recording' : 'Record voice'}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-card border transition-colors ${
            micState === 'recording'
              ? 'border-discard/60 bg-discard/15 text-discard'
              : micState === 'transcribing'
                ? 'border-line text-ink-faint'
                : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
          }`}
        >
          {micState === 'recording' ? <Square size={14} /> : <Mic size={15} className={micState === 'transcribing' ? 'animate-pulse' : ''} />}
        </button>
        <button
          type="submit"
          disabled={busy}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-accent text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <SendHorizontal size={15} />
        </button>
      </div>
    </form>
  )
}
