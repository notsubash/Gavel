"use client";

import Link from "next/link";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            role="alert"
            className="mx-auto max-w-[1200px] px-4 py-16 md:px-6 lg:px-8"
          >
            <h1 className="font-serif text-[28px] font-semibold leading-tight text-ink">
              Something went wrong
            </h1>
            <p className="mt-4 max-w-prose text-ink-muted">
              The page hit an unexpected error. Refresh to try again, or head back home.
            </p>
            <Link
              href="/"
              className="mt-8 inline-flex min-h-11 items-center border-2 border-ink bg-heat px-6 py-2 font-sans text-sm font-semibold text-white shadow-hard transition-[transform,box-shadow] duration-150 hover:translate-x-px hover:translate-y-px hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-heat"
            >
              Back home
            </Link>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
