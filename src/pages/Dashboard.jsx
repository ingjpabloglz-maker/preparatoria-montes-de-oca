import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  GraduationCap, 
  BookOpen, 
  Clock,
  ChevronRight,
  Star,
  Users,
  CreditCard,
  BarChart2,
  Settings,
  ArrowRight,
  Search,
  Eye
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";

import LevelCard from '../components/dashboard/LevelCard';
import StatsOverview from '../components/dashboard/StatsOverview';
import SubjectCard from '../components/dashboard/SubjectCard';
import { AlertCircle } from "lucide-react";

function AdminDashboardView({ user }) {
  const [studentSearch, setStudentSearch] = useState('');
  const urlParams = new URLSearchParams(window.location.search);
  const defaultTab = urlParams.get('tab') || 'overview';

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });
  const { data: allProgress = [] } = useQuery({
    queryKey: ['allProgress'],
    queryFn: () => base44.entities.UserProgress.list(),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list(),
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list(),
  });

  const students = allUsers.filter(u => u.role !== 'admin');
  const availableFolios = payments.filter(p => p.status === 'available').length;
  const usedFolios = payments.filter(p => p.status === 'used').length;

  const levelDist = [1,2,3,4,5,6].map(lvl => ({
    level: lvl,
    count: allProgress.filter(p => p.current_level === lvl).length
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
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="text-gray-500 mt-1">Hola, {user?.full_name?.split(' ')[0]}. Aquí tienes el resumen del sistema.</p>
        </div>

        {/* Stats */}
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

        {/* Tabs */}
        <Tabs defaultValue={defaultTab}>
          <TabsList className="bg-white shadow-sm">
            <TabsTrigger value="overview">Vista General</TabsTrigger>
            <TabsTrigger value="students">Gestión de Alumnos</TabsTrigger>
            <TabsTrigger value="access">Accesos Rápidos</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Level Distribution */}
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

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        // User not logged in
      } finally {
        setLoadingUser(false);
      }
    };
    loadUser();
  }, []);

  const { data: levels = [], isLoading: loadingLevels } = useQuery({
    queryKey: ['levels'],
    queryFn: () => base44.entities.LevelConfig.list('level_number'),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list('level'),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: userProgress, isLoading: loadingProgress } = useQuery({
    queryKey: ['userProgress', user?.email],
    queryFn: () => base44.entities.UserProgress.filter({ user_email: user?.email }),
    enabled: !loadingUser && !!user?.email,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const { data: subjectProgress = [], isLoading: loadingSubjectProgress } = useQuery({
    queryKey: ['subjectProgress', user?.email],
    queryFn: () => base44.entities.SubjectProgress.filter({ user_email: user?.email }),
    enabled: !loadingUser && !!user?.email,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const progress = userProgress?.[0];
  const currentLevel = progress?.current_level || 1;

  // Agrupar materias por nivel
  const subjectsByLevel = subjects.reduce((acc, subject) => {
    if (!acc[subject.level]) acc[subject.level] = [];
    acc[subject.level].push(subject);
    return acc;
  }, {});

  // Calcular progreso por nivel
  const getLevelProgress = (levelNum) => {
    const levelSubjects = subjectsByLevel[levelNum] || [];
    if (levelSubjects.length === 0) return 0;

    // Nivel ya completado → 100%
    if (levelNum < currentLevel) return 100;

    const progressSum = levelSubjects.reduce((sum, subject) => {
      const sp = subjectProgress.find(p => p.subject_id === subject.id);
      if (sp?.completed && sp?.test_passed) return sum + 100;
      return sum + (sp?.progress_percent || 0);
    }, 0);

    return progressSum / levelSubjects.length;
  };

  // Calcular días restantes
  const getDaysRemaining = () => {
    if (!progress?.level_start_date) return null;
    const levelConfig = levels.find(l => l.level_number === currentLevel);
    if (!levelConfig) return null;
    
    const startDate = new Date(progress.level_start_date);
    const now = new Date();
    const daysPassed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    return Math.max(0, levelConfig.time_limit_days - daysPassed);
  };

  const getDaysInLevel = () => {
    if (!progress?.level_start_date) return 0;
    const startDate = new Date(progress.level_start_date);
    const now = new Date();
    return Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
  };

  const currentLevelConfig = levels.find(l => l.level_number === currentLevel);
  const currentLevelSubjects = subjectsByLevel[currentLevel] || [];
  const completedSubjectsCount = subjectProgress.filter(p => p.test_passed).length;
  const totalSubjectsCount = subjects.length;
  const totalProgress = totalSubjectsCount > 0
    ? Math.min(100, (subjectProgress.reduce((sum, p) => sum + Math.min(100, p.progress_percent || 0), 0) / totalSubjectsCount))
    : 0;

  // Vista de administrador
  if (user?.role === 'admin') {
    return <AdminDashboardView user={user} />;
  }

  if (loadingUser || loadingLevels || loadingSubjects || loadingProgress || loadingSubjectProgress) {
    return (
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
  }

  const profileComplete = user?.nombres && user?.apellido_paterno && user?.telefono_personal && user?.correo_contacto;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Alerta perfil incompleto */}
        {!profileComplete && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">Completa tu información personal</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Debes llenar tu perfil antes de poder iniciar los niveles.
              </p>
            </div>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white flex-shrink-0"
              onClick={() => window.location.href = createPageUrl('Profile')}
            >
              Ir a Mi Perfil
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              ¡Hola, {user?.full_name?.split(' ')[0] || 'Estudiante'}! 👋
            </h1>
            <p className="text-gray-500 mt-1">
              Continúa tu aprendizaje en el Nivel {currentLevel}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button variant="outline" size="sm" onClick={() => window.location.href = createPageUrl('Profile')}>
              Mi Perfil
            </Button>
            <Badge variant="outline" className="text-sm py-2 px-4">
              <Star className="w-4 h-4 mr-2 text-amber-500" />
              {Math.round(totalProgress)}% completado
            </Badge>
          </div>
        </div>

        {/* Stats Overview */}
        <StatsOverview 
          currentLevel={currentLevel}
          totalProgress={totalProgress}
          completedSubjects={completedSubjectsCount}
          totalSubjects={totalSubjectsCount}
          daysInLevel={getDaysInLevel()}
          timeLimitDays={currentLevelConfig?.time_limit_days || 180}
        />

        {/* Current Level Section */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Tu nivel actual</p>
                <h2 className="text-2xl font-bold mt-1">Nivel {currentLevel}</h2>
              </div>
              <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">{getDaysRemaining()} días restantes</span>
              </div>
            </div>
          </div>
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Materias del Nivel {currentLevel}
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentLevelSubjects.map((subject) => {
                const sp = subjectProgress.find(p => p.subject_id === subject.id);
                return (
                  <SubjectCard
                    key={subject.id}
                    subject={subject}
                    progress={sp?.progress_percent || 0}
                    isCompleted={sp?.completed || false}
                    onClick={() => window.location.href = createPageUrl(`Subject?id=${subject.id}`)}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* All Levels Overview */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <GraduationCap className="w-6 h-6" />
            Todos los Niveles
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map((levelNum) => {
              const levelConfig = levels.find(l => l.level_number === levelNum) || {
                level_number: levelNum,
                name: `Nivel ${levelNum}`,
                time_limit_days: 180
              };
              const isUnlocked = levelNum <= currentLevel;
              const isCompleted = levelNum < currentLevel;
              const isCurrent = levelNum === currentLevel;

              return (
                <LevelCard
                  key={levelNum}
                  level={levelConfig}
                  isUnlocked={isUnlocked}
                  isCompleted={isCompleted}
                  isCurrent={isCurrent}
                  progress={getLevelProgress(levelNum)}
                  subjects={subjectsByLevel[levelNum] || []}
                  daysRemaining={isCurrent ? getDaysRemaining() : undefined}
                  onClick={() => {
                    if (!profileComplete) {
                      window.location.href = createPageUrl('Profile');
                      return;
                    }
                    if (isCurrent) {
                      window.location.href = createPageUrl(`Level?level=${levelNum}`);
                    } else if (isCompleted) {
                      window.location.href = createPageUrl(`Level?level=${levelNum}`);
                    } else {
                      window.location.href = createPageUrl(`UnlockLevel?level=${levelNum}`);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}