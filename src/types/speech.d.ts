// Minimal Web Speech API typings (not in lib.dom for all TS versions).
interface SpeechRecognitionResultItem {
  transcript: string
}

interface SpeechRecognitionResultLike {
  isFinal: boolean
  [index: number]: SpeechRecognitionResultItem
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

interface SpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  start(): void
  stop(): void
}

interface Window {
  SpeechRecognition?: new () => SpeechRecognition
  webkitSpeechRecognition?: new () => SpeechRecognition
}
