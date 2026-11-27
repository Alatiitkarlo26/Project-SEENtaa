import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SystemDialogProvider } from './context/SystemDialogContext';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AuthPage from './pages/AuthPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import InventoryPage from './pages/InventoryPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AboutUsPage from './pages/AboutUsPage';
import PrivacyTermsPage from './pages/PrivacyTermsPage';
import NotFoundPage from './pages/NotFoundPage';
import { AppLoadingSkeleton } from './components/Skeleton';
import './App.css';

function MainContent() {
  const { role, isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('student-dashboard');
  const [policyInitialTab, setPolicyInitialTab] = useState('terms');

  // Navigation dispatcher
  const handleNavigate = (tab, subTab = 'terms') => {
    if (tab === 'privacy-terms') {
      setPolicyInitialTab(subTab);
    }
    setActiveTab(tab);
    if (tab === 'admin-dashboard') {
      window.history.replaceState(null, '', '/admin');
    } else if (tab === 'inventory') {
      window.history.replaceState(null, '', '#inventory');
    } else {
      window.history.replaceState(null, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Support direct route & hash navigation (e.g. /admin, #admin, #privacy, #terms, #inventory)
  useEffect(() => {
    const handleLocation = () => {
      const pathname = window.location.pathname.toLowerCase();
      const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      if (pathname.includes('/admin') || hash === 'admin' || hash === '/admin') {
        setActiveTab('admin-dashboard');
      } else if (pathname.includes('/inventory') || hash === 'inventory') {
        setActiveTab('inventory');
      } else if (hash === '404' || hash === 'not-found') {
        setActiveTab('not-found');
      } else if (hash === 'privacy' || hash === 'terms') {
        handleNavigate('privacy-terms', hash);
      } else if (hash === 'about' || hash === 'about-us') {
        setActiveTab('about-us');
      }
    };
    handleLocation();
    window.addEventListener('hashchange', handleLocation);
    window.addEventListener('popstate', handleLocation);
    return () => {
      window.removeEventListener('hashchange', handleLocation);
      window.removeEventListener('popstate', handleLocation);
    };
  }, []);

  if (loading) {
    return <AppLoadingSkeleton />;
  }

  // If user is not authenticated, render the centered AuthPage with smooth transitions
  if (!isAuthenticated) {
    const isAdminRoute = window.location.pathname.toLowerCase().includes('/admin') || window.location.hash.toLowerCase().includes('admin');
    return (
      <AuthPage
        defaultView="login"
        isAdminInitial={isAdminRoute}
        onAuthSuccess={(loggedUser) => {
          setActiveTab(loggedUser.role === 'admin' ? 'admin-dashboard' : 'student-dashboard');
          if (loggedUser.role === 'admin') {
            window.history.replaceState(null, '', '/admin');
          }
        }}
      />
    );
  }

  // When logged in, evaluate active tab with fallback to 404
  const knownTabs = ['student-dashboard', 'inventory', 'admin-dashboard', 'about-us', 'privacy-terms'];
  const currentTab = !knownTabs.includes(activeTab)
    ? 'not-found'
    : activeTab === 'about-us' || activeTab === 'privacy-terms' || activeTab === 'inventory'
    ? activeTab
    : role === 'admin'
    ? 'admin-dashboard'
    : activeTab;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-blue-600 selection:text-white transition-colors duration-200">
      <Navbar activeTab={currentTab} setActiveTab={handleNavigate} />

      <main className="flex-1">
        {currentTab === 'student-dashboard' && (
          <StudentDashboardPage onNavigateToTab={handleNavigate} />
        )}

        {currentTab === 'inventory' && (
          <InventoryPage onNavigateToTab={handleNavigate} />
        )}

        {currentTab === 'admin-dashboard' && (
          <AdminDashboardPage />
        )}

        {currentTab === 'about-us' && (
          <AboutUsPage
            onNavigateBack={() =>
              handleNavigate(role === 'admin' ? 'admin-dashboard' : 'student-dashboard')
            }
          />
        )}

        {currentTab === 'privacy-terms' && (
          <PrivacyTermsPage
            initialTab={policyInitialTab}
            onNavigateBack={() =>
              handleNavigate(role === 'admin' ? 'admin-dashboard' : 'student-dashboard')
            }
          />
        )}

        {currentTab === 'not-found' && (
          <NotFoundPage
            onNavigateHome={() =>
              handleNavigate(role === 'admin' ? 'admin-dashboard' : 'student-dashboard')
            }
            onNavigateToTab={handleNavigate}
          />
        )}
      </main>

      <Footer onNavigateToTab={handleNavigate} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <SystemDialogProvider>
            <MainContent />
          </SystemDialogProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
