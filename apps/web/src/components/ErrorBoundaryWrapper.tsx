'use client';

/**
 * Client Component Wrapper for ErrorBoundary
 * Required because ErrorBoundary must be a Client Component
 */

import { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  children: ReactNode;
}

export function ErrorBoundaryWrapper({ children }: Props) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}

