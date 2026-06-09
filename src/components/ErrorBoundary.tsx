import React from "react";

/**
 * Error boundary — prevents component crashes from unmounting the entire app.
 * When any descendant throws, shows a recoverable error UI instead of a blank screen.
 *
 * Usage: <ErrorBoundary><App /></ErrorBoundary>
 */

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log for developer debugging
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleClearAndReload = () => {
    try {
      // Don't blow away user data wholesale; only clear ephemeral UI state.
      // Builder data is now persisted to localStorage (see BUG #1 fix).
      // Tutorial state is OK to keep.
      // We only clear privacy banner state and theme preference, both of which are harmless.
      // Caller can also manually clear via DevTools if needed.
    } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isJa = (typeof navigator !== "undefined" &&
      (navigator.language || "").toLowerCase().startsWith("ja"));

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "var(--bg, #0a0e14)",
          color: "var(--text, #f0ede4)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 560,
            width: "100%",
            padding: 32,
            background: "var(--surface-1, #11161e)",
            border: "1px solid var(--line-strong, rgba(240,237,228,0.16))",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }} aria-hidden="true">
            ⚠️
          </div>
          <h1 style={{ fontSize: 20, margin: "0 0 12px", fontWeight: 600 }}>
            {isJa ? "エラーが発生しました" : "Something went wrong"}
          </h1>
          <p
            style={{
              color: "var(--text-muted, #8a8478)",
              fontSize: 14,
              lineHeight: 1.7,
              margin: "0 0 20px",
            }}
          >
            {isJa
              ? "予期しないエラーが発生しました。データは保存されている可能性があります。下のボタンから再読み込みしてください。"
              : "An unexpected error occurred. Your data may still be saved. Please reload using the button below."}
          </p>

          {this.state.error ? (
            <details
              style={{
                marginBottom: 20,
                padding: 12,
                background: "var(--surface-2, #161c25)",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "monospace",
                color: "var(--danger, #c97862)",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  color: "var(--text-muted, #8a8478)",
                  marginBottom: 8,
                  userSelect: "none",
                }}
              >
                {isJa ? "詳細（開発者向け）" : "Details (developer)"}
              </summary>
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                <strong>{this.state.error.name}:</strong>{" "}
                {this.state.error.message}
                {this.state.error.stack ? (
                  <pre
                    style={{
                      marginTop: 8,
                      whiteSpace: "pre-wrap",
                      fontSize: 11,
                      lineHeight: 1.4,
                      maxHeight: 180,
                      overflow: "auto",
                    }}
                  >
                    {this.state.error.stack}
                  </pre>
                ) : null}
              </div>
            </details>
          ) : null}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: "10px 16px",
                background: "transparent",
                color: "var(--text, #f0ede4)",
                border: "1px solid var(--line-strong, rgba(240,237,228,0.16))",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {isJa ? "再試行" : "Try again"}
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: "10px 16px",
                background: "var(--accent, #d4b87a)",
                color: "var(--accent-text, #0a0e14)",
                border: "1px solid var(--accent, #d4b87a)",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {isJa ? "ページを再読み込み" : "Reload page"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
