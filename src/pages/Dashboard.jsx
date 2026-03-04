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
  ArrowRight
} from "lucide-react";

import LevelCard from '../components/dashboard/LevelCard';
import StatsOverview from '../components/dashboard/StatsOverview';
import SubjectCard from '../components/dashboard/SubjectCard';

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const { data: levels = [], isLoading: loadingLevels } = useQuery({
    queryKey: ['levels'],
    queryFn: () => base44.entities.LevelConfig.list('level_number'),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list('level,order'),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: userProgress, isLoading: loadingProgress } = useQuery({
    queryKey: ['userProgress', user?.email],
    queryFn: () => base44.entities.UserProgress.filter({ user_email: user?.email }),
    enabled: !!user?.email,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: subjectProgress = [] } = useQuery({
    queryKey: ['subjectProgress', user?.email],
    queryFn: () => base44.entities.SubjectProgress.filter({ user_email: user?.email }),
    enabled: !!user?.email,
    staleTime: 0,
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
    
    const progressSum = levelSubjects.reduce((sum, subject) => {
      const sp = subjectProgress.find(p => p.subject_id === subject.id);
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
  const completedSubjectsCount = subjectProgress.filter(p => p.completed).length;
  const totalSubjectsCount = subjects.length;
  const totalProgress = totalSubjectsCount > 0 
    ? (subjectProgress.reduce((sum, p) => sum + (p.progress_percent || 0), 0) / totalSubjectsCount)
    : 0;

  // Vista de administrador
  if (user?.role === 'admin') {
    return <AdminDashboardView user={user} />;
  }

  if (loadingLevels || loadingSubjects || loadingProgress) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
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
          <Badge variant="outline" className="text-sm py-2 px-4 self-start md:self-auto">
            <Star className="w-4 h-4 mr-2 text-amber-500" />
            {Math.round(totalProgress)}% completado
          </Badge>
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