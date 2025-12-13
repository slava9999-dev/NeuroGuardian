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
    console.error('🔴 React Error Boundary caught:', error);
    console.error('🔴 Component Stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ 
          padding: '20px', 
          background: '#1a1a2e', 
          color: '#ff6b6b',
          minHeight: '100vh', 
          fontFamily: 'monospace'
        }}>
          <h1>⚠️ Arborius Guardian — System Error</h1>
          <pre style={{ 
            background: '#0d0d1a', 
            padding: '15px', 
            borderRadius: '8px', 
            overflow: 'auto', 
            fontSize: '12px'
          }}>
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.errorInfo?.componentStack}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#f59e0b',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🔄 Перезагрузить
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
