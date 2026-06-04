import React from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { base44 } from '@/api/base44Client';
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useParams } from 'react-router-dom';
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
import ManageActivities from './pages/ManageActivities';
import FinalExamOnline from './pages/FinalExamOnline';
import Subject from './pages/Subject';
import LegalPage from './pages/LegalPage';

// Páginas públicas y autenticación
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ProtectedRoute from './components/ProtectedRoute';

// Redirige preservando query string: /Subject?id=abc → /app/Subject?id=abc
const LegacyQueryRedirect = ({ to }) => {
  const location = useLocation();
  console.log('[LegacyQueryRedirect]', location.pathname, location.search, '→', to + location.search);
  return <Navigate to={`${to}${location.search}`} replace />;
};

// Traduce /Subject/:id → /app/Subject?id=:id
const SubjectParamRedirect = () => {
  const { id } = useParams();
  console.log('[SubjectParamRedirect] /Subject/:id →', `/app/Subject?id=${id}`);
  return <Navigate to={`/app/Subject?id=${id}`} replace />;
};

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, user } = useAuth();
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

  if (isLoadingPublicSettings || isLoadingAuth || level1Loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (user?.role === 'user' && !level1Unlocked) {
    return <WelcomeGate onValidated={() => { setLevel1Unlocked(true); }} />;
  }

  return (
    <>
      {showWarning && <InactivityWarningModal onStayActive={updateActivity} />}
      <Routes>
        {/* Redirección por defecto: /app → /app/Dashboard */}
        <Route path="/" element={<Navigate to="Dashboard" replace />} />

        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={path}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}
        <Route path="Rewards" element={<LayoutWrapper currentPageName="Rewards"><Rewards /></LayoutWrapper>} />
        <Route path="SurpriseExam" element={<LayoutWrapper currentPageName="SurpriseExam"><SurpriseExam /></LayoutWrapper>} />
        <Route path="Forum" element={<LayoutWrapper currentPageName="Forum"><Forum /></LayoutWrapper>} />
        <Route path="Forum/thread/:id" element={<LayoutWrapper currentPageName="ForumThread"><ForumThread /></LayoutWrapper>} />
        <Route path="AuditDashboard" element={<LayoutWrapper currentPageName="AuditDashboard"><AuditDashboard /></LayoutWrapper>} />
        <Route path="StudentRecord/:user_email" element={<LayoutWrapper currentPageName="StudentRecord"><StudentRecord /></LayoutWrapper>} />
        <Route path="TeacherDashboard" element={<LayoutWrapper currentPageName="TeacherDashboard"><TeacherDashboard /></LayoutWrapper>} />
        <Route path="ManageActivities" element={<LayoutWrapper currentPageName="ManageActivities"><ManageActivities /></LayoutWrapper>} />
        <Route path="FinalExamOnline" element={<FinalExamOnline />} />
        <Route path="Subject/:id" element={<LayoutWrapper currentPageName="Subject"><Subject /></LayoutWrapper>} />
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
            <Routes>
              {/* === RUTAS COMPLETAMENTE PÚBLICAS === */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/privacy-policy" element={<LegalPage />} />
              <Route path="/terms" element={<LegalPage />} />
              <Route path="/legal" element={<LegalPage />} />

              {/* === RUTAS PRIVADAS DEL LMS bajo /app/* === */}
              <Route
                path="/app/*"
                element={
                  <ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />}>
                    <AuthenticatedApp />
                  </ProtectedRoute>
                }
              />

              {/* === REDIRECCIONES LEGACY: rutas antiguas conocidas del LMS === */}
              <Route path="/Dashboard" element={<Navigate to="/app/Dashboard" replace />} />
              <Route path="/Rewards" element={<Navigate to="/app/Rewards" replace />} />
              <Route path="/Forum" element={<Navigate to="/app/Forum" replace />} />
              <Route path="/Forum/thread/:id" element={<Navigate to="/app/Forum" replace />} />
              <Route path="/SurpriseExam" element={<Navigate to="/app/SurpriseExam" replace />} />
              <Route path="/AuditDashboard" element={<Navigate to="/app/AuditDashboard" replace />} />
              <Route path="/TeacherDashboard" element={<Navigate to="/app/TeacherDashboard" replace />} />
              <Route path="/ManageActivities" element={<Navigate to="/app/ManageActivities" replace />} />
              <Route path="/FinalExamOnline" element={<Navigate to="/app/FinalExamOnline" replace />} />
              <Route path="/Subject" element={<LegacyQueryRedirect to="/app/Subject" />} />
              <Route path="/Subject/:id" element={<SubjectParamRedirect />} />
              <Route path="/StudentRecord/:user_email" element={<Navigate to="/app/StudentRecord/:user_email" replace />} />
              <Route path="/AdminDashboard" element={<Navigate to="/app/AdminDashboard" replace />} />
              <Route path="/ManageFolios" element={<Navigate to="/app/ManageFolios" replace />} />
              <Route path="/ManageStudents" element={<Navigate to="/app/ManageStudents" replace />} />
              <Route path="/ManageAdmins" element={<Navigate to="/app/ManageAdmins" replace />} />
              <Route path="/ManageSubjects" element={<Navigate to="/app/ManageSubjects" replace />} />
              <Route path="/StudentDetail" element={<Navigate to="/app/StudentDetail" replace />} />
              <Route path="/StudentStatistics" element={<Navigate to="/app/StudentStatistics" replace />} />
              <Route path="/Profile" element={<Navigate to="/app/Profile" replace />} />
              <Route path="/CourseMap" element={<Navigate to="/app/CourseMap" replace />} />
              <Route path="/Lesson" element={<Navigate to="/app/Lesson" replace />} />
              <Route path="/Level" element={<Navigate to="/app/Level" replace />} />
              <Route path="/UnlockLevel" element={<Navigate to="/app/UnlockLevel" replace />} />

              {/* 404 para todo lo demás */}
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </Router>
          <Toaster />
          <SonnerToaster position="top-right" />
        </QueryClientProvider>
      </SoundProvider>
    </AuthProvider>
  )
}

export default App;