/**
 * Shared TanStack Query client defaults for Dynaxis Studio.
 */

import { QueryClient } from '@tanstack/react-query';
import { normalizePlatformClientError, shouldRollbackOptimisticUpdate } from './errors.js';

/**
 * @param {import('@tanstack/react-query').QueryClientConfig} [overrides]
 */
export function createDynaxisQueryClient(overrides = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry(failureCount, error) {
          const normalized = normalizePlatformClientError(error);
          if (!normalized.shouldRetry) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
        onError(error, _variables, context) {
          if (shouldRollbackOptimisticUpdate(error) && context?.rollback) {
            context.rollback();
          }
        },
      },
    },
    ...overrides,
  });
}

let defaultClient;

/**
 * Singleton used by Studio shell until WP-7C-19 introduces explicit provider wiring.
 */
export function getDynaxisQueryClient() {
  if (!defaultClient) {
    defaultClient = createDynaxisQueryClient();
  }
  return defaultClient;
}

export function setDynaxisQueryClient(client) {
  defaultClient = client;
}
