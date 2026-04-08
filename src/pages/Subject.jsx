import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, BookOpen, CheckCircle2, FileText,
  Lock, Trophy, AlertCircle, AlertTriangle, Loader2, Map
} from "lucide-react";
import SubjectTest from '../components/tests/SubjectTest';
import ExtraordinaryFolioValidator from '../components/payment/ExtraordinaryFolioValidator';

export default function Subject() {
  const urlParams = new URLSearchParams(window.location.search);
  const subjectId = urlParams.get('id');

  const [user, setUser] = useState(null);
  const [takingTest, setTakingTest] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: subject } = useQuery({
    queryKey: ['subject', subjectId],
    queryFn: async () => {
      const subjects = await base44.entities.Subject.filter({ id: subjectId });
      return subjects[0];
    },
    enabled: !!subjectId,
  });

  // ─── Estado de evaluación: fuente de verdad es el BACKEND ────────────────────
  const { data: evalStatus, isLoading: evalLoading, refetch: refetchEvalStatus } = useQuery({
    queryKey: ['evalStatus', user?.email, subjectId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEvaluationStatus', { subject_id: subjectId });
      return res.data;
    },
    enabled: !!user?.email && !!subjectId,
  });

  const handleTestComplete = useCallback(async () => {
    setTakingTest(false);
    await refetchEvalStatus();
    queryClient.invalidateQueries(['subject']);
  }, [refetchEvalStatus, queryClient]);

  const handleExtraordinaryUnlocked = useCallback(async () => {
    await refetchEvalStatus();
  }, [refetchEvalStatus]);

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

  // Extraer estado del backend — el frontend SOLO refleja, no calcula
  const progress = evalStatus?.progress_percent || 0;
  const isCompleted = evalStatus?.is_completed || false;
  const testPassed = evalStatus?.test_passed || false;
  const finalGrade = evalStatus?.final_grade ?? null;
  const testAttempts = evalStatus?.test_attempts || 0;
  const attemptsLeft = evalStatus?.attempts_left ?? 3;
  const isBlocked = evalStatus?.is_blocked || false;
  const canTakeExam = evalStatus?.can_take_exam || false;
  const requiresReinforcement = evalStatus?.requires_reinforcement || false;
  const errorsNoted = evalStatus?.errors_noted || [];

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
        <Card className="border-0 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-5 text-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg">Tu progreso</h3>
              <span className="text-3xl font-bold">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3 bg-white/30 [&>div]:bg-white mb-2" />
            <p className="text-blue-200 text-sm">
              {progress === 0 && 'Vas comenzando — ¡da el primer paso!'}
              {progress > 0 && progress < 30 && 'Buen inicio, sigue así'}
              {progress >= 30 && progress < 70 && 'Vas a buen ritmo 🔥'}
              {progress >= 70 && progress < 100 && '¡Casi completas esta materia!'}
              {progress >= 100 && '¡Contenido completado! Presenta tu prueba'}
            </p>
          </div>
        </Card>

        {/* Señal de refuerzo académico (mini_eval) */}
        {requiresReinforcement && (
          <Card className="border-yellow-300 bg-yellow-50/60 border-0 shadow">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-yellow-800 text-sm">Señal de refuerzo académico</p>
                <p className="text-yellow-700 text-xs mt-0.5">
                  Has presentado varias veces las mini evaluaciones sin aprobar. Te recomendamos repasar el contenido antes de continuar.
                </p>
                {errorsNoted.length > 0 && (
                  <p className="text-yellow-700 text-xs mt-1">
                    Temas a reforzar: <span className="font-medium">{errorsNoted.join(', ')}</span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Prueba Final */}
        <Card className={`border-0 shadow-lg ${testPassed ? 'border-green-200 bg-green-50/50' : ''}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Prueba de la Materia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evalLoading ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Verificando estado...</span>
              </div>
            ) : testPassed ? (
              <div className="flex items-center gap-3 text-green-700">
                <Trophy className="w-8 h-8 text-green-500" />
                <div>
                  <p className="font-semibold">¡Materia Aprobada!</p>
                  <p className="text-sm">Calificación final: <span className="font-bold">{finalGrade}%</span></p>
                </div>
              </div>
            ) : isBlocked ? (
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
                {testAttempts > 0 && finalGrade !== null && (
                  <p className="text-sm text-orange-700 font-medium">
                    Última calificación: <span className="font-bold">{finalGrade}%</span> — Intento {testAttempts} de 3
                  </p>
                )}
                <p className="text-sm text-gray-500">
                  Intentos restantes: <span className="font-semibold">{attemptsLeft}</span>
                </p>
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