import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, BookOpen } from "lucide-react";
import ActivityCard from '../components/course/ActivityCard';
import LessonResults from '../components/course/LessonResults';
import LessonIntro from '../components/course/LessonIntro';
import { useUserEvent } from '@/hooks/useUserEvent';
import { dispatchAssistantEvent } from '@/lib/assistantEvents';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import AiTutorChat from '../components/ai/AiTutorChat';

export default function Lesson() {
  const urlParams = new URLSearchParams(window.location.search);
  const lessonId = urlParams.get('id');

  const [user, setUser] = useState(null);
  const [phase, setPhase] = useState('intro'); // 'intro' | 'activity' | 'results'
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [answers, setAnswers] = useState([]); // { activityId, correct, points }
  const queryClient = useQueryClient();
  const { dispatchUserEvent } = useUserEvent(user?.email);

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const { data: lesson } = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => {
      const lessons = await base44.entities.CourseLesson.filter({ id: lessonId });
      return lessons[0];
    },
    enabled: !!lessonId,
    staleTime: 30 * 60 * 1000, // lección es estática
    refetchOnWindowFocus: false,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['lessonActivities', lessonId],
    queryFn: () => base44.entities.CourseActivity.filter({ lesson_id: lessonId }, 'order'),
    enabled: !!lessonId,
    staleTime: 30 * 60 * 1000, // actividades son estáticas
    refetchOnWindowFocus: false,
  });

  const DIFFICULT_SUBJECT_KEYWORDS = ['matemática', 'matematica', 'cálculo', 'calculo', 'álgebra', 'algebra', 'química', 'quimica', 'física', 'fisica', 'trigonometría', 'trigonometria', 'estadística', 'estadistica', 'probabilidad'];

  const { data: lessonSubject } = useQuery({
    queryKey: ['subject', lesson?.subject_id],
    queryFn: () => base44.entities.Subject.filter({ id: lesson.subject_id }).then(r => r[0]),
    enabled: !!lesson?.subject_id,
    staleTime: 30 * 60 * 1000,
  });

  const showAiTutor = lessonSubject
    ? DIFFICULT_SUBJECT_KEYWORDS.some(kw => lessonSubject.name?.toLowerCase().includes(kw))
    : false;

  const { data: existingProgress } = useQuery({
    queryKey: ['lessonProgressItem', user?.email, lessonId],
    queryFn: async () => {
      const prog = await base44.entities.LessonProgress.filter({ user_email: user?.email, lesson_id: lessonId });
      return prog[0] || null;
    },
    enabled: !!user?.email && !!lessonId,
    staleTime: 60 * 1000, // 1 min
    refetchOnWindowFocus: false,
  });

  const saveProgressMutation = useMutation({
    mutationFn: async ({ correct, total, score, passed }) => {
      const data = {
        user_email: user.email,
        lesson_id: lessonId,
        module_id: lesson.module_id,
        subject_id: lesson.subject_id,
        completed: true,
        score,
        passed,
        correct_answers: correct,
        total_questions: total,
        completed_at: new Date().toISOString(),
      };
      if (existingProgress) {
        await base44.entities.LessonProgress.update(existingProgress.id, data);
      } else {
        await base44.entities.LessonProgress.create(data);
      }
    },
    onSuccess: async (_, vars) => {
      queryClient.invalidateQueries(['lessonProgress']);
      queryClient.invalidateQueries(['lessonProgressItem']);

      // Disparar evento de gamificación (useUserEvent ya invalida gamificationProfile y userAchievements)
      const eventType = lesson?.is_mini_eval
        ? (vars.passed ? 'mini_eval_passed' : 'activity_submitted')
        : 'lesson_completed';

      const result = await dispatchUserEvent(eventType, {
        lesson_id: lessonId,
        score: vars.score,
        passed: vars.passed,
        activity_duration_seconds: 30, // mínimo válido
      });

      // Eventos del asistente
      dispatchAssistantEvent('lesson_completed', { score: vars.score });
      if (result?.xp_earned) {
        dispatchAssistantEvent('xp_gained', { xp: result.xp_earned });
      }
      if (result?.leveled_up) {
        dispatchAssistantEvent('level_up', { level: result.level });
      }
      if (result?.streak_days > 1) {
        dispatchAssistantEvent('streak_updated', { streak_days: result.streak_days });
      }
      if (result?.newly_unlocked_achievements?.length > 0) {
        dispatchAssistantEvent('achievement_unlocked', {});
      }

      // Feedback visual
      if (result?.leveled_up) {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        toast.success(`¡Subiste al Nivel ${result.level}! 🎉`, { duration: 4000 });
      } else if (result?.streak_days > 1) {
        toast(`🔥 Racha de ${result.streak_days} días — x${result.multiplier?.toFixed(1)} XP`, { duration: 3000 });
      }
      if (result?.tree_level_up) {
        const STAGE_NAMES = ['Semilla','Brote','Planta joven','Árbol pequeño','Árbol mediano','Árbol frondoso'];
        toast.success(`🌳 ¡Tu árbol creció! ${STAGE_NAMES[result.new_tree_stage]}`, { duration: 3500 });
      }
      if (result?.weekly_goal_completed) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
        toast.success('🎯 ¡Meta semanal completada! +50 XP bonus', { duration: 4000 });
      }
      if (result?.newly_unlocked_achievements?.length > 0) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
      }
    },
  });

  const handleActivityAnswer = (activityId, isCorrect, points) => {
    setAnswers(prev => [...prev, { activityId, correct: isCorrect, points: isCorrect ? points : 0 }]);
  };

  const handleNextActivity = () => {
    if (currentActivityIndex < activities.length - 1) {
      setCurrentActivityIndex(prev => prev + 1);
    } else {
      // Terminar lección
      const correctCount = answers.filter(a => a.correct).length;
      const totalPoints = activities.reduce((s, a) => s + (a.points || 10), 0);
      const earnedPoints = answers.reduce((s, a) => s + a.points, 0);
      const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      const passed = lesson?.is_mini_eval ? score >= 80 : score >= 60;

      saveProgressMutation.mutate({
        correct: correctCount,
        total: activities.length,
        score,
        passed,
      });
      setPhase('results');
    }
  };

  const handleStart = () => {
    setPhase('activity');
    setCurrentActivityIndex(0);
    setAnswers([]);
  };

  const handleGoBack = () => {
    if (lesson) {
      window.location.href = createPageUrl(`CourseMap?id=${lesson.subject_id}`);
    }
  };

  if (!lesson) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentActivity = activities[currentActivityIndex];
  const activityProgress = activities.length > 0
    ? Math.round(((currentActivityIndex) / activities.length) * 100)
    : 0;

  // Calcular resultados finales
  const correctCount = answers.filter(a => a.correct).length;
  const totalPoints = activities.reduce((s, a) => s + (a.points || 10), 0);
  const earnedPoints = answers.reduce((s, a) => s + a.points, 0);
  const finalScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = lesson?.is_mini_eval ? finalScore >= 80 : finalScore >= 60;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-sm border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={handleGoBack}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="flex-1">
            <Progress
              value={phase === 'activity' ? activityProgress : (phase === 'results' ? 100 : 0)}
              className="h-2 bg-white/20"
            />
          </div>
          {phase === 'activity' && (
            <span className="text-xs text-white/60 flex-shrink-0">
              {currentActivityIndex + 1}/{activities.length}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 sm:p-6 pt-8">
        {phase === 'intro' && (
          <LessonIntro
            lesson={lesson}
            activitiesCount={activities.length}
            isMiniEval={lesson.is_mini_eval}
            alreadyCompleted={existingProgress?.completed}
            previousScore={existingProgress?.score}
            onStart={handleStart}
          />
        )}

        {phase === 'activity' && currentActivity && (
          <ActivityCard
            activity={currentActivity}
            activityNumber={currentActivityIndex + 1}
            totalActivities={activities.length}
            onAnswer={handleActivityAnswer}
            onNext={handleNextActivity}
          />
        )}

        {/* Tutor IA (solo materias difíciles, solo en fase de explicación) */}
        {showAiTutor && phase === 'intro' && user && (
          <AiTutorChat lesson={lesson} userEmail={user.email} />
        )}

        {phase === 'results' && (
          <LessonResults
            lesson={lesson}
            correctCount={correctCount}
            totalCount={activities.length}
            score={finalScore}
            passed={passed}
            isMiniEval={lesson.is_mini_eval}
            answers={answers}
            activities={activities}
            onContinue={handleGoBack}
            onRetry={handleStart}
          />
        )}
      </div>
    </div>
  );
}