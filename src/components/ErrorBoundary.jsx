import { Component } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, RotateCcw } from 'lucide-react'

// App-wide error boundary. Without one, a single render error anywhere unmounts
// the entire React root and React Router navigation can't rebuild it — the
// screen stays blank until a hard reload. This catches the error, shows a
// recoverable message, and (via the `resetKey` prop, wired to the current
// pathname) clears itself when the user navigates to another route — so
// "leaving and returning" recovers instead of staying blank.
class ErrorBoundaryInner extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Surface the real error in the console for debugging; the UI stays friendly.
    console.error('Unhandled render error:', error, info)
  }

  componentDidUpdate(prevProps) {
    // Navigating to a different route clears a stale error so the new page can
    // render normally.
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
          <AlertTriangle className="h-10 w-10 text-maroon" />
          <h1 className="mt-4 font-display text-2xl font-bold text-maroon">
            Something went wrong
          </h1>
          <p className="mt-2 max-w-md text-gray-600">
            This page hit an unexpected error. You can reload, or head back to the
            dashboard.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-maroon px-5 py-2.5 font-semibold text-white transition hover:bg-maroon-dark"
            >
              <RotateCcw className="h-4 w-4" /> Reload page
            </button>
            <a
              href="/dashboard"
              className="inline-flex rounded-lg border border-maroon px-5 py-2.5 font-semibold text-maroon transition hover:bg-maroon/5"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Functional wrapper so the class boundary can observe route changes (hooks
// aren't available in class components).
export default function ErrorBoundary({ children }) {
  const { pathname } = useLocation()
  return <ErrorBoundaryInner resetKey={pathname}>{children}</ErrorBoundaryInner>
}
