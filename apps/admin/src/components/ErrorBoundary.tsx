'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="bg-[#0b1526] border border-[#ef4444]/30 rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#ef4444]/10 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[#ef4444]">
              <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 6v5M10 14v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className="text-[#ef4444] font-semibold text-[15px] mb-2">Something went wrong</h3>
          <p className="text-[#8ba8c7] text-[13px] mb-5 max-w-[320px] mx-auto">
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 rounded-lg bg-[#102131] border border-[#1a2f48] text-[#f0f6ff] text-[13px] hover:bg-[#152840] hover:border-[#1f3855] transition-colors duration-100"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
