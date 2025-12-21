import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Structured error logging
    console.error('🔴 [ErrorBoundary] Uncaught error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });

    this.setState({ errorInfo });

    // Try to send error to Telegram (if user is authenticated)
    this.reportError(error, errorInfo);
  }

  async reportError(error: Error, errorInfo: ErrorInfo) {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.initData) {
        // Log error details for debugging
        console.log('📤 Error could be reported to backend:', {
          error: error.message,
          stack: errorInfo.componentStack?.slice(0, 500),
        });
      }
    } catch {
      // Ignore reporting errors
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{
              padding: '24px',
              background: 'linear-gradient(180deg, #1c1917 0%, #0c0a09 100%)',
              color: '#fafaf9',
              minHeight: '100vh',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            {/* Error Icon */}
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
                boxShadow: '0 10px 40px rgba(239, 68, 68, 0.3)',
              }}
            >
              <span style={{ fontSize: '40px' }}>⚠️</span>
            </div>

            <h1
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                marginBottom: '12px',
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              NeuroGUARDIAN
            </h1>

            <p
              style={{
                fontSize: '16px',
                color: '#a8a29e',
                marginBottom: '24px',
                maxWidth: '300px',
              }}
            >
              Произошла непредвиденная ошибка. Мы уже работаем над её исправлением.
            </p>

            {/* Error details (collapsible) */}
            <details
              style={{
                width: '100%',
                maxWidth: '400px',
                marginBottom: '24px',
                textAlign: 'left',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  color: '#78716c',
                  fontSize: '14px',
                  marginBottom: '8px',
                }}
              >
                Подробности ошибки
              </summary>
              <pre
                style={{
                  background: '#1c1917',
                  padding: '16px',
                  borderRadius: '12px',
                  overflow: 'auto',
                  fontSize: '11px',
                  color: '#f87171',
                  border: '1px solid #292524',
                  maxHeight: '150px',
                }}
              >
                {this.state.error?.message}
              </pre>
            </details>

            {/* Action Buttons */}
            <div
              style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}
            >
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '14px 28px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  color: '#1c1917',
                  boxShadow: '0 4px 20px rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                🔄 Перезагрузить
              </button>

              <a
                href="https://t.me/Vyacheslav_Neuro"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '14px 28px',
                  background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  color: '#fff',
                  textDecoration: 'none',
                  boxShadow: '0 4px 20px rgba(14, 165, 233, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                💬 Поддержка
              </a>
            </div>

            <p
              style={{
                fontSize: '12px',
                color: '#57534e',
                marginTop: '32px',
              }}
            >
              v2.0.0 • Margin Defense System
            </p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
