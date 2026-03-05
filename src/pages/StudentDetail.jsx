import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft,
  User,
  Mail,
  Calendar,
  GraduationCap,
  Clock,
  CheckCircle2,
  XCircle
} from "lucide-react";
import AdminGuard from '../components/auth/AdminGuard';
import ProfileForm from '../components/profile/ProfileForm';
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useQueryClient } from '@tanstack/react-query';

export default function StudentDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const studentEmail = urlParams.get('email');
  
  const [adminUser, setAdminUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setAdminUser(userData);
    };
    loadUser();
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
    queryFn: () => base44.entities.Subject.list('level,order'),
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['studentPayments', studentEmail],
    queryFn: () => base44.entities.Payment.filter({ user_email: studentEmail }),
    enabled: !!studentEmail,
  });

  const student = students[0];
  const progress = progressData[0];
  const currentLevel = progress?.current_level || 1;

  const handleAdminUpdateProfile = async (formData) => {
    await base44.entities.User.update(student.id, formData);
    queryClient.invalidateQueries({ queryKey: ['student', studentEmail] });
  };

  // Calcular estadísticas
  const completedSubjects = subjectProgress.filter(sp => sp.completed).length;
  const totalProgress = subjects.length > 0
    ? subjectProgress.reduce((sum, sp) => sum + (sp.progress_percent || 0), 0) / subjects.length
    : 0;

  const testScores = progress?.test_scores || [];

  if (!student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <AdminGuard><div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => window.location.href = createPageUrl('AdminDashboard')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Detalle del Estudiante</h1>
          </div>
        </div>

        {/* Student Info */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-6 mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-xl">{student.full_name || 'Sin nombre'}</p>
                <p className="text-gray-500 flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {student.email}
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Inscrito: {student.created_date ? format(new Date(student.created_date), "d 'de' MMMM, yyyy", { locale: es }) : 'N/A'}
                </p>
              </div>
            </div>
            <ProfileForm user={student} onAdminUpdate={handleAdminUpdateProfile} mode="admin" />
          </CardContent>
        </Card>

        {/* Progress Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <GraduationCap className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">Nivel {currentLevel}</p>
              <p className="text-sm text-gray-500">Nivel Actual</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{completedSubjects}/{subjects.length}</p>
              <p className="text-sm text-gray-500">Materias Completadas</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-purple-600 font-bold text-sm">{Math.round(totalProgress)}%</span>
              </div>
              <p className="text-2xl font-bold">{Math.round(totalProgress)}%</p>
              <p className="text-sm text-gray-500">Progreso Total</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {progress?.level_start_date 
                  ? Math.floor((new Date() - new Date(progress.level_start_date)) / (1000 * 60 * 60 * 24))
                  : 0}
              </p>
              <p className="text-sm text-gray-500">Días en Nivel</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress by Level */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Progreso por Nivel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map((level) => {
                const levelSubjects = subjects.filter(s => s.level === level);
                const levelProgress = levelSubjects.length > 0
                  ? levelSubjects.reduce((sum, subject) => {
                      const sp = subjectProgress.find(p => p.subject_id === subject.id);
                      return sum + (sp?.progress_percent || 0);
                    }, 0) / levelSubjects.length
                  : 0;
                const isCurrentLevel = level === currentLevel;
                const isCompleted = level < currentLevel;

                return (
                  <div key={level} className="flex items-center gap-4">
                    <div className="w-20 text-sm font-medium">
                      Nivel {level}
                      {isCompleted && (
                        <CheckCircle2 className="w-4 h-4 text-green-500 inline ml-1" />
                      )}
                    </div>
                    <div className="flex-1">
                      <Progress value={levelProgress} className="h-3" />
                    </div>
                    <div className="w-16 text-right text-sm text-gray-500">
                      {Math.round(levelProgress)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Test Scores */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Resultados de Pruebas</CardTitle>
          </CardHeader>
          <CardContent>
            {testScores.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Prueba</TableHead>
                    <TableHead>Calificación</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testScores.map((test, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Badge variant="outline">Nivel {test.level}</Badge>
                      </TableCell>
                      <TableCell>Prueba {test.test_number}</TableCell>
                      <TableCell className="font-semibold">{test.score}%</TableCell>
                      <TableCell>
                        {test.passed ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Aprobada
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 mr-1" />
                            No Aprobada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {test.date && format(new Date(test.date), "dd/MM/yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-gray-400 py-8">
                Sin pruebas realizadas
              </p>
            )}
          </CardContent>
        </Card>

        {/* Payments */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Historial de Pagos</CardTitle>
          </CardHeader>
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
                      <TableCell>
                        <Badge variant="outline">Nivel {payment.level}</Badge>
                      </TableCell>
                      <TableCell>
                        {payment.used_date && format(new Date(payment.used_date), "dd/MM/yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-gray-400 py-8">
                Sin pagos registrados
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div></AdminGuard>
  );
}