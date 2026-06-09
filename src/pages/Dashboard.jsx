import React, { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load: cada rol solo descarga su bundle.
// Admins/docentes NUNCA descargan el bundle LMS estudiantil.
const StudentDashboard = React.lazy(() => import('@/components/dashboard/StudentDashboard'));
const AdminDashboardView = React.lazy(() => import('@/components/dashboard/AdminDashboardView'));

const LoadingSpinner = () => (
  <div className="min-h-screen bg-gray-50 p-6">
    <div className="max-w-7xl mx-auto space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}
      </div>
    </div>
  </div>
);

export default function Dashboard() {
  const { user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();

  // Mientras carga auth, mostrar spinner
  if (isLoadingAuth) {
    return <LoadingSpinner />;
  }

  // Redirect SPA para docentes (sin hard reload)
  if (user?.role === 'docente') {
    navigate('/app/TeacherDashboard', { replace: true });
    return null;
  }

  // Admin: montar SOLO el panel de admin (sin ningún hook LMS)
  if (user?.role === 'admin') {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <AdminDashboardView user={user} />
      </Suspense>
    );
  }

  // Estudiante (role === 'user'): montar el ecosistema LMS completo
  if (user?.role === 'user') {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <StudentDashboard user={user} />
      </Suspense>
    );
  }

  // Fallback: rol desconocido
  return <LoadingSpinner />;
}