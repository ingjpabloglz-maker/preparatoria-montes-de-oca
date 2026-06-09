import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      // gcTime: tiempo que un query sin observers se mantiene en cache antes de ser eliminado.
      // 5 minutos es suficiente para SPA con navegación fluida; evita cache infinita.
      gcTime: 5 * 60 * 1000,
      // staleTime global: considera datos frescos por 30s para evitar refetches innecesarios.
      staleTime: 30 * 1000,
    },
  },
});