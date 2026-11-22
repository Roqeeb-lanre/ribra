import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from '@/app/routes';
import { refreshSession } from '@/lib/api';

export default function App() {
  // When the app opens, use the refresh cookie (if any) to log the user back in silently.
  useEffect(() => {
    void refreshSession();
  }, []);

  return <RouterProvider router={router} />;
}
