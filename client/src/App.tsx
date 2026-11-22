import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { router } from '@/app/routes';
import { refreshSession } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';

export default function App() {
  // When the app opens, use the refresh cookie (if any) to log the user back in silently.
  useEffect(() => {
    void refreshSession();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
