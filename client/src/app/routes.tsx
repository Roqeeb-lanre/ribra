import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { GuestRoute, ProtectedRoute } from '@/components/routing/guards';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import CvAnalyzerPage from '@/pages/CvAnalyzerPage';
import AnalysisReportPage from '@/pages/AnalysisReportPage';
import NotFoundPage from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/cv', element: <CvAnalyzerPage /> },
          { path: '/cv/reports/:id', element: <AnalysisReportPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
