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
  Trophy
} from "lucide-react";

import SubjectCard from '../components/dashboard/SubjectCard';
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

  // Calcular progreso del nivel
  const levelProgress = subjects.length > 0
    ? subjects.reduce((sum, subject) => {
        const sp = subjectProgress.find(p => p.subject_id === subject.id);
        return sum + (sp?.progress_percent || 0);
      }, 0) / subjects.length
    : 0;

  // Verificar pruebas de materias aprobadas
  const allSubjectTestsPassed = subjects.length > 0 && subjects.every(s => {
    const sp = subjectProgress.find(p => p.subject_id === s.id);
    return sp?.test_passed === true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => window.location.href = createPageUrl('Dashboard')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Nivel {levelNum}
              </h1>
              {isCompleted && (
                <Badge className="bg-green-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Completado
                </Badge>
              )}
              {isCurrentLevel && (
                <Badge variant="outline">En curso</Badge>
              )}
            </div>
            {levelConfig?.name && (
              <p className="text-gray-500">{levelConfig.name}</p>
            )}
          </div>
        </div>

        {/* Progress Card */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-500">Progreso del Nivel</p>
                <Progress value={levelProgress} className="h-3" />
                <p className="text-2xl font-bold">{Math.round(levelProgress)}%</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">Materias completadas</p>
                <p className="text-2xl font-bold">
                  {subjectProgress.filter(p => p.completed && subjects.some(s => s.id === p.subject_id)).length}
                  <span className="text-gray-400 font-normal">/{subjects.length}</span>
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">Pruebas aprobadas</p>
                <p className="text-2xl font-bold">
                  {subjectProgress.filter(p => p.test_passed && subjects.some(s => s.id === p.subject_id)).length}
                  <span className="text-gray-400 font-normal">/{subjects.length}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estado del nivel */}
        {allSubjectTestsPassed && (
          <Card className="border-green-200 bg-green-50 border-0 shadow-lg">
            <CardContent className="p-6 flex items-center gap-4">
              <Trophy className="w-10 h-10 text-green-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-green-800 text-lg">¡Nivel Completado!</p>
                <p className="text-green-700 text-sm">Has aprobado todas las materias y pruebas. Puedes avanzar al siguiente nivel ingresando tu folio de pago.</p>
              </div>
              <Button
                className="ml-auto bg-green-600 hover:bg-green-700 flex-shrink-0"
                onClick={() => window.location.href = createPageUrl(`UnlockLevel?level=${levelNum + 1}`)}
              >
                Desbloquear Nivel {levelNum + 1}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Materias */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Materias
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((subject) => {
              const sp = subjectProgress.find(p => p.subject_id === subject.id);
              return (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  progress={sp?.progress_percent || 0}
                  isCompleted={sp?.test_passed || false}
                  onClick={() => window.location.href = createPageUrl(`Subject?id=${subject.id}`)}
                />
              );
            })}
          </div>
          <LevelInsights subjects={subjects} subjectProgress={subjectProgress} />
        </div>
      </div>
    </div>
  );
}