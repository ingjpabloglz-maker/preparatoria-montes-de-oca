import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Users, TrendingUp, CreditCard, GraduationCap, Download, BarChart2, BookOpen, Clock
} from "lucide-react";
import AdminGuard from '@/components/auth/AdminGuard';

const formatName = (u) => {
  const parts = [u.apellido_paterno, u.apellido_materno, u.nombres].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (u.full_name || 'Sin nombre');
};

export default function StudentStatistics() {
  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: allProgress = [] } = useQuery({
    queryKey: ['allProgress'],
    queryFn: () => base44.entities.UserProgress.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ['allPayments'],
    queryFn: () => base44.entities.Payment.list('-created_date'),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list('level'),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: subjectProgressAll = [] } = useQuery({
    queryKey: ['allSubjectProgress'],
    queryFn: () => base44.entities.SubjectProgress.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const students = allUsers.filter(u => u.role !== 'admin');
  const totalStudents = students.length;
  const activeStudents = allProgress.length;
  const inactiveStudents = totalStudents - activeStudents;
  const usedFolios = allPayments.filter(p => p.status === 'used').length;
  const availableFolios = allPayments.filter(p => p.status === 'available').length;

  const levelDistribution = [1, 2, 3, 4, 5, 6].map(level => {
    const inLevel = allProgress.filter(p => p.current_level === level);
    const blocked = inLevel.filter(p => p.blocked_due_to_time).length;
    return { level, count: inLevel.length, blocked };
  });

  // Promedio de progreso por nivel
  const levelAvgProgress = [1, 2, 3, 4, 5, 6].map(level => {
    const inLevel = allProgress.filter(p => p.current_level === level);
    if (inLevel.length === 0) return { level, avg: 0 };
    const avg = inLevel.reduce((acc, p) => acc + (p.total_progress_percent || 0), 0) / inLevel.length;
    return { level, avg: Math.round(avg) };
  });

  // Materias más completadas
  const subjectCompletions = subjects.map(s => ({
    name: s.name,
    level: s.level,
    completions: subjectProgressAll.filter(sp => sp.subject_id === s.id && sp.test_passed).length,
  })).sort((a, b) => b.completions - a.completions);

  // Tabla de estudiantes con nivel actual
  const studentsTable = students.map(u => {
    const prog = allProgress.find(p => p.user_email === u.email);
    return {
      name: formatName(u),
      email: u.email,
      level: prog?.current_level || 1,
      progress: Math.round(prog?.total_progress_percent || 0),
      blocked: prog?.blocked_due_to_time ? 'Sí' : 'No',
      completedSubjects: (prog?.completed_subjects || []).length,
    };
  });

  // ---- Exportar Excel ----
  const exportToExcel = () => {
    const rows = [];

    // Hoja 1: Resumen General
    rows.push(['=== RESUMEN GENERAL ===']);
    rows.push(['Total de Estudiantes', totalStudents]);
    rows.push(['Estudiantes Activos', activeStudents]);
    rows.push(['Estudiantes Sin Progreso', inactiveStudents]);
    rows.push(['Folios Usados', usedFolios]);
    rows.push(['Folios Disponibles', availableFolios]);
    rows.push(['Total de Materias', subjects.length]);
    rows.push([]);

    rows.push(['=== DISTRIBUCIÓN POR NIVEL ===']);
    rows.push(['Nivel', 'Estudiantes', 'Bloqueados por Tiempo', 'Progreso Promedio (%)']);
    levelDistribution.forEach(({ level, count, blocked }) => {
      const avg = levelAvgProgress.find(l => l.level === level)?.avg || 0;
      rows.push([`Nivel ${level}`, count, blocked, avg]);
    });
    rows.push([]);

    rows.push(['=== MATERIAS MÁS COMPLETADAS ===']);
    rows.push(['Materia', 'Nivel', 'Completaciones']);
    subjectCompletions.forEach(s => {
      rows.push([s.name, `Nivel ${s.level}`, s.completions]);
    });
    rows.push([]);

    rows.push(['=== DETALLE DE ESTUDIANTES ===']);
    rows.push(['Nombre', 'Email', 'Nivel Actual', 'Progreso (%)', 'Bloqueado', 'Materias Completadas']);
    studentsTable.forEach(s => {
      rows.push([s.name, s.email, `Nivel ${s.level}`, s.progress, s.blocked, s.completedSubjects]);
    });

    // Convertir a CSV (compatible con Excel)
    const csvContent = rows.map(row =>
      Array.isArray(row) ? row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',') : `"${row}"`
    ).join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `estadisticas_alumnos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const maxCount = Math.max(1, ...levelDistribution.map(l => l.count));

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6 space-y-6">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Estadísticas de Alumnos</h1>
              <p className="text-gray-500">Vista general del rendimiento y distribución de estudiantes</p>
            </div>
            <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4 mr-2" />
              Exportar Reporte Excel
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{totalStudents}</p>
                    <p className="text-sm text-gray-500">Total Estudiantes</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{activeStudents}</p>
                    <p className="text-sm text-gray-500">Activos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{allProgress.filter(p => p.blocked_due_to_time).length}</p>
                    <p className="text-sm text-gray-500">Bloqueados</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{subjects.length}</p>
                    <p className="text-sm text-gray-500">Materias</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Distribución por Nivel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-blue-600" />
                  Distribución por Nivel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 gap-3">
                  {levelDistribution.map(({ level, count, blocked }) => (
                    <div key={level} className="text-center">
                      <div className="w-full bg-gray-100 rounded-lg h-24 flex items-end justify-center p-2 mb-2 relative group">
                        <div
                          className="w-full bg-blue-500 rounded-md transition-all"
                          style={{ height: `${Math.max(8, (count / maxCount) * 100)}%` }}
                        />
                        {blocked > 0 && (
                          <div
                            className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[calc(100%-16px)] bg-red-400 rounded-md opacity-70"
                            style={{ height: `${Math.max(4, (blocked / maxCount) * 100)}%` }}
                          />
                        )}
                      </div>
                      <p className="text-xs font-semibold">Nivel {level}</p>
                      <p className="text-xs text-gray-500">{count} alumnos</p>
                      {blocked > 0 && <p className="text-xs text-red-500">{blocked} bloq.</p>}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Activos</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Bloqueados</span>
                </div>
              </CardContent>
            </Card>

            {/* Progreso promedio por nivel */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Progreso Promedio por Nivel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {levelAvgProgress.map(({ level, avg }) => (
                  <div key={level} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-16 shrink-0">Nivel {level}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full transition-all"
                        style={{ width: `${avg}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-10 text-right">{avg}%</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Materias más completadas */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                Materias Completadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Materia</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Completaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjectCompletions.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell><Badge variant="outline">Nivel {s.level}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-purple-500 h-2 rounded-full"
                              style={{ width: `${Math.min(100, (s.completions / Math.max(1, totalStudents)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">{s.completions}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Detalle de todos los estudiantes */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Detalle de Estudiantes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead>Materias Completadas</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsTable.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-gray-500">{s.email}</TableCell>
                      <TableCell><Badge variant="outline">Nivel {s.level}</Badge></TableCell>
                      <TableCell>{s.completedSubjects}</TableCell>
                      <TableCell>
                        {s.blocked === 'Sí'
                          ? <Badge className="bg-red-100 text-red-700">Bloqueado</Badge>
                          : <Badge className="bg-green-100 text-green-700">Activo</Badge>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

        </div>
      </div>
    </AdminGuard>
  );
}