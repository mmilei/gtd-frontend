import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Top-level safety net — no single component (e.g. a decorative WebGL failure) should white-screen the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in component tree:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-black text-stone-300">
          <p>Something went wrong.</p>
          <button
            className="rounded border border-stone-600 px-3 py-1 text-sm hover:bg-stone-800"
            onClick={() => location.reload()}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
