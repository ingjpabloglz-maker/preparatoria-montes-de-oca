import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, CreditCard, BookOpen, BarChart2, ArrowRight, Search, Eye, Settings } from "lucide-react";

// SOLO lógica admin. Sin ningún hook LMS estudiantil.
export default function AdminDashboardView({ user }) {
  const [studentSearch, setStudentSearch] = useState('');
  const urlParams = new URLSearchParams(window.location.search);
  const defaultTab = urlParams.get('tab') || 'overview';

  // gcTime corto en datos de admin: se liberan de cache al navegar fuera del panel.
  // Datasets grandes (allUsers, allProgress, payments) no deben persistir innecesariamente.
  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: allProgress = [] } = useQuery({
    queryKey: ['allProgress'],
    queryFn: () => base44.entities.UserProgress.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list(),
    staleTime: 30 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const students = allUsers.filter(u => u.role !== 'admin');
  const availableFolios = payments.filter(p => p.status === 'available').length;
  const usedFolios = payments.filter(p => p.status === 'used').length;

  const levelDist = [1,2,3,4,5,6].map(lvl => ({
    level: lvl,
    count: allProgress.filter(p => p.current_level === lvl).length,
  }));

  const filteredStudents = students.filter(s =>
    s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const getProgress = (email) => allProgress.find(p => p.user_email === email);

  const adminLinks = [
    { label: 'Administración completa', page: 'AdminDashboard', icon: BarChart2, desc: 'Panel con estadísticas y actividad reciente' },
    { label: 'Gestionar Folios', page: 'ManageFolios', icon: CreditCard, desc: 'Crear, listar y eliminar folios de pago' },
    { label: 'Gestionar Materias', page: 'ManageSubjects', icon: BookOpen, desc: 'Agregar o editar materias por nivel' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="text-gray-500 mt-1">Hola, {user?.full_name?.split(' ')[0]}. Aquí tienes el resumen del sistema.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{students.length}</p>
                  <p className="text-xs text-gray-500">Estudiantes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{availableFolios}</p>
                  <p className="text-xs text-gray-500">Folios disponibles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{usedFolios}</p>
                  <p className="text-xs text-gray-500">Folios usados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{subjects.length}</p>
                  <p className="text-xs text-gray-500">Materias</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="bg-white shadow-sm">
            <TabsTrigger value="overview">Vista General</TabsTrigger>
            <TabsTrigger value="students">Gestión de Alumnos</TabsTrigger>
            <TabsTrigger value="access">Accesos Rápidos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-base">Distribución de estudiantes por nivel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {levelDist.map(({ level, count }) => (
                    <div key={level} className="text-center p-3 bg-blue-50 rounded-xl">
                      <p className="text-xl font-bold text-blue-700">{count}</p>
                      <p className="text-xs text-gray-500 mt-1">Nivel {level}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="students" className="mt-6">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="text-base">Gestión de Alumnos</CardTitle>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nombre..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Progreso</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((s) => {
                      const prog = getProgress(s.email);
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.full_name || 'Sin nombre'}</TableCell>
                          <TableCell className="text-gray-500">{s.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">Nivel {prog?.current_level || 1}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="w-32">
                              <Progress value={prog?.total_progress_percent || 0} className="h-2" />
                              <span className="text-xs text-gray-500">{Math.round(prog?.total_progress_percent || 0)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.location.href = createPageUrl(`StudentDetail?email=${s.email}`)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver detalle
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredStudents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                          No se encontraron alumnos con ese nombre.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="access" className="mt-6">
            <div className="grid sm:grid-cols-3 gap-4">
              {adminLinks.map(({ label, page, icon: Icon, desc }) => (
                <Card
                  key={page}
                  className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => window.location.href = createPageUrl(page)}
                >
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <Icon className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}