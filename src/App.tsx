import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicLayout } from './components/PublicLayout';
import { AuthProvider } from './context/AuthContext';
import { WebsiteSettingsProvider } from './context/WebsiteSettingsContext';
import { AboutPage } from './pages/AboutPage';
import { AdminPage } from './pages/AdminPage';
import { ContactPage } from './pages/ContactPage';
import { DashboardPage } from './pages/DashboardPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { NoticesPage } from './pages/NoticesPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { ServicesPage } from './pages/ServicesPage';
import { TermsPage } from './pages/TermsPage';

export default function App() {
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  return (
    <ErrorBoundary>
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <AuthProvider>
        <WebsiteSettingsProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Website Routes */}
              <Route
                path="/"
                element={
                  <PublicLayout>
                    <HomePage />
                  </PublicLayout>
                }
              />
              <Route
                path="/about"
                element={
                  <PublicLayout>
                    <AboutPage />
                  </PublicLayout>
                }
              />
              <Route
                path="/services"
                element={
                  <PublicLayout>
                    <ServicesPage />
                  </PublicLayout>
                }
              />
              <Route
                path="/feedback"
                element={
                  <PublicLayout>
                    <FeedbackPage />
                  </PublicLayout>
                }
              />
              <Route
                path="/notices"
                element={
                  <PublicLayout>
                    <NoticesPage />
                  </PublicLayout>
                }
              />
              <Route
                path="/contact"
                element={
                  <PublicLayout>
                    <ContactPage />
                  </PublicLayout>
                }
              />
              <Route
                path="/privacy-policy"
                element={
                  <PublicLayout>
                    <PrivacyPolicyPage />
                  </PublicLayout>
                }
              />
              <Route
                path="/terms"
                element={
                  <PublicLayout>
                    <TermsPage />
                  </PublicLayout>
                }
              />

              {/* Official Login Portal */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Business Manager & Admin Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />

              {/* 404 Fallback */}
              <Route
                path="*"
                element={
                  <PublicLayout>
                    <NotFoundPage />
                  </PublicLayout>
                }
              />
            </Routes>
          </BrowserRouter>
        </WebsiteSettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
