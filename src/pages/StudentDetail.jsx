import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, User, Mail, CheckCircle2, XCircle, Trash2,
  RefreshCw, FileText, Loader2, GraduationCap,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import AdminGuard from '../components/auth/AdminGuard';
import ReportCard from '../components/student/ReportCard';
import StudentInfoCard from '../components/student/StudentInfoCard';
import PaymentHistoryTab from '../components/student/PaymentHistoryTab';
import ReportCardExportModal from '../components/student/ReportCardExportModal';
import ProfileForm from '../components/profile/ProfileForm';
import { format } from "date-fns";
import { es } from "date-fns/locale";

const formatName = (u) => {
  const parts = [u.apellido_paterno, u.apellido_materno, u.nombres].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (u.full_name || 'Sin nombre');
};

// ── Tab: Materias ─────────────────────────────────────────────────────────────
function MateriasTab({ studentEmail, subjects }) {
  const queryClient = useQueryClient();
  const [recalcLoading, setRecalcLoading] = useState(false);

  const { data: progressData = [] } = useQuery({
    queryKey: ['studentProgress', studentEmail],
    queryFn: () => base44.entities.UserProgress.filter({ user_email: studentEmail }),
    enabled: !!studentEmail,
    staleTime: 0,
    gcTime: 3 * 60 * 1000,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const { data: subjectProgress = [], isLoading } = useQuery({
    queryKey: ['studentSubjectProgress', studentEmail],
    queryFn: () => base44.entities.SubjectProgress.filter({ user_email: studentEmail }),
    enabled: !!studentEmail,
    staleTime: 0,
    gcTime: 3 * 60 * 1000,
    refetchOnMount: true,
    refetchOnReconnect: true,
  });

  const progress = progressData[0];
  const currentLevel = progress?.current_level || 1;
  const levelSubjects = subjects.filter(s => s.level === currentLevel);

  const computedProgress = (() => {
    if (levelSubjects.length === 0) return 0;
    const total = levelSubjects.reduce((acc, subj) => {
      const sp = subjectProgress.find(p => p.subject_id === subj.id);
      return acc + (sp?.progress_percent || 0);
    }, 0);
    return Math.round(total / levelSubjects.length);
  })();

  const handleRecalculate = async () => {
    setRecalcLoading(true);
    try {
      await base44.functions.invoke('recalculateSubjectProgress', {});
      await queryClient.invalidateQueries({ queryKey: ['admin-student-detail', studentEmail] });
      await queryClient.invalidateQueries({ queryKey: ['studentSubjectProgress', studentEmail] });
      toast.success('Progreso recalculado y sincronizado');
      // Audit log
      base44.auth.me().then(admin => {
        if (admin) {
          base44.entities.UserReport.create({
            reported_user_email: studentEmail,
            reported_by: admin.email,
            reported_by_role: 'admin',
            reason: 'ADMIN_RECALCULATED_PROGRESS',
            description: JSON.stringify({ admin_email: admin.email, student_email: studentEmail, timestamp: new Date().toISOString() }),
            status: 'reviewed',
          }).catch(() => {});
        }
      });
    } catch (err) {
      toast.error(`Error al recalcular: ${err.message}`);
    } finally {
      setRecalcLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Progreso del nivel actual */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              Nivel Actual:
              <Badge className="bg-blue-100 text-blue-800 text-base border-0">Nivel {currentLevel}</Badge>
              <span className="text-sm font-normal text-gray-500">— {computedProgress}% completado</span>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculate}
              disabled={recalcLoading}
            >
              {recalcLoading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Recalculando...</>
                : <><RefreshCw className="w-4 h-4 mr-2" />Recalcular / Sincronizar</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={computedProgress} className="h-3 mb-5" />
          <p className="text-sm font-semibold text-gray-700 mb-3">Materias del Nivel {currentLevel}:</p>
          {levelSubjects.length === 0 ? (
            <p className="text-sm text-gray-400">No hay materias configuradas para este nivel.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {levelSubjects.map((subj) => {
                const sp = subjectProgress.find(p => p.subject_id === subj.id);
                const passed = sp?.test_passed;
                const inProgress = sp && !passed && (sp.progress_percent > 0 || sp.test_attempts > 0);
                return (
                  <div
                    key={subj.id}
                    className={`flex items-center gap-3 rounded-lg p-3 border ${
                      passed ? 'bg-green-50 border-green-200' :
                      inProgress ? 'bg-blue-50 border-blue-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {passed
                      ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      : <XCircle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{subj.name}</p>
                      {passed
                        ? <p className="text-xs text-green-600">Aprobada — {sp.final_grade}%</p>
                        : inProgress
                          ? <p className="text-xs text-blue-600">En progreso — {sp.progress_percent || 0}%</p>
                          : <p className="text-xs text-gray-400">Sin iniciar</p>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pruebas por materia */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle>Resultados de Pruebas por Materia</CardTitle></CardHeader>
        <CardContent>
          {subjectProgress.filter(sp => sp.test_attempts > 0).length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Materia</TableHead>
                  <TableHead>Intentos</TableHead>
                  <TableHead>Calificación</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjectProgress.filter(sp => sp.test_attempts > 0).map((sp) => {
                  const subject = subjects.find(s => s.id === sp.subject_id);
                  return (
                    <TableRow key={sp.id}>
                      <TableCell className="font-medium">{subject?.name || sp.subject_id}</TableCell>
                      <TableCell>{sp.test_attempts}/3</TableCell>
                      <TableCell className="font-semibold">{sp.final_grade != null ? `${sp.final_grade}%` : '—'}</TableCell>
                      <TableCell>
                        {sp.test_passed
                          ? <Badge className="bg-green-100 text-green-800 border-0"><CheckCircle2 className="w-3 h-3 mr-1" />Aprobada</Badge>
                          : <Badge className="bg-red-100 text-red-800 border-0"><XCircle className="w-3 h-3 mr-1" />No Aprobada</Badge>
                        }
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-gray-400 py-8">Sin pruebas realizadas</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab: Boletas ──────────────────────────────────────────────────────────────
function BoletasTab({ studentEmail, studentName, currentLevel, adminEmail, subjects, subjectProgress }) {
  const [exportModalOpen, setExportModalOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setExportModalOpen(true)} className="gap-2">
          <FileText className="w-4 h-4" />
          Exportar Boleta PDF / Excel
        </Button>
      </div>

      <ReportCard
        subjects={subjects}
        subjectProgress={subjectProgress}
        currentLevel={currentLevel}
      />

      <ReportCardExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        studentEmail={studentEmail}
        studentName={studentName}
        currentLevel={currentLevel}
        adminEmail={adminEmail}
      />
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function StudentDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const studentEmail = urlParams.get('email');

  const [adminUser, setAdminUser] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setAdminUser(u);
    });
  }, [studentEmail]);

  // Carga todos los datos del alumno via backend (asServiceRole — multi-admin safe)
  const { data: detailData, isLoading: loadingStudent } = useQuery({
    queryKey: ['admin-student-detail', studentEmail],
    queryFn: () =>
      base44.functions.invoke('adminGetStudentDetail', { user_email: studentEmail })
        .then(r => r.data),
    enabled: !!studentEmail,
    staleTime: 0,
    gcTime: 3 * 60 * 1000,
    refetchOnMount: true,
  });

  const student = detailData?.student || null;
  const progress = detailData?.progress || {};
  const subjects = detailData?.subjects || [];
  const subjectProgress = detailData?.subject_progress || [];
  const paymentPlans = detailData?.payment_plans || [];
  const currentLevel = progress?.current_level || 1;

  const handleAdminUpdate = async () => {
    queryClient.invalidateQueries({ queryKey: ['admin-student-detail', studentEmail] });
  };

  const handleAdminClearField = async (field) => {
    if (student?.id) {
      await base44.entities.User.update(student.id, { [field]: '' });
    }
    queryClient.invalidateQueries({ queryKey: ['admin-student-detail', studentEmail] });
  };

  const handleDeleteStudent = async () => {
    setDeletingStudent(true);
    await base44.functions.invoke('deleteUserCompletely', { user_email: studentEmail });
    window.location.href = createPageUrl('ManageStudents');
  };

  if (loadingStudent || !detailData || !student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto p-6 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => window.location.href = createPageUrl('AdminDashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Panel del Estudiante</h1>
                <p className="text-sm text-gray-500">{formatName(student)}</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deletingStudent}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar Alumno
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar a {formatName(student)}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminarán permanentemente todos los datos del alumno,
                    incluyendo su progreso, resultados de pruebas y historial de pagos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteStudent} className="bg-red-600 hover:bg-red-700">
                    Sí, eliminar alumno
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Info Card: estudiante + colegiaturas */}
          <StudentInfoCard
            student={student}
            progress={progress}
            paymentPlans={paymentPlans}
          />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-white border shadow-sm">
              <TabsTrigger value="general">
                <User className="w-4 h-4 mr-1.5" />
                General
              </TabsTrigger>
              <TabsTrigger value="materias">
                <GraduationCap className="w-4 h-4 mr-1.5" />
                Materias
              </TabsTrigger>
              <TabsTrigger value="boletas">
                <FileText className="w-4 h-4 mr-1.5" />
                Boletas
              </TabsTrigger>
              <TabsTrigger value="pagos">
                Pagos
              </TabsTrigger>
            </TabsList>

            {/* Tab General */}
            <TabsContent value="general" className="mt-4">
              <ProfileForm
                user={student}
                mode="admin"
                targetUserId={student.id}
                onAdminUpdate={handleAdminUpdate}
                onAdminClearField={handleAdminClearField}
              />
            </TabsContent>

            {/* Tab Materias (lazy: solo carga cuando se activa) */}
            <TabsContent value="materias" className="mt-4">
              {activeTab === 'materias' && (
                <MateriasTab studentEmail={studentEmail} subjects={subjects} />
              )}
            </TabsContent>

            {/* Tab Boletas */}
            <TabsContent value="boletas" className="mt-4">
              {activeTab === 'boletas' && (
                <BoletasTab
                  studentEmail={studentEmail}
                  studentName={formatName(student)}
                  currentLevel={currentLevel}
                  adminEmail={adminUser?.email}
                  subjects={subjects}
                  subjectProgress={subjectProgress}
                />
              )}
            </TabsContent>

            {/* Tab Pagos (lazy) */}
            <TabsContent value="pagos" className="mt-4">
              {activeTab === 'pagos' && (
                <PaymentHistoryTab studentEmail={studentEmail} />
              )}
            </TabsContent>
          </Tabs>

        </div>
      </div>
    </AdminGuard>
  );
}