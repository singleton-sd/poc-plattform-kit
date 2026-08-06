'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { configureApiClient } from '@/lib/api-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    configureApiClient();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
