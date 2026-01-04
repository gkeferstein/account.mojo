'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: Daten gelten als "fresh" für 5 Minuten
            staleTime: 5 * 60 * 1000,
            // Cache time: Daten bleiben im Cache für 10 Minuten
            gcTime: 10 * 60 * 1000,
            // Retry: 1x bei Fehler
            retry: 1,
            // Refetch on window focus deaktivieren für bessere UX
            refetchOnWindowFocus: false,
            // Refetch on reconnect aktivieren
            refetchOnReconnect: true,
          },
          mutations: {
            // Retry: Keine Retries bei Mutations
            retry: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

