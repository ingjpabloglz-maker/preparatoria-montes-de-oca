import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { event_id, event_type, event_data = {} } = body;

  if (!event_id || !event_type) {
    return Response.json({ error: 'event_id and event_type are required' }, { status: 400 });
  }

  const user_email = user.email;

  // ─── 1. IDEMPOTENCIA ────────────────────────────────────────────────────────
  const existing = await base44.asServiceRole.entities.ProcessedEvent.filter({ event_id });
  if (existing.length > 0) {
    return Response.json({ status: 'already_processed' });
  }

  // ─── 2. ANTI-FRAUDE: Rate limiting ─────────────────────────────────────────
  const nowIso = new Date().toISOString();
  const currentMinute = nowIso.substring(0, 16); // "2026-03-22T10:05"

  let metrics = null;
  const metricsArr = await base44.asServiceRole.entities.UserMetrics.filter({ user_email });
  metrics = metricsArr[0] || null;

  if (metrics) {
    if (metrics.last_event_minute === currentMinute) {
      if ((metrics.events_this_minute || 0) >= 10) {
        return Response.json({ error: 'Too many requests' }, { status: 429 });
      }
    }
  }

  // ─── 3. ANTI-FRAUDE: Duración mínima de actividad ──────────────────────────
  const MIN_DURATION_SECONDS = 10;
  if (event_data.activity_duration_seconds !== undefined &&
      event_data.activity_duration_seconds < MIN_DURATION_SECONDS) {
    return Response.json({ error: 'Activity too short' }, { status: 400 });
  }

  // ─── 4. ANTI-FRAUDE: No duplicar lección ya completada ─────────────────────
  if (event_type === 'lesson_completed' && event_data.lesson_id) {
    const prevProgress = await base44.asServiceRole.entities.LessonProgress.filter({
      user_email,
      lesson_id: event_data.lesson_id
    });
    if (prevProgress.length > 0 && prevProgress[0].completed) {
      // Registrar como procesado y salir sin duplicar
      await base44.asServiceRole.entities.ProcessedEvent.create({
        event_id, user_email, event_type, processed_at: nowIso
      });
      return Response.json({ status: 'already_completed', message: 'Lesson already completed' });
    }
  }

  // ─── 5. ACTUALIZAR GAMIFICATION ─────────────────────────────────────────────
  const gamArr = await base44.asServiceRole.entities.GamificationProfile.filter({ user_email });
  let gam = gamArr[0] || null;
  const today = new Date().toISOString().split('T')[0];

  // Para surprise_exam_completed, el score viene en event_data
  // XP = score * 0.5, water = floor(score / 20), como calculaba submitSurpriseExam
  const score = event_data.score || 0;
  const isSurpriseExam = event_type === 'surprise_exam_completed';

  // Puntos base por evento
  const XP_MAP = {
    lesson_completed: 20,
    mini_eval_passed: 40,
    subject_test_passed: 100,
    activity_submitted: 5,
    surprise_exam_completed: Math.round(score * 0.5),
  };
  const STARS_MAP = {
    lesson_completed: 1,
    mini_eval_passed: 2,
    subject_test_passed: 3,
    surprise_exam_completed: 0,
  };
  const WATER_MAP = {
    lesson_completed: 1,
    mini_eval_passed: 2,
    subject_test_passed: 5,
    surprise_exam_completed: Math.floor(score / 20),
  };

  const baseXP = XP_MAP[event_type] || 5;
  const baseStars = STARS_MAP[event_type] || 0;
  const baseWater = WATER_MAP[event_type] || 0;

  let newStreakDays = gam?.streak_days || 0;
  let streakBroke = false;

  if (gam) {
    const lastDate = gam.last_study_date_normalized;
    if (lastDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastDate === yesterdayStr) {
        newStreakDays = (gam.streak_days || 0) + 1;
      } else if (lastDate < yesterdayStr) {
        newStreakDays = 1;
        streakBroke = (gam.streak_days || 0) > 1;
      }
      // Si lastDate === today, no cambiamos la racha
    } else {
      newStreakDays = 1;
    }
  } else {
    newStreakDays = 1;
  }

  // Multiplicador con cap x2
  const multiplier = Math.min(1 + (newStreakDays / 20), 2);
  const earnedXP = Math.round(baseXP * multiplier);

  const newXP = (gam?.xp_points || 0) + earnedXP;
  const newStars = (gam?.total_stars || 0) + baseStars;
  const newWater = (gam?.water_tokens || 0) + baseWater;
  const newMaxStreak = Math.max(gam?.max_streak || 0, newStreakDays);

  // Nivel con curva progresiva
  const newLevel = Math.max(1, Math.floor(Math.sqrt(newXP / 10)));
  const leveledUp = newLevel > (gam?.level || 1);

  // Actualizar answered_surprise_questions_ids si es examen sorpresa
  let surpriseIds = gam?.answered_surprise_questions_ids || [];
  let lastSurpriseExamDate = gam?.last_surprise_exam_date_normalized || null;

  if (isSurpriseExam && event_data.question_ids?.length) {
    surpriseIds = [...surpriseIds, ...event_data.question_ids];
    if (surpriseIds.length > 100) surpriseIds = surpriseIds.slice(-100);
    lastSurpriseExamDate = today;
  } else if (surpriseIds.length > 100) {
    surpriseIds = surpriseIds.slice(-100);
  }

  const gamUpdate = {
    user_email,
    streak_days: newStreakDays,
    last_study_date_normalized: today,
    max_streak: newMaxStreak,
    total_stars: newStars,
    water_tokens: newWater,
    xp_points: newXP,
    level: newLevel,
    answered_surprise_questions_ids: surpriseIds,
    email_notifications_enabled: gam?.email_notifications_enabled !== false,
    last_surprise_exam_date_normalized: lastSurpriseExamDate,
  };

  if (gam) {
    await base44.asServiceRole.entities.GamificationProfile.update(gam.id, gamUpdate);
  } else {
    await base44.asServiceRole.entities.GamificationProfile.create(gamUpdate);
  }

  // ─── 6. EVALUAR LOGROS ──────────────────────────────────────────────────────
  // Determinar todos los event_keys aplicables en este evento
  const applicableKeys = [event_type];

  // Logros de racha por hito
  const streakMilestones = [3, 7, 14, 30];
  for (const milestone of streakMilestones) {
    if (newStreakDays >= milestone) applicableKeys.push(`streak_${milestone}`);
  }

  // Logros de estrellas por hito
  const starMilestones = [10, 50, 100];
  for (const milestone of starMilestones) {
    if (newStars >= milestone) applicableKeys.push(`stars_${milestone}`);
  }

  // Obtener todos los logros aplicables (por condition_key)
  const allAchievements = await base44.asServiceRole.entities.Achievement.list();
  const applicableAchs = allAchievements.filter(a => applicableKeys.includes(a.condition_key));

  const userAchievements = await base44.asServiceRole.entities.UserAchievement.filter({ user_email });
  const unlockedIds = userAchievements.filter(u => u.is_unlocked).map(u => u.achievement_id);

  const newlyUnlocked = [];

  for (const ach of applicableAchs) {
    if (unlockedIds.includes(ach.id)) continue;

    const existing_ua = userAchievements.find(u => u.achievement_id === ach.id);

    // Logros de hito (streak_X, stars_X, surprise_exam_completed) se desbloquean directo cuando se cumple la condición
    const isThresholdType = ach.condition_key.startsWith('streak_') || ach.condition_key.startsWith('stars_');
    let currentProgress, shouldUnlock;

    if (isThresholdType) {
      currentProgress = 1;
      shouldUnlock = true;
    } else {
      currentProgress = (existing_ua?.progress_current || 0) + 1;
      const target = ach.condition_value || 1;
      shouldUnlock = currentProgress >= target;
    }

    const target = ach.condition_value || 1;

    if (existing_ua) {
      await base44.asServiceRole.entities.UserAchievement.update(existing_ua.id, {
        progress_current: currentProgress,
        progress_target: target,
        is_unlocked: shouldUnlock,
        unlocked_date: shouldUnlock ? nowIso : existing_ua.unlocked_date,
      });
    } else {
      await base44.asServiceRole.entities.UserAchievement.create({
        user_email,
        achievement_id: ach.id,
        progress_current: currentProgress,
        progress_target: target,
        is_unlocked: shouldUnlock,
        unlocked_date: shouldUnlock ? nowIso : undefined,
      });
    }

    if (shouldUnlock) {
      newlyUnlocked.push({ name: ach.name, icon_name: ach.icon_name, rarity: ach.rarity });
    }
  }

  // ─── 7. ACTUALIZAR MÉTRICAS ─────────────────────────────────────────────────
  const eventsThisMinute = metrics?.last_event_minute === currentMinute
    ? (metrics.events_this_minute || 0) + 1
    : 1;

  const metricUpdate = {
    user_email,
    last_event_minute: currentMinute,
    events_this_minute: eventsThisMinute,
    total_events_processed: (metrics?.total_events_processed || 0) + 1,
    last_updated: nowIso,
    total_streak_breaks: (metrics?.total_streak_breaks || 0) + (streakBroke ? 1 : 0),
    last_daily_active: nowIso,
    total_days_active: metrics?.last_daily_active?.split('T')[0] !== today
      ? (metrics?.total_days_active || 0) + 1
      : (metrics?.total_days_active || 0),
  };

  if (metrics) {
    await base44.asServiceRole.entities.UserMetrics.update(metrics.id, metricUpdate);
  } else {
    await base44.asServiceRole.entities.UserMetrics.create(metricUpdate);
  }

  // ─── 8. REGISTRAR EVENTO ────────────────────────────────────────────────────
  await base44.asServiceRole.entities.ProcessedEvent.create({
    event_id, user_email, event_type, processed_at: nowIso
  });

  return Response.json({
    status: 'ok',
    streak_days: newStreakDays,
    streak_broke: streakBroke,
    xp_earned: earnedXP,
    total_xp: newXP,
    total_stars: newStars,
    level: newLevel,
    leveled_up: leveledUp,
    newly_unlocked_achievements: newlyUnlocked,
    multiplier,
    // Perfil completo actualizado para actualización optimista del cache
    gamificationProfile: {
      ...gamUpdate,
    },
  });
});