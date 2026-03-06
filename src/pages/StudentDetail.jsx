import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft, User, Mail, CheckCircle2, XCircle, Trash2
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
import AdminGuard from '../components/auth/AdminGuard';
import ProfileForm from '../components/profile/ProfileForm';
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function StudentDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const studentEmail = urlParams.get('email');

  const [adminUser, setAdminUser] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setAdminUser);
  }, []);

  const { data: students = [] } = useQuery({
    queryKey: ['student', studentEmail],
    queryFn: () => base44.entities.User.filter({ email: studentEmail }),
    enabled: !!studentEmail,
  });

  const { data: progressData = [] } = useQuery({
    queryKey: ['studentProgress', studentEmail],
    queryFn: () => base44.entities.UserProgress.filter({ user_email: studentEmail }),
    enabled: !!studentEmail,
  });

  const { data: subjectProgress = [] } = useQuery({
    queryKey: ['studentSubjectProgress', studentEmail],
    queryFn: () => base44.entities.SubjectProgress.filter({ user_email: studentEmail }),
    enabled: !!studentEmail,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list('level'),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['studentPayments', studentEmail],
    queryFn: () => base44.entities.Payment.filter({ user_email: studentEmail }),
    enabled: !!studentEmail,
  });

  const student = students[0];
  const progress = progressData[0];
  const currentLevel = progress?.current_level || 1;

  const completedSubjects = subjectProgress.filter(sp => sp.test_passed).length;

  const handleAdminUpdate = async (data) => {
    await base44.entities.User.update(student.id, data);
    queryClient.invalidateQueries({ queryKey: ['student', studentEmail] });
  };

  // Clear a single field (admin borrar dato erróneo)
  const handleAdminClearField = async (field) => {
    await base44.entities.User.update(student.id, { [field]: '' });
    queryClient.invalidateQueries({ queryKey: ['student', studentEmail] });
  };

  const handleDeleteStudent = async () => {
    setDeletingStudent(true);
    // Eliminar todos los datos asociados al alumno
    const [progressRecords, subjectProgressRecords, paymentRecords] = await Promise.all([
      base44.entities.UserProgress.filter({ user_email: studentEmail }),
      base44.entities.SubjectProgress.filter({ user_email: studentEmail }),
      base44.entities.Payment.filter({ user_email: studentEmail }),
    ]);
    await Promise.all([
      ...progressRecords.map(r => base44.entities.UserProgress.delete(r.id)),
      ...subjectProgressRecords.map(r => base44.entities.SubjectProgress.delete(r.id)),
      ...paymentRecords.map(r => base44.entities.Payment.delete(r.id)),
      base44.entities.User.delete(student.id),
    ]);
    window.location.href = createPageUrl('ManageStudents');
  };

  if (!student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  const profileComplete = student.nombres && student.apellido_paterno && student.telefono_personal && student.correo_contacto;

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => window.location.href = createPageUrl('AdminDashboard')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Detalle del Estudiante</h1>
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
                  <AlertDialogTitle>¿Eliminar a {student?.full_name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. Se eliminarán permanentemente todos los datos del alumno,
                    incluyendo su progreso, resultados de pruebas y historial de pagos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteStudent}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Sí, eliminar alumno
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Info básica */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-xl">{student.full_name || 'Sin nombre'}</p>
                  <p className="text-gray-500 flex items-center gap-1 text-sm">
                    <Mail className="w-4 h-4" /> {student.email}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Inscrito: {student.created_date ? format(new Date(student.created_date), "d 'de' MMMM, yyyy", { locale: es }) : 'N/A'}
                  </p>
                  {!profileComplete && (
                    <Badge className="mt-2 bg-amber-100 text-amber-800 border border-amber-300">
                      Perfil incompleto — niveles bloqueados
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información personal editable */}
          <ProfileForm
            user={student}
            mode="admin"
            onAdminUpdate={handleAdminUpdate}
            onAdminClearField={handleAdminClearField}
          />

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
                              ? <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Aprobada</Badge>
                              : <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />No Aprobada</Badge>
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

          {/* Payments */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle>Historial de Pagos</CardTitle></CardHeader>
            <CardContent>
              {payments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Folio</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono">{payment.folio}</TableCell>
                        <TableCell><Badge variant="outline">Nivel {payment.level}</Badge></TableCell>
                        <TableCell>{payment.used_date && format(new Date(payment.used_date), "dd/MM/yyyy")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-gray-400 py-8">Sin pagos registrados</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminGuard>
  );
}