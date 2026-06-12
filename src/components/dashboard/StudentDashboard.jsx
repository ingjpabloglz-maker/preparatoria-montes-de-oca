import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GraduationCap, BookOpen, Flame } from "lucide-react";
import { AlertCircle, Lock } from "lucide-react";

import LevelCard from './LevelCard';
import StatsOverview from './StatsOverview';
import SubjectCard from './SubjectCard';
import HeroBanner from './HeroBanner';
import NextStepCard from './NextStepCard';
import FolioValidator from '@/components/payment/FolioValidator';
import WeeklyGoal from '@/components/gamification/WeeklyGoal';
import WeeklyGoalSetupModal from '@/components/gamification/WeeklyGoalSetupModal';
import AchievementToast from '@/components/gamification/AchievementToast';
import AssistantBubble from '@/components/assistant/AssistantBubble';

import { useGamificationProfile } from '@/hooks/useGamification';
import { useAssistant } from '@/hooks/useAssistant';
import { getStreakStatus } from '@/lib/streakStatus';
import { dispatchAssistantEvent } from '@/lib/assistantEvents';
import { toast } from 'sonner';

// Este componente SOLO se monta para role === 'user'.
// Toda la lógica LMS, gamificación, observers y polling vive aquí.
export default function StudentDashboard({ user }) {
  const queryClient = useQueryClient();

  const { data: levels = [], isLoading: loadingLevels } = useQuery({
    queryKey: ['levels'],
    queryFn: () => base44.entities.LevelConfig.list('level_number'),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list('level'),
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userProgressArr, isLoading: loadingProgress } = useQuery({
    queryKey: ['userProgress', user.email],
    queryFn: () => base44.entities.UserProgress.filter({ user_email: user.email }),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: subjectProgress = [], isLoading: loadingSubjectProgress } = useQuery({
    queryKey: ['subjectProgress', user.email],
    queryFn: () => base44.entities.SubjectProgress.filter({ user_email: user.email }),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: userPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['userPayments', user.email],
    queryFn: () => base44.entities.Payment.filter({ user_email: user.email }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: gamProfile, refetch: refetchGamProfile } = useGamificationProfile(user.email);

  const { data: userProfileArr } = useQuery({
    queryKey: ['userProfile', user.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_email: user.email }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const userProfile = userProfileArr?.[0];
  const displayUser = userProfile?.nombres
    ? { ...user, full_name: [userProfile.nombres, userProfile.apellido_paterno, userProfile.apellido_materno].filter(Boolean).join(' ') }
    : user;

  // ── Estado del modal de metas semanales (guards anti-loop) ────────────────
  const [showGoalModal, setShowGoalModal] = React.useState(false);
  const [goalModalDismissed, setGoalModalDismissed] = React.useState(false);
  const [goalModalPending, setGoalModalPending] = React.useState(false);
  const [goalNumberInCycle, setGoalNumberInCycle] = React.useState(1);
  const [activeGoalSession, setActiveGoalSession] = React.useState(null);

  // Cargar sesión activa de WeeklyGoalSession
  const { data: activeGoalSessions } = useQuery({
    queryKey: ['weeklyGoalSession', user.email],
    queryFn: () => base44.entities.WeeklyGoalSession.filter({ user_email: user.email, archived: false }),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (!activeGoalSessions) return;
    const now = new Date();
    // Filtrar sesiones no expiradas
    const valid = activeGoalSessions.filter(s => new Date(s.expires_at) > now);
    setActiveGoalSession(valid[0] || null);
  }, [activeGoalSessions]);

  // Abrir modal automáticamente si no hay sesión activa válida y no fue descartado
  React.useEffect(() => {
    if (!gamProfile || goalModalDismissed || goalModalPending || !activeGoalSessions) return;
    const now = new Date();
    const hasValid = activeGoalSessions.some(s => new Date(s.expires_at) > now);
    if (!hasValid) {
      // Calcular cuántas metas completadas en el ciclo actual para mostrar recompensas correctas
      setGoalNumberInCycle((activeGoalSessions.length ?? 0) + 1);
      setShowGoalModal(true);
    }
  }, [gamProfile?.user_email, activeGoalSessions, goalModalDismissed, goalModalPending]);

  const { message: assistantMsg, visible: assistantVisible, dismiss: dismissAssistant, handleCTA: assistantHandleCTA } = useAssistant({
    userEmail: user.email,
    profile: gamProfile,
    allowedPages: ['Dashboard', 'Rewards'],
    currentPage: 'Dashboard',
  });

  // Saludo de login: una vez por sesión
  useEffect(() => {
    if (!gamProfile) return;
    const sessionKey = `login_greeted_${new Date().toDateString()}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');
    const t = setTimeout(() => {
      dispatchAssistantEvent('login', { name: user.full_name, profile: gamProfile });
    }, 300);
    return () => clearTimeout(t);
  }, [user.email, gamProfile?.user_email]);

  // Toast de racha: una vez por sesión
  useEffect(() => {
    if (!gamProfile) return;
    const status = getStreakStatus(gamProfile.last_study_date_normalized);
    const streakDays = gamProfile.streak_days || 0;
    const toastKey = `streak_toast_${new Date().toDateString()}`;
    if (sessionStorage.getItem(toastKey)) return;
    sessionStorage.setItem(toastKey, '1');
    if (status === 'lost' && streakDays > 0) {
      toast.error(`Perdiste tu racha de ${streakDays} días 💔`, { duration: 5000 });
    } else if (status === 'at_risk') {
      toast.warning('⚠️ Tu racha está en riesgo. ¡Estudia hoy!', { duration: 5000 });
    }
  }, [gamProfile?.last_study_date_normalized]);

  // ── Todos los hooks ANTES de cualquier early return (Rules of Hooks) ──────────
  const progress = userProgressArr?.[0];
  const currentLevel = progress?.current_level || 1;

  const daysRemaining = useMemo(() => {
    if (!progress?.expires_at) return null;
    const expiresAt = new Date(progress.expires_at);
    return Math.max(0, Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24)));
  }, [progress?.expires_at]);

  const daysInLevel = useMemo(() => {
    if (!progress?.level_start_date) return 0;
    return Math.floor((new Date() - new Date(progress.level_start_date)) / (1000 * 60 * 60 * 24));
  }, [progress?.level_start_date]);

  const profileComplete = user?.nombres && user?.apellido_paterno && user?.telefono_personal && user?.correo_contacto;

  const hasLevel1Folio = useMemo(
    () => userPayments.some(p => p.level === 1 && p.folio_type === 'level_advance' && p.status === 'used'),
    [userPayments]
  );

  const subjectsByLevel = useMemo(() => subjects.reduce((acc, subject) => {
    if (!acc[subject.level]) acc[subject.level] = [];
    acc[subject.level].push(subject);
    return acc;
  }, {}), [subjects]);

  const currentLevelSubjects = useMemo(
    () => subjectsByLevel[currentLevel] || [],
    [subjectsByLevel, currentLevel]
  );

  const completedSubjectsCount = useMemo(
    () => subjectProgress.filter(p => p.test_passed).length,
    [subjectProgress]
  );

  const totalSubjectsCount = subjects.length;

  const totalProgress = useMemo(() => totalSubjectsCount > 0
    ? Math.min(100, subjectProgress.reduce((sum, p) => sum + Math.min(100, p.progress_percent || 0), 0) / totalSubjectsCount)
    : 0,
  [subjectProgress, totalSubjectsCount]);

  const nextSubject = useMemo(() => {
    if (!currentLevelSubjects.length) return null;
    const inProgress = currentLevelSubjects.find(s => {
      const sp = subjectProgress.find(p => p.subject_id === s.id);
      const pct = sp?.progress_percent || 0;
      return pct > 0 && pct < 100 && !sp?.test_passed;
    });
    if (inProgress) {
      const sp = subjectProgress.find(p => p.subject_id === inProgress.id);
      return { ...inProgress, progress: sp?.progress_percent || 0 };
    }
    const pending = currentLevelSubjects.find(s => {
      const sp = subjectProgress.find(p => p.subject_id === s.id);
      return !sp?.test_passed && (sp?.progress_percent || 0) === 0;
    });
    if (pending) return { ...pending, progress: 0 };
    const sp0 = subjectProgress.find(p => p.subject_id === currentLevelSubjects[0].id);
    return { ...currentLevelSubjects[0], progress: sp0?.progress_percent || 0 };
  }, [currentLevelSubjects, subjectProgress]);

  const getLevelProgress = useCallback((levelNum) => {
    const levelSubjects = subjectsByLevel[levelNum] || [];
    if (levelSubjects.length === 0) return 0;
    if (levelNum < currentLevel) return 100;
    const progressSum = levelSubjects.reduce((sum, subject) => {
      const sp = subjectProgress.find(p => p.subject_id === subject.id);
      return sum + (sp?.test_passed ? 100 : sp?.progress_percent || 0);
    }, 0);
    return progressSum / levelSubjects.length;
  }, [subjectsByLevel, currentLevel, subjectProgress]);

  const handleTimeUnlockSuccess = useCallback(async () => {
    if (progress) {
      const levelConfig = levels.find(l => l.level_number === currentLevel);
      if (!levelConfig?.time_limit_days) { window.location.reload(); return; }
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + levelConfig.time_limit_days);
      await base44.entities.UserProgress.update(progress.id, {
        expires_at: newExpiresAt.toISOString(),
        blocked_due_to_time: false,
      });
    }
    window.location.reload();
  }, [progress, levels, currentLevel]);

  const goToNextSubject = useCallback(() => {
    if (!profileComplete) { window.location.href = createPageUrl('Profile'); return; }
    if (currentLevel === 1 && !hasLevel1Folio) { window.location.href = createPageUrl('UnlockLevel?level=1'); return; }
    if (nextSubject) {
      window.location.href = createPageUrl(`Subject?id=${nextSubject.id}`);
    } else {
      window.location.href = createPageUrl(`Level?level=${currentLevel}`);
    }
  }, [profileComplete, currentLevel, hasLevel1Folio, nextSubject]);

  // ── Derived values (no hooks, pueden ir aquí) ─────────────────────────────
  const isBlockedByTime = progress?.blocked_due_to_time === true || (daysRemaining !== null && daysRemaining === 0);

  // ── Early returns DESPUÉS de todos los hooks ──────────────────────────────
  if (loadingLevels || loadingSubjects || loadingProgress || loadingSubjectProgress || loadingPayments) {
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

  // Pantalla de bloqueo: folio nivel 1
  if (profileComplete && currentLevel === 1 && !hasLevel1Folio) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Bienvenido al Nivel 1</h2>
        <p className="text-gray-500 mb-8 text-center max-w-md">
          Para iniciar tu primer nivel necesitas ingresar un folio de pago.
          Comunícate con la administración escolar para obtenerlo.
        </p>
        <div className="w-full max-w-md">
          <FolioValidator levelToUnlock={1} userEmail={user.email} folioType="level_advance" onSuccess={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  // Pantalla de bloqueo: tiempo agotado
  if (isBlockedByTime) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Tiempo del Nivel {currentLevel} Agotado</h2>
        <p className="text-gray-500 mb-8 text-center max-w-md">
          El tiempo asignado para el Nivel {currentLevel} ha expirado.
          Ingresa un folio de desbloqueo para continuar con tu progreso actual.
        </p>
        <div className="w-full max-w-md">
          <FolioValidator levelToUnlock={currentLevel} userEmail={user.email} folioType="time_unlock" onSuccess={handleTimeUnlockSuccess} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* AchievementToast: SOLO aquí, nunca en el Layout global */}
      <AchievementToast userEmail={user.email} />
      <AssistantBubble message={assistantMsg} visible={assistantVisible} onDismiss={dismissAssistant} onCTA={assistantHandleCTA} />

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Alerta perfil incompleto */}
        {!profileComplete && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">Completa tu información personal</p>
              <p className="text-sm text-amber-700 mt-0.5">Debes llenar tu perfil antes de poder iniciar los niveles.</p>
            </div>
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white flex-shrink-0"
              onClick={() => window.location.href = createPageUrl('Profile')}>
              Ir a Mi Perfil
            </Button>
          </div>
        )}

        {/* Banner racha en riesgo */}
        {gamProfile && getStreakStatus(gamProfile.last_study_date_normalized) === 'at_risk' && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 flex items-center gap-3">
            <Flame className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <p className="font-semibold text-yellow-800 flex-1">⚠️ Tu racha está en riesgo. Estudia hoy para mantenerla.</p>
          </div>
        )}

        <HeroBanner user={displayUser} gamProfile={gamProfile} nextSubject={nextSubject} onContinue={goToNextSubject} />

        {showGoalModal && !goalModalPending && (
          <WeeklyGoalSetupModal
            goalNumberInCycle={goalNumberInCycle}
            onComplete={(data) => {
              setShowGoalModal(false);
              setGoalModalPending(false);
              queryClient.invalidateQueries({ queryKey: ['weeklyGoalSession', user.email] });
              refetchGamProfile();
            }}
            onDismiss={() => {
              setShowGoalModal(false);
              setGoalModalDismissed(true);
            }}
          />
        )}

        <NextStepCard nextSubject={nextSubject} onGo={goToNextSubject} />

        {(activeGoalSession || gamProfile?.weekly_goal_target) && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <WeeklyGoal
                profile={gamProfile}
                activeGoalSession={activeGoalSession}
                onNewGoal={() => {
                  const nextGoalNum = (activeGoalSessions?.length ?? 0) + 1;
                  setGoalNumberInCycle(nextGoalNum);
                  setGoalModalDismissed(false);
                  setGoalModalPending(false);
                  setShowGoalModal(true);
                }}
              />
            </CardContent>
          </Card>
        )}

        <StatsOverview
          currentLevel={currentLevel}
          totalProgress={totalProgress}
          completedSubjects={completedSubjectsCount}
          totalSubjects={totalSubjectsCount}
          daysInLevel={daysInLevel}
          daysRemaining={daysRemaining}
        />

        {/* Materias del nivel actual */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                {completedSubjectsCount === currentLevelSubjects.length && currentLevelSubjects.length > 0
                  ? '¡Completaste todas las materias de este nivel!'
                  : `Te ${currentLevelSubjects.length - completedSubjectsCount === 1 ? 'falta 1 materia' : `faltan ${currentLevelSubjects.length - completedSubjectsCount} materias`} para avanzar`
                }
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {daysRemaining !== null ? `${daysRemaining} días restantes en el Nivel ${currentLevel}` : `Nivel ${currentLevel} · En curso`}
              </p>
            </div>
            <Button variant="outline" size="sm"
              onClick={() => window.location.href = createPageUrl(`Level?level=${currentLevel}`)}>
              Ver nivel completo
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentLevelSubjects.map((subject, idx) => {
              const sp = subjectProgress.find(p => p.subject_id === subject.id);
              const testStatus = sp?.test_passed ? 'aprobado' : sp?.test_attempts > 0 ? 'no_aprobado' : 'pendiente';
              return (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  progress={sp?.progress_percent || 0}
                  isCompleted={sp?.test_passed || false}
                  testStatus={testStatus}
                  index={idx}
                  onClick={goToNextSubject}
                />
              );
            })}
          </div>
        </div>

        {/* Todos los niveles */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <GraduationCap className="w-6 h-6" />
            Tu camino completo
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map((levelNum) => {
              const levelConfig = levels.find(l => l.level_number === levelNum) || { level_number: levelNum, name: `Nivel ${levelNum}` };
              const isUnlocked = levelNum <= currentLevel;
              const isCompleted = levelNum < currentLevel;
              const isCurrent = levelNum === currentLevel;
              // onClick estable por nivel: no se recrea si profileComplete/currentLevel/levelNum no cambian
              const handleLevelClick = isUnlocked
                ? () => {
                    if (!profileComplete) { window.location.href = createPageUrl('Profile'); return; }
                    window.location.href = createPageUrl(
                      (isCurrent || isCompleted) ? `Level?level=${levelNum}` : `UnlockLevel?level=${levelNum}`
                    );
                  }
                : undefined;
              return (
                <LevelCard
                  key={levelNum}
                  level={levelConfig}
                  isUnlocked={isUnlocked}
                  isCompleted={isCompleted}
                  isCurrent={isCurrent}
                  progress={getLevelProgress(levelNum)}
                  subjects={subjectsByLevel[levelNum] || []}
                  daysRemaining={isCurrent ? daysRemaining : undefined}
                  onClick={handleLevelClick}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}