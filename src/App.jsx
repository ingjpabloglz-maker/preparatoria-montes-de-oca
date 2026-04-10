import React from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { base44 } from '@/api/base44Client';
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { SoundProvider } from '@/contexts/SoundContext';
import Rewards from './pages/Rewards';
import SurpriseExam from './pages/SurpriseExam';
import Forum from './pages/Forum';
import ForumThread from './pages/ForumThread';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import InactivityWarningModal from '@/components/common/InactivityWarningModal';
import AuditDashboard from './pages/AuditDashboard';
import StudentRecord from './pages/StudentRecord';
import TeacherDashboard from './pages/TeacherDashboard';
import WelcomeGate from './pages/WelcomeGate';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();
  const { showWarning, updateActivity } = useInactivityLogout();
  const [level1Loading, setLevel1Loading] = React.useState(true);
  const [level1Unlocked, setLevel1Unlocked] = React.useState(false);

  const checkLevel1Access = React.useCallback(async () => {
    if (!user || user.role !== 'user') {
      setLevel1Unlocked(true);
      setLevel1Loading(false);
      return;
    }
    try {
      const payments = await base44.entities.Payment.filter({ user_email: user.email, level: 1, status: 'used' });
      setLevel1Unlocked(payments.length > 0);
    } catch (_) {
      setLevel1Unlocked(false);
    }
    setLevel1Loading(false);
  }, [user]);

  React.useEffect(() => {
    if (!isLoadingAuth && !isLoadingPublicSettings && user) {
      checkLevel1Access();
    } else if (!isLoadingAuth && !isLoadingPublicSettings && !user) {
      setLevel1Loading(false);
    }
  }, [isLoadingAuth, isLoadingPublicSettings, user, checkLevel1Access]);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth || level1Loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Bloqueo global para alumnos sin folio nivel 1
  if (user?.role === 'user' && !level1Unlocked) {
    return <WelcomeGate onValidated={() => { setLevel1Unlocked(true); }} />;
  }

  // Render the main app
  return (
    <>
    {showWarning && <InactivityWarningModal onStayActive={updateActivity} />}
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/Rewards" element={<LayoutWrapper currentPageName="Rewards"><Rewards /></LayoutWrapper>} />
      <Route path="/SurpriseExam" element={<LayoutWrapper currentPageName="SurpriseExam"><SurpriseExam /></LayoutWrapper>} />
      <Route path="/Forum" element={<LayoutWrapper currentPageName="Forum"><Forum /></LayoutWrapper>} />
      <Route path="/Forum/thread/:id" element={<LayoutWrapper currentPageName="ForumThread"><ForumThread /></LayoutWrapper>} />
      <Route path="/AuditDashboard" element={<LayoutWrapper currentPageName="AuditDashboard"><AuditDashboard /></LayoutWrapper>} />
      <Route path="/StudentRecord/:user_email" element={<LayoutWrapper currentPageName="StudentRecord"><StudentRecord /></LayoutWrapper>} />
      <Route path="/TeacherDashboard" element={<LayoutWrapper currentPageName="TeacherDashboard"><TeacherDashboard /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </>
  );
};


function App() {

  return (
    <AuthProvider>
      <SoundProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
          <SonnerToaster position="top-right" />
        </QueryClientProvider>
      </SoundProvider>
    </AuthProvider>
  )
}

export default App