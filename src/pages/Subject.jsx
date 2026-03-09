import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { 
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Trophy,
  AlertCircle
} from "lucide-react";
import SubjectTest from '../components/tests/SubjectTest';
import ExtraordinaryFolioValidator from '../components/payment/ExtraordinaryFolioValidator';
import { Map } from "lucide-react";

export default function Subject() {
  const urlParams = new URLSearchParams(window.location.search);
  const subjectId = urlParams.get('id');
  
  const [user, setUser] = useState(null);
  const [takingTest, setTakingTest] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const { data: subject } = useQuery({
    queryKey: ['subject', subjectId],
    queryFn: async () => {
      const subjects = await base44.entities.Subject.filter({ id: subjectId });
      return subjects[0];
    },
    enabled: !!subjectId,
  });

  const { data: progressData } = useQuery({
    queryKey: ['subjectProgress', user?.email, subjectId],
    queryFn: async () => {
      const progress = await base44.entities.SubjectProgress.filter({ 
        user_email: user?.email,
        subject_id: subjectId
      });
      return progress[0];
    },
    enabled: !!user?.email && !!subjectId,
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (newProgress) => {
      if (progressData) {
        await base44.entities.SubjectProgress.update(progressData.id, {
          progress_percent: newProgress,
          completed: newProgress >= 100,
          last_activity: new Date().toISOString()
        });
      } else {
        await base44.entities.SubjectProgress.create({
          user_email: user.email,
          subject_id: subjectId,
          progress_percent: newProgress,
          completed: newProgress >= 100,
          last_activity: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['subjectProgress']);
    }
  });

  const updateAnalyticsMutation = useMutation({
    mutationFn: async (analyticsData) => {
      if (progressData) {
        await base44.entities.SubjectProgress.update(progressData.id, {
          ...analyticsData,
          last_activity: new Date().toISOString()
        });
      } else {
        await base44.entities.SubjectProgress.create({
          user_email: user.email,
          subject_id: subjectId,
          progress_percent: 0,
          completed: false,
          last_activity: new Date().toISOString(),
          ...analyticsData
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['subjectProgress']);
    }
  });

  const currentProgress = progressData?.progress_percent || 0;
  const isCompleted = progressData?.completed || false;
  const testPassed = progressData?.test_passed || false;
  const testAttempts = progressData?.test_attempts || 0;
  const finalGrade = progressData?.final_grade;
  const attemptsLeft = 3 - testAttempts;
  const testBlocked = testAttempts >= 3 && !testPassed;
  const testAvailable = isCompleted && !testPassed && !testBlocked;

  const handleTestComplete = async (score, passed) => {
    const newAttempts = testAttempts + 1;
    const updateData = {
      test_attempts: newAttempts,
      test_passed: passed,
      last_activity: new Date().toISOString(),
    };
    updateData.final_grade = score;
    if (passed) {
      updateData.completed = true;
    }
    if (progressData) {
      await base44.entities.SubjectProgress.update(progressData.id, updateData);
    } else {
      await base44.entities.SubjectProgress.create({
        user_email: user.email,
        subject_id: subjectId,
        progress_percent: currentProgress,
        completed: isCompleted,
        ...updateData
      });
    }
    setTakingTest(false);
    queryClient.invalidateQueries(['subjectProgress']);
  };

  const handleExtraordinaryUnlocked = async () => {
    // Reiniciar conteo de intentos para dar 3 nuevos intentos
    const extraUsed = (progressData?.extraordinary_attempts_used || 0) + 1;
    if (progressData) {
      await base44.entities.SubjectProgress.update(progressData.id, {
        test_attempts: 0,
        extraordinary_attempts_used: extraUsed,
        last_activity: new Date().toISOString(),
      });
    }
    queryClient.invalidateQueries(['subjectProgress']);
  };

  if (!subject) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (takingTest) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" className="mb-6 gap-2" onClick={() => setTakingTest(false)}>
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <SubjectTest
            subject={subject}
            onComplete={handleTestComplete}
            onExit={() => setTakingTest(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => window.location.href = createPageUrl(`Level?level=${subject.level}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{subject.name}</h1>
              {testPassed ? (
                <Badge className="bg-green-500">
                  <Trophy className="w-3 h-3 mr-1" />
                  Aprobada ({finalGrade}%)
                </Badge>
              ) : isCompleted ? (
                <Badge className="bg-blue-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Lista para examen
                </Badge>
              ) : null}
            </div>
            <p className="text-gray-500">Nivel {subject.level}</p>
          </div>
        </div>

        {/* Progress Card */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">Tu Progreso</h3>
              <span className="text-2xl font-bold text-blue-600">{Math.round(currentProgress)}%</span>
            </div>
            <Progress value={currentProgress} className="h-4 mb-4" />
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-3">Actualiza tu avance manualmente:</p>
              <Slider
                value={[currentProgress]}
                max={100}
                step={5}
                onValueChange={(value) => updateProgressMutation.mutate(value[0])}
                className="mb-2"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Course Content */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-5 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Map className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold">Ruta de aprendizaje</h3>
                <p className="text-blue-100 text-xs">Unidades • Módulos • Lecciones</p>
              </div>
            </div>
            <p className="text-blue-100 text-sm">
              Aprende a tu ritmo siguiendo lecciones cortas interactivas. Completa todas las lecciones y aprueba las mini evaluaciones para desbloquear el examen final.
            </p>
          </div>
          <CardContent className="p-4">
            <Button
              className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:opacity-90 text-white font-semibold"
              onClick={() => window.location.href = createPageUrl(`CourseMap?id=${subjectId}`)}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Ver ruta de aprendizaje
            </Button>
          </CardContent>
        </Card>

        {/* Prueba de la materia */}
        <Card className={`border-0 shadow-lg ${testPassed ? 'border-green-200 bg-green-50/50' : ''}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Prueba de la Materia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testPassed ? (
              <div className="flex items-center gap-3 text-green-700">
                <Trophy className="w-8 h-8 text-green-500" />
                <div>
                  <p className="font-semibold">¡Materia Aprobada!</p>
                  <p className="text-sm">Calificación final: <span className="font-bold">{finalGrade}%</span></p>
                </div>
              </div>
            ) : testBlocked ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-red-700 bg-red-50 rounded-lg p-4">
                  <AlertCircle className="w-8 h-8 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Prueba Bloqueada</p>
                    <p className="text-sm">Has agotado los 3 intentos. Para presentarla de nuevo necesitas un folio de prueba extraordinaria.</p>
                  </div>
                </div>
                <ExtraordinaryFolioValidator
                  subjectId={subjectId}
                  userEmail={user?.email}
                  onUnlocked={handleExtraordinaryUnlocked}
                />
              </div>
            ) : !isCompleted ? (
              <div className="flex items-center gap-3 text-gray-500">
                <Lock className="w-6 h-6" />
                <p className="text-sm">Completa el 100% del contenido para desbloquear la prueba.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  La prueba tiene 3 intentos máximo. Necesitas al menos 70% para aprobar.
                </p>
                {testAttempts > 0 && finalGrade !== undefined && (
                  <p className="text-sm text-orange-700 font-medium">
                    Última calificación obtenida: <span className="font-bold">{finalGrade}%</span> — Intento {testAttempts} de 3
                  </p>
                )}
                <p className="text-sm text-gray-500">Intentos restantes: <span className="font-semibold">{attemptsLeft}</span></p>
                <Button className="w-full" onClick={() => setTakingTest(true)}>
                  Iniciar Prueba
                </Button>
              </div>
            )}
          </CardContent>
        </Card>



        {/* Description */}
        {subject.description && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Descripción</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">{subject.description}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}