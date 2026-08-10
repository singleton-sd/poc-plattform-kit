import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Decorator } from '@storybook/nextjs';
import { useState } from 'react';

function StoryProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/**
 * Supplies the deterministic, in-memory application context used by stories.
 *
 * Authentication bootstrap is deliberately omitted: it configures the live API
 * client and can start an Entra redirect. Data-backed stories must define their
 * own local handlers rather than relying on an Azure environment.
 */
export const withAppProviders: Decorator = (Story, context) => {
  return (
    <StoryProviders key={context.id}>
      <Story />
    </StoryProviders>
  );
};
