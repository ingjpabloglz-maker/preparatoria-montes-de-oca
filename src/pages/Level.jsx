import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Lock,
  Trophy,
  PlayCircle
} from "lucide-react";

import SubjectCard from '../components/dashboard/SubjectCard';
import NextStepCard from '../components/dashboard/NextStepCard';
import { useMultiSubjectProgress } from '@/hooks/useSubjectProgress';
export default function Level() {
  const urlParams = new URLSearchParams(window.location.search);
  const levelNum = parseInt(urlParams.get('level')) || 1;
  
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const { data: levelConfig } = useQuery({
    queryKey: ['levelConfig', levelNum],
    queryFn: async () => {
      const levels = await base44.entities.LevelConfig.filter({ level_number: levelNum });
      return levels[0] || { level_number: levelNum, name: `Nivel ${levelNum}`, time_limit_days: 180 };
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['levelSubjects', levelNum],
    queryFn: () => base44.entities.Subject.filter({ level: levelNum }, 'order'),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: userProgress, refetch: refetchProgress } = useQuery({
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
  const isCurrentLevel = levelNum === currentLevel;
  const isCompleted = levelNum < currentLevel;

  const subjectIds = subjects.map(s => s.id);
  const { progressMap } = useMultiSubjectProgress(user?.email, subjectIds);

  // Calcular progreso del nivel desde datos reales de lecciones
  const levelProgress = subjects.length > 0
    ? subjects.reduce((sum, subject) => {
        return sum + (progressMap[subject.id]?.realProgress || 0);
      }, 0) / subjects.length
    : 0;

  // Verificar pruebas de materias aprobadas
  const allSubjectTestsPassed = subjects.length > 0 && subjects.every(s => {
    const sp = subjectProgress.find(p => p.subject_id === s.id);
    return sp?.test_passed === true;
  });

  // Calcular siguiente materia pendiente usando progreso real
  const nextSubject = (() => {
    const inProgress = subjects.find(s => {
      const pct = progressMap[s.id]?.realProgress || 0;
      const sp = subjectProgress.find(p => p.subject_id === s.id);
      return pct > 0 && pct < 100 && !sp?.test_passed;
    });
    if (inProgress) {
      return { ...inProgress, progress: progressMap[inProgress.id]?.realProgress || 0 };
    }
    const pending = subjects.find(s => {
      const sp = subjectProgress.find(p => p.subject_id === s.id);
      return !sp?.test_passed && (progressMap[s.id]?.realProgress || 0) === 0;
    });
    return pending ? { ...pending, progress: 0 } : null;
  })();

  const completedCount = subjectProgress.filter(p => p.test_passed && subjects.some(s => s.id === p.subject_id)).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.location.href = createPageUrl('Dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {isCompleted ? '✅ Nivel completado' : isCurrentLevel ? 'Estás en este nivel' : `Nivel ${levelNum}`}
              </h1>
              {isCompleted && <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completado</Badge>}
              {isCurrentLevel && <Badge className="bg-blue-100 text-blue-700 border-blue-200">En curso</Badge>}
            </div>
            {levelConfig?.name && <p className="text-gray-500">{levelConfig.name}</p>}
          </div>
        </div>

        {/* Progress Hero */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-6 text-white">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <p className="text-blue-200 text-sm">Progreso del nivel</p>
                <p className="text-4xl font-bold">{Math.round(levelProgress)}%</p>
                <Progress value={levelProgress} className="h-2 bg-white/30 [&>div]:bg-white" />
                <p className="text-blue-200 text-xs">
                  {levelProgress === 0 ? 'Vas comenzando' : levelProgress < 50 ? 'Buen inicio, sigue así' : levelProgress < 90 ? '¡Casi terminas este nivel!' : 'A punto de completarlo'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-blue-200 text-sm">Materias</p>
                <p className="text-4xl font-bold">{completedCount}<span className="text-xl text-white/60">/{subjects.length}</span></p>
                <p className="text-blue-200 text-xs">
                  {subjects.length - completedCount === 0
                    ? '¡Todas completadas!'
                    : subjects.length - completedCount === 1
                    ? 'Te falta 1 materia para terminar'
                    : `Te faltan ${subjects.length - completedCount} materias`}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-blue-200 text-sm">Pruebas aprobadas</p>
                <p className="text-4xl font-bold">
                  {subjectProgress.filter(p => p.test_passed && subjects.some(s => s.id === p.subject_id)).length}
                  <span className="text-xl text-white/60">/{subjects.length}</span>
                </p>
                <p className="text-blue-200 text-xs">Aprueba todas para avanzar de nivel</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Siguiente paso */}
        <NextStepCard
          nextSubject={nextSubject}
          onGo={() => nextSubject && (window.location.href = createPageUrl(`Subject?id=${nextSubject.id}`))}
        />

        {/* Nivel completado CTA */}
        {allSubjectTestsPassed && (
          <Card className="border-green-300 bg-green-50 border shadow-lg">
            <CardContent className="p-6 flex items-center gap-4 flex-wrap">
              <Trophy className="w-10 h-10 text-green-500 shrink-0" />
              <div className="flex-1">
                <p className="font-bold text-green-800 text-lg">¡Felicidades! Completaste el Nivel {levelNum}</p>
                <p className="text-green-700 text-sm">Aprobaste todas las materias. ¡Estás listo para el siguiente paso!</p>
              </div>
              <Button
                className="bg-green-600 hover:bg-green-700 shrink-0"
                onClick={() => window.location.href = createPageUrl(`UnlockLevel?level=${levelNum + 1}`)}
              >
                Desbloquear Nivel {levelNum + 1}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Materias */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Materias de este nivel
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((subject) => {
              const sp = subjectProgress.find(p => p.subject_id === subject.id);
              const realPct = progressMap[subject.id]?.realProgress || 0;
              const testStatus = sp?.test_passed ? 'aprobado' : sp?.test_attempts > 0 ? 'no_aprobado' : 'pendiente';
              return (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  progress={realPct}
                  isCompleted={sp?.test_passed || false}
                  testStatus={testStatus}
                  onClick={() => window.location.href = createPageUrl(`Subject?id=${subject.id}`)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}