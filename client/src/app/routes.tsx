import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { GuestRoute, ProtectedRoute } from '@/components/routing/guards';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import NotFoundPage from '@/pages/NotFoundPage';

/**
 * Pages inside the app are loaded only when first visited (code-splitting),
 * so the landing and login pages download fast.
 */
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', lazy: page(() => import('@/pages/ForgotPasswordPage')) },
    ],
  },
  // Opened from email links: work whether or not someone is logged in.
  { path: '/verify-email', lazy: page(() => import('@/pages/VerifyEmailPage')) },
  { path: '/reset-password', lazy: page(() => import('@/pages/ResetPasswordPage')) },
  // Public legal pages (linked from Google's sign-in screen).
  { path: '/privacy', lazy: page(() => import('@/pages/PrivacyPage')) },
  { path: '/terms', lazy: page(() => import('@/pages/TermsPage')) },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', lazy: page(() => import('@/pages/DashboardPage')) },
          { path: '/cv', lazy: page(() => import('@/pages/CvAnalyzerPage')) },
          { path: '/cv/reports/:id', lazy: page(() => import('@/pages/AnalysisReportPage')) },
          { path: '/jobs', lazy: page(() => import('@/pages/JobMatchPage')) },
          { path: '/jobs/:id', lazy: page(() => import('@/pages/JobMatchReportPage')) },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
