'use client'

import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallbackLabel?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.fallbackLabel ? ` — ${this.props.fallbackLabel}` : ''}]`, error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center p-8 text-center gap-4 h-full min-h-[200px]"
          data-testid="error-boundary-fallback"
          role="alert"
        >
          <AlertCircle className="w-10 h-10 text-[var(--destructive)]" />
          <div>
            <h2 className="text-sm font-semibold mb-1">
              {this.props.fallbackLabel ? `${this.props.fallbackLabel} failed to load` : 'Something went wrong'}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] max-w-sm">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--muted)] text-xs font-medium hover:bg-[var(--primary)] hover:text-white transition-colors"
            data-testid="error-boundary-retry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
