import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="cs-min-h-screen cs-bg-gray-50 cs-flex cs-items-center cs-justify-center">
          <div className="cs-max-w-md cs-w-full cs-card cs-p-6">
            <div className="cs-empty-state">
              <div className="cs-mb-4">
                <div className="cs-w-16 cs-h-16 cs-bg-red-100 cs-rounded-full cs-flex cs-items-center cs-justify-center cs-mx-auto cs-mb-4">
                  <svg className="cs-w-8 cs-h-8 cs-text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className="cs-empty-state__title">Something went wrong</h2>
                <p className="cs-empty-state__description">An unexpected error occurred. Please try refreshing the page.</p>
              </div>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="cs-mt-4">
                  <summary className="cs-cursor-pointer cs-text-sm cs-font-medium cs-text-gray-700">
                    Error Details
                  </summary>
                  <pre className="cs-mt-2 cs-text-xs cs-text-red-600 cs-bg-red-50 cs-p-2 cs-rounded cs-overflow-auto">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
              
              <div className="cs-flex cs-justify-center cs-mt-6">
                <button
                  onClick={() => window.location.reload()}
                  className="cs-button cs-button--primary"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}