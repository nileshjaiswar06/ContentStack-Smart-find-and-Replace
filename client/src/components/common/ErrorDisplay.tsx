import React from 'react';

interface ErrorDisplayProps {
  error: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className = ''
}) => {
  if (!error) return null;

  return (
    <div className={className}>
      <div className="cs-notification cs-notification--error">
        <div className="cs-flex cs-items-start">
          <div className="cs-flex-shrink-0">
            <svg className="cs-w-5 cs-h-5 cs-text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="cs-ml-3 cs-flex-1">
            <h3 className="cs-text-sm cs-font-medium cs-text-red-800">
              Error
            </h3>
            <p className="cs-mt-1 cs-text-sm cs-text-red-700">
              {error}
            </p>
            <div className="cs-mt-3 cs-flex cs-space-x-3">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="cs-text-sm cs-font-medium cs-text-red-800 hover:cs-text-red-900 cs-underline"
                >
                  Try again
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="cs-text-sm cs-font-medium cs-text-red-800 hover:cs-text-red-900 cs-underline"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};