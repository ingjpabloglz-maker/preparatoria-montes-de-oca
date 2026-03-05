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
  ArrowLeft,
  BookOpen,
  FileCheck,
  Clock,
  CheckCircle2,
  Lock
} from "lucide-react";

import SubjectCard from '../components/dashboard/SubjectCard';
import LevelTest from '../components/tests/LevelTest';
import LevelInsights from '../components/analytics/LevelInsights';

export default function Level() {
  const urlParams = new URLSearchParams(window.location.search);
  const levelNum = parseInt(urlParams.get('level')) || 1;
  
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('subjects');
  const [takingTest, setTakingTest] = useState(null);
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

  // Verificar pruebas completadas
  const testScores = progress?.test_scores || [];
  const levelTests = testScores.filter(t => t.level === levelNum);
  const test1Passed = levelTests.find(t => t.test_number === 1 && t.passed);
  const test2Passed = levelTests.find(t => t.test_number === 2 && t.passed);
  const allTestsPassed = test1Passed && test2Passed;

  const handleTestComplete = async (testNumber, score, passed) => {
    if (!progress) return;
    
    const existingScores = progress.test_scores || [];

    // Si ya está aprobada, no duplicar
    const alreadyPassed = existingScores.find(t => t.level === levelNum && t.test_number === testNumber && t.passed);
    if (alreadyPassed) return;

    // Siempre agregar el intento (aprobado o no)
    const newTestScores = [...existingScores, {
      level: levelNum,
      test_number: testNumber,
      score,
      passed,
      date: new Date().toISOString()
    }];

    await base44.entities.UserProgress.update(progress.id, {
      test_scores: newTestScores
    });

    // Refrescar inmediatamente
    await refetchProgress();
    await queryClient.invalidateQueries({ queryKey: ['userProgress'] });
  };

  if (takingTest) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Button 
            variant="ghost" 
            className="mb-6 gap-2"
            onClick={() => setTakingTest(null)}
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <LevelTest 
            level={levelNum}
            testNumber={takingTest}
            onComplete={(score, passed) => handleTestComplete(takingTest, score, passed)}
            onExit={() => setTakingTest(null)}
          />
        </div>
      </div>
    );
  }

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
                <p className="text-sm text-gray-500">Materias</p>
                <p className="text-2xl font-bold">
                  {subjectProgress.filter(p => p.completed && subjects.some(s => s.id === p.subject_id)).length}
                  <span className="text-gray-400 font-normal">/{subjects.length}</span>
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-500">Pruebas Aprobadas</p>
                <p className="text-2xl font-bold">
                  {(test1Passed ? 1 : 0) + (test2Passed ? 1 : 0)}
                  <span className="text-gray-400 font-normal">/2</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white shadow-sm">
            <TabsTrigger value="subjects" className="gap-2">
              <BookOpen className="w-4 h-4" />
              Materias
            </TabsTrigger>
            <TabsTrigger value="tests" className="gap-2">
              <FileCheck className="w-4 h-4" />
              Pruebas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subjects" className="mt-6 space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map((subject) => {
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
            <LevelInsights subjects={subjects} subjectProgress={subjectProgress} />
          </TabsContent>

          <TabsContent value="tests" className="mt-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Prueba 1 */}
              <Card className={test1Passed ? "border-green-200 bg-green-50/50" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Prueba 1</CardTitle>
                    {test1Passed ? (
                      <Badge className="bg-green-500">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Aprobada ({test1Passed.score}%)
                      </Badge>
                    ) : levelProgress < 50 ? (
                      <Badge variant="secondary">
                        <Lock className="w-3 h-3 mr-1" />
                        Requiere 50% de avance
                      </Badge>
                    ) : (
                      <Badge variant="outline">Disponible</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500 text-sm mb-4">
                    Primera evaluación del nivel. Debes tener al menos 50% de avance para presentarla.
                  </p>
                  <Button 
                    className="w-full"
                    disabled={levelProgress < 50 || test1Passed}
                    onClick={() => setTakingTest(1)}
                  >
                    {test1Passed ? "Aprobada" : "Iniciar Prueba"}
                  </Button>
                </CardContent>
              </Card>

              {/* Prueba 2 */}
              <Card className={test2Passed ? "border-green-200 bg-green-50/50" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Prueba 2</CardTitle>
                    {test2Passed ? (
                      <Badge className="bg-green-500">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Aprobada ({test2Passed.score}%)
                      </Badge>
                    ) : levelProgress < 100 ? (
                      <Badge variant="secondary">
                        <Lock className="w-3 h-3 mr-1" />
                        Requiere 100% de avance
                      </Badge>
                    ) : (
                      <Badge variant="outline">Disponible</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500 text-sm mb-4">
                    Evaluación final del nivel. Debes completar todas las materias para presentarla.
                  </p>
                  <Button 
                    className="w-full"
                    disabled={levelProgress < 100 || test2Passed}
                    onClick={() => setTakingTest(2)}
                  >
                    {test2Passed ? "Aprobada" : "Iniciar Prueba"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}