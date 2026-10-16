import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/** Last line of defence: a rendering bug shows a message and a reload button instead of a blank page. */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: "var(--c-bg)" }}>
        <h1 className="text-2xl" style={{ fontFamily: "var(--f-serif)", color: "var(--c-gold-bright)" }}>
          Something went wrong
        </h1>
        <p className="max-w-sm text-sm" style={{ color: "var(--c-text-soft)" }}>
          The board hit an unexpected error. Reloading usually fixes it — your game will start fresh.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
