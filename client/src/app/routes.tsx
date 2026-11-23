import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { GuestRoute, ProtectedRoute } from '@/components/routing/guards';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import NotFoundPage from '@/pages/NotFoundPage';
import { RouteError } from '@/components/routing/RouteError';
import { isStaleBuildError, reloadForNewVersion } from '@/lib/staleBuild';

/**
 * Pages inside the app are loaded only when first visited (code-splitting),
 * so the landing and login pages download fast.
 */
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => {
  try {
    return { Component: (await load()).default };
  } catch (err) {
    // This tab is running an old version whose files are gone after a deploy: reload once.
    if (isStaleBuildError(err) && reloadForNewVersion()) return new Promise<never>(() => {});
    throw err;
  }
};

export const router = createBrowserRouter([
  {
    // Any page that crashes shows a friendly screen instead of the developer one.
    errorElement: <RouteError />,
    children: [
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
      { path: '/unsubscribe', lazy: page(() => import('@/pages/UnsubscribePage')) },
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
              {
                path: '/jobs/:id/cover-letter',
                lazy: page(() => import('@/pages/CoverLetterPage')),
              },
              {
                path: '/jobs/:id/interview',
                lazy: page(() => import('@/pages/InterviewPrepPage')),
              },
              { path: '/prep', lazy: page(() => import('@/pages/PrepPage')) },
              { path: '/billing', lazy: page(() => import('@/pages/BillingPage')) },
              { path: '/settings', lazy: page(() => import('@/pages/SettingsPage')) },
              {
                path: '/billing/callback',
                lazy: page(() => import('@/pages/BillingCallbackPage')),
              },
              { path: '/applications', lazy: page(() => import('@/pages/ApplicationsPage')) },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
