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

  // ─── 4. (reservado) ─────────────────────────────────────────────────────────
  // La idempotencia ya está garantizada por el event_id único en el paso 1.

  // ─── 5. CREAR/OBTENER UserProgress ─────────────────────────────────────────
  const upArr = await base44.asServiceRole.entities.UserProgress.filter({ user_email });
  let userProgressRecord = upArr[0] || null;

  if (!userProgressRecord) {
    userProgressRecord = await base44.asServiceRole.entities.UserProgress.create({
      user_email,
      current_level: 1,
      level_start_date: nowIso,
      blocked_due_to_time: false,
    });
  }

  // ─── 6. ACTUALIZAR GAMIFICATION ─────────────────────────────────────────────
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

  // ─── ÁRBOL DEL CONOCIMIENTO ──────────────────────────────────────────────────
  const TREE_THRESHOLDS = [0, 5, 15, 30, 60, 100];
  const prevTreeStage = gam?.tree_stage ?? 0;
  let newTreeStage = prevTreeStage;
  for (let i = TREE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (newWater >= TREE_THRESHOLDS[i]) { newTreeStage = i; break; }
  }
  const treeLevelUp = newTreeStage > prevTreeStage;

  // ─── META SEMANAL ─────────────────────────────────────────────────────────────
  // Obtener inicio de semana actual (lunes)
  const nowDate = new Date();
  const dayOfWeek = nowDate.getDay(); // 0=Dom, 1=Lun ... 6=Sab
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  const thisMonday = new Date(nowDate);
  thisMonday.setDate(nowDate.getDate() + diffToMonday);
  const thisMondayStr = thisMonday.toISOString().split('T')[0];

  let weeklyProgress = gam?.weekly_goal_progress ?? 0;
  const weeklyTarget = gam?.weekly_goal_target ?? 10;
  const prevWeeklyStart = gam?.weekly_goal_start_date ?? null;
  let weeklyStartDate = prevWeeklyStart ?? thisMondayStr;
  let weeklyGoalJustCompleted = false;

  // Resetear si es una nueva semana
  if (prevWeeklyStart !== thisMondayStr) {
    weeklyProgress = 0;
    weeklyStartDate = thisMondayStr;
  }

  if (event_type === 'lesson_completed') {
    weeklyProgress += 1;
    if (weeklyProgress === weeklyTarget) {
      weeklyGoalJustCompleted = true;
      // Bonus XP por completar meta semanal (ya se suma al newXP si modificamos earnedXP antes, pero aquí lo hacemos via gamUpdate)
    }
  }

  // Fórmula de nivel: level = floor(sqrt(xp / 10)), mínimo 1
  const getLevelFromXP = (xp) => Math.max(1, Math.floor(Math.sqrt(xp / 10)));
  const getLevelXPRange = (lvl) => {
    const minXP = Math.pow(lvl, 2) * 10;
    const nextLevelXP = Math.pow(lvl + 1, 2) * 10;
    return { minXP, nextLevelXP };
  };

  // Calcular nivel actual en base al XP total
  let newLevel = getLevelFromXP(newXP);
  newLevel = Math.max(1, newLevel);

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

  // XP bonus por meta semanal completada
  const weeklyBonusXP = weeklyGoalJustCompleted ? 50 : 0;
  const finalXP = newXP + weeklyBonusXP;

  // Recalcular nivel con XP bonus
  let finalLevel = getLevelFromXP(finalXP);
  finalLevel = Math.max(1, finalLevel);

  const gamUpdate = {
    user_email,
    streak_days: newStreakDays,
    last_study_date_normalized: today,
    max_streak: newMaxStreak,
    total_stars: newStars,
    water_tokens: newWater,
    xp_points: finalXP,
    level: finalLevel,
    answered_surprise_questions_ids: surpriseIds,
    email_notifications_enabled: gam?.email_notifications_enabled !== false,
    last_surprise_exam_date_normalized: lastSurpriseExamDate,
    tree_stage: newTreeStage,
    last_tree_update: nowIso,
    weekly_goal_progress: weeklyProgress,
    weekly_goal_target: weeklyTarget,
    weekly_goal_start_date: weeklyStartDate,
  };

  if (gam) {
    await base44.asServiceRole.entities.GamificationProfile.update(gam.id, gamUpdate);
  } else {
    await base44.asServiceRole.entities.GamificationProfile.create(gamUpdate);
  }

  // NOTA: El nivel de XP (gamificación) es independiente del current_level académico.
  // current_level en UserProgress SOLO se actualiza cuando el alumno avanza académicamente,
  // no cuando sube de nivel por XP. Por eso NO se sincroniza aquí.

  // ─── 7. EVALUAR LOGROS ──────────────────────────────────────────────────────
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

  // ─── 8. ACTUALIZAR MÉTRICAS ─────────────────────────────────────────────────
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

  // ─── 9. REGISTRAR EVENTO ────────────────────────────────────────────────────
  await base44.asServiceRole.entities.ProcessedEvent.create({
    event_id, user_email, event_type, processed_at: nowIso
  });

  const { minXP: finalMinXP, nextLevelXP: finalNextXP } = getLevelXPRange(finalLevel);
  const xpIntoLevel = finalXP - finalMinXP;
  const xpNeededForNext = finalNextXP - finalMinXP;
  const progressPercent = Math.max(0, Math.min(100, Math.round((xpIntoLevel / xpNeededForNext) * 100)));

  return Response.json({
    status: 'ok',
    streak_days: newStreakDays,
    streak_broke: streakBroke,
    xp_earned: earnedXP + weeklyBonusXP,
    total_xp: finalXP,
    total_stars: newStars,
    level: finalLevel,
    leveled_up: finalLevel > (gam?.level || 1),
    newly_unlocked_achievements: newlyUnlocked,
    multiplier,
    tree_level_up: treeLevelUp,
    new_tree_stage: newTreeStage,
    weekly_goal_completed: weeklyGoalJustCompleted,
    xp_into_level: xpIntoLevel,
    xp_needed_for_next_level: xpNeededForNext,
    progress_percent: progressPercent,
    gamificationProfile: {
      ...gamUpdate,
    },
  });
});