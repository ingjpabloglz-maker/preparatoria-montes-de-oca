import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ─── UTILIDADES DE FECHA ─────────────────────────────────────────────────────
const getMatamorosDateObject = () => {
  const now = new Date();
  const matamorosTimeParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Matamoros',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const year   = parseInt(matamorosTimeParts.find(p => p.type === 'year').value);
  const month  = parseInt(matamorosTimeParts.find(p => p.type === 'month').value);
  const day    = parseInt(matamorosTimeParts.find(p => p.type === 'day').value);
  const hour   = parseInt(matamorosTimeParts.find(p => p.type === 'hour').value);
  const minute = parseInt(matamorosTimeParts.find(p => p.type === 'minute').value);
  const second = parseInt(matamorosTimeParts.find(p => p.type === 'second').value);

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
};

const getLocalDateString = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Matamoros',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
};

// ─── UTILIDADES DE NIVEL ──────────────────────────────────────────────────────
const getLevelFromXP = (xp) => Math.max(1, Math.floor(Math.sqrt(xp / 10)));

const getLevelXPRange = (lvl) => {
  const minXP = Math.pow(lvl, 2) * 10;
  const nextLevelXP = Math.pow(lvl + 1, 2) * 10;
  return { minXP, nextLevelXP };
};

// ─── BLOQUE 1: Inicializar UserProgress ──────────────────────────────────────
async function initializeUserProgress(base44, user_email, nowIso) {
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
  return userProgressRecord;
}

// ─── BLOQUE 2: Calcular recompensas base por evento ──────────────────────────
function calculateBaseAwards(event_type, event_data) {
  const score = event_data.score || 0;
  const XP_MAP = {
    lesson_completed: 20,
    mini_eval_passed: 40,
    subject_test_passed: 100,
    activity_submitted: 5,
    surprise_exam_completed: Math.round(score * 0.5),
    forum_thread_created: 10,
    forum_post_created: 5,
    forum_solution_earned: 25,
  };
  const STARS_MAP = {
    lesson_completed: 1,
    mini_eval_passed: 2,
    subject_test_passed: 3,
    surprise_exam_completed: 0,
    forum_solution_earned: 1,
  };
  const WATER_MAP = {
    lesson_completed: 1,
    mini_eval_passed: 2,
    subject_test_passed: 5,
    surprise_exam_completed: Math.floor(score / 20),
  };
  return {
    baseXP: XP_MAP[event_type] || 5,
    baseStars: STARS_MAP[event_type] || 0,
    baseWater: WATER_MAP[event_type] || 0,
  };
}

// ─── BLOQUE 3: Calcular racha ─────────────────────────────────────────────────
function calculateStreak(gam, matamorosNow, todayString) {
  let newStreakDays = gam?.streak_days || 0;
  let streakBroke = false;
  let shieldUsed = false;

  if (gam) {
    const lastDate = gam.last_study_date_normalized;
    if (lastDate) {
      // Evento duplicado en el mismo día: no modificar racha
      if (lastDate === todayString) {
        return { newStreakDays: gam.streak_days || 1, streakBroke: false, shieldUsed: false };
      }

      const matamorosYesterday = new Date(matamorosNow);
      matamorosYesterday.setUTCDate(matamorosYesterday.getUTCDate() - 1);
      const yesterdayStr = `${matamorosYesterday.getUTCFullYear()}-${(matamorosYesterday.getUTCMonth() + 1).toString().padStart(2, '0')}-${matamorosYesterday.getUTCDate().toString().padStart(2, '0')}`;

      // Comparación directa de strings YYYY-MM-DD (ordenables lexicográficamente, sin depender de timezone)
      if (lastDate === yesterdayStr) {
        newStreakDays = (gam.streak_days || 0) + 1;
      } else if (lastDate < yesterdayStr) {
        const shields = gam.streak_shields || 0;
        if (shields > 0) {
          newStreakDays = gam.streak_days || 1;
          shieldUsed = true;
        } else {
          newStreakDays = 1;
          streakBroke = (gam.streak_days || 0) > 1;
        }
      }
    } else {
      newStreakDays = 1;
    }
  } else {
    newStreakDays = 1;
  }

  return { newStreakDays, streakBroke, shieldUsed };
}

// ─── BLOQUE 4: Calcular puntos de gamificación ───────────────────────────────
function calculateGamificationPoints(gam, baseXP, baseStars, baseWater, newStreakDays) {
  const multiplier = Math.min(1 + (newStreakDays / 20), 2);
  const earnedXP = Math.round(baseXP * multiplier);
  const newXP = (gam?.xp_points || 0) + earnedXP;
  const newStars = (gam?.total_stars || 0) + baseStars;
  const newWater = (gam?.water_tokens || 0) + baseWater;
  const newMaxStreak = Math.max(gam?.max_streak || 0, newStreakDays);
  return { earnedXP, newXP, newStars, newWater, newMaxStreak, multiplier };
}

// ─── BLOQUE 5: Calcular crecimiento del árbol ────────────────────────────────
function updateTreeGrowth(newWater, gam) {
  const TREE_THRESHOLDS = [0, 5, 15, 30, 60, 100];
  const prevTreeStage = gam?.tree_stage ?? 0;
  let newTreeStage = prevTreeStage;
  for (let i = TREE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (newWater >= TREE_THRESHOLDS[i]) { newTreeStage = i; break; }
  }
  const treeLevelUp = newTreeStage > prevTreeStage;
  return { newTreeStage, treeLevelUp };
}

// ─── BLOQUE 6: Gestionar meta semanal ────────────────────────────────────────
function manageWeeklyGoal(gam, event_type, today, matamorosNow) {
  let weeklyProgress = gam?.weekly_goal_progress ?? 0;
  const weeklyTarget = gam?.weekly_goal_target ?? null;
  const prevWeeklyStart = gam?.weekly_goal_start_date ?? null;
  let weeklyStartDate = prevWeeklyStart;
  let weeklyCompleted = gam?.weekly_goal_completed ?? false;
  let weeklyRewardClaimed = gam?.weekly_goal_reward_claimed ?? false;
  let weeklyGoalJustCompleted = false;
  let weeklyHistory = gam?.weekly_goal_history ?? [];
  let weeklyBonusXP = 0;
  let weeklyBonusStars = 0;

  if (weeklyTarget && prevWeeklyStart) {
    const startMs = new Date(prevWeeklyStart + 'T00:00:00Z').getTime();
    const nowMs = matamorosNow.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const weekExpired = (nowMs - startMs) >= sevenDaysMs;

    if (weekExpired) {
      const endDate = getLocalDateString(new Date(startMs + sevenDaysMs));
      const wasCompleted = weeklyProgress >= weeklyTarget;
      const historyEntry = {
        start_date: prevWeeklyStart,
        end_date: endDate,
        goal: weeklyTarget,
        progress: weeklyProgress,
        completed: wasCompleted,
      };
      weeklyHistory = [...weeklyHistory, historyEntry];
      if (weeklyHistory.length > 52) weeklyHistory = weeklyHistory.slice(-52);

      if (wasCompleted && !weeklyRewardClaimed) {
        weeklyBonusXP = 50;
        weeklyBonusStars = 3;
      }

      weeklyProgress = 0;
      weeklyStartDate = today;
      weeklyCompleted = false;
      weeklyRewardClaimed = false;
    }

    if (event_type === 'lesson_completed') {
      weeklyProgress = Math.min(weeklyProgress + 1, weeklyTarget * 2);
      if (weeklyProgress >= weeklyTarget && !weeklyCompleted) {
        weeklyCompleted = true;
        weeklyGoalJustCompleted = true;
        if (!weeklyRewardClaimed) {
          weeklyBonusXP = 50;
          weeklyBonusStars = 3;
          weeklyRewardClaimed = true;
        }
      }
    }
  }

  return {
    weeklyProgress, weeklyTarget, weeklyStartDate, weeklyCompleted,
    weeklyRewardClaimed, weeklyGoalJustCompleted, weeklyHistory,
    weeklyBonusXP, weeklyBonusStars,
  };
}

// ─── BLOQUE 7: Gestionar datos de examen sorpresa ────────────────────────────
function handleSurpriseExamData(gam, isSurpriseExam, event_data, today) {
  let surpriseIds = gam?.answered_surprise_questions_ids || [];
  let lastSurpriseExamDate = gam?.last_surprise_exam_date_normalized || null;

  if (isSurpriseExam && event_data.question_ids?.length) {
    surpriseIds = [...surpriseIds, ...event_data.question_ids];
    if (surpriseIds.length > 100) surpriseIds = surpriseIds.slice(-100);
    lastSurpriseExamDate = today;
  } else if (surpriseIds.length > 100) {
    surpriseIds = surpriseIds.slice(-100);
  }

  return { surpriseIds, lastSurpriseExamDate };
}

// ─── BLOQUE 8: Evaluar y otorgar logros ──────────────────────────────────────
async function processAchievements(base44, user_email, event_type, newStreakDays, finalStars, nowIso) {
  const applicableKeys = [event_type];

  const streakMilestones = [3, 7, 14, 30];
  for (const milestone of streakMilestones) {
    if (newStreakDays >= milestone) applicableKeys.push(`streak_${milestone}`);
  }

  const starMilestones = [10, 50, 100];
  for (const milestone of starMilestones) {
    if (finalStars >= milestone) applicableKeys.push(`stars_${milestone}`);
  }

  const allAchievements = await base44.asServiceRole.entities.Achievement.list();
  const applicableAchs = allAchievements.filter(a => applicableKeys.includes(a.condition_key));

  const userAchievements = await base44.asServiceRole.entities.UserAchievement.filter({ user_email });
  const unlockedIds = userAchievements.filter(u => u.is_unlocked).map(u => u.achievement_id);

  const newlyUnlocked = [];

  for (const ach of applicableAchs) {
    if (unlockedIds.includes(ach.id)) continue;

    const existing_ua = userAchievements.find(u => u.achievement_id === ach.id);
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

  return newlyUnlocked;
}

// ─── BLOQUE 9: Actualizar métricas de usuario ────────────────────────────────
async function updateUserMetrics(base44, user_email, metrics, currentMinute, today, streakBroke, nowIso) {
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
}

// ─── ORQUESTADOR PRINCIPAL ───────────────────────────────────────────────────
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

  const nowIso = new Date().toISOString();
  const currentMinute = nowIso.substring(0, 16);

  // ─── 1. IDEMPOTENCIA FUERTE: crear primero como lock lógico ─────────────────
  try {
    await base44.asServiceRole.entities.ProcessedEvent.create({
      event_id, user_email, event_type, processed_at: nowIso,
    });
  } catch (err) {
    if (err.message && (
      err.message.includes('unique constraint') ||
      err.message.includes('duplicate key')
    )) {
      return Response.json({ status: 'already_processed' });
    }
    throw err;
  }

  try {
    // ─── 2. ANTI-FRAUDE: Rate limiting ───────────────────────────────────────
    const metricsArr = await base44.asServiceRole.entities.UserMetrics.filter({ user_email });
    const metrics = metricsArr[0] || null;

    if (metrics?.last_event_minute === currentMinute && (metrics.events_this_minute || 0) >= 10) {
      return Response.json({ error: 'Too many requests' }, { status: 429 });
    }

    // ─── 3. ANTI-FRAUDE: Duración mínima de actividad ────────────────────────
    const MIN_DURATION_SECONDS = 10;
    if (event_data.activity_duration_seconds !== undefined &&
        event_data.activity_duration_seconds < MIN_DURATION_SECONDS) {
      return Response.json({ error: 'Activity too short' }, { status: 400 });
    }

    // ─── 4. CREAR/OBTENER UserProgress ───────────────────────────────────────
    await initializeUserProgress(base44, user_email, nowIso);

    // ─── 5. OBTENER GamificationProfile ──────────────────────────────────────
    const gamArr = await base44.asServiceRole.entities.GamificationProfile.filter({ user_email });
    const gam = gamArr[0] || null;
    const matamorosNow = getMatamorosDateObject();
    const today = getLocalDateString();
    const isSurpriseExam = event_type === 'surprise_exam_completed';

    // ─── 6. CALCULAR TODOS LOS VALORES DE GAMIFICACIÓN ───────────────────────
    const { baseXP, baseStars, baseWater }                               = calculateBaseAwards(event_type, event_data);
    const { newStreakDays, streakBroke, shieldUsed }                     = calculateStreak(gam, matamorosNow, today);
    const { earnedXP, newXP, newStars, newWater, newMaxStreak, multiplier } = calculateGamificationPoints(gam, baseXP, baseStars, baseWater, newStreakDays);
    const { newTreeStage, treeLevelUp }                                  = updateTreeGrowth(newWater, gam);
    const {
      weeklyProgress, weeklyTarget, weeklyStartDate, weeklyCompleted,
      weeklyRewardClaimed, weeklyGoalJustCompleted, weeklyHistory,
      weeklyBonusXP, weeklyBonusStars,
    } = manageWeeklyGoal(gam, event_type, today, matamorosNow);
    const { surpriseIds, lastSurpriseExamDate }                          = handleSurpriseExamData(gam, isSurpriseExam, event_data, today);

    const finalXP     = newXP + weeklyBonusXP;
    const finalStars  = newStars + weeklyBonusStars;
    const finalLevel  = Math.max(1, getLevelFromXP(finalXP));
    const leveledUp   = finalLevel > (gam?.level || 1);

    // ─── 7. PERSISTIR GamificationProfile ────────────────────────────────────
    const gamUpdate = {
      user_email,
      streak_days: newStreakDays,
      last_study_date_normalized: today,
      max_streak: newMaxStreak,
      total_stars: finalStars,
      streak_shields: shieldUsed ? Math.max(0, (gam?.streak_shields || 0) - 1) : (gam?.streak_shields || 0),
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
      weekly_goal_completed: weeklyCompleted,
      weekly_goal_reward_claimed: weeklyRewardClaimed,
      weekly_goal_history: weeklyHistory,
    };

    if (gam) {
      await base44.asServiceRole.entities.GamificationProfile.update(gam.id, gamUpdate);
    } else {
      await base44.asServiceRole.entities.GamificationProfile.create(gamUpdate);
    }

    // ─── 8. EVALUAR LOGROS ────────────────────────────────────────────────────
    const newlyUnlocked = await processAchievements(base44, user_email, event_type, newStreakDays, finalStars, nowIso);

    // ─── 9. ACTUALIZAR MÉTRICAS ───────────────────────────────────────────────
    await updateUserMetrics(base44, user_email, metrics, currentMinute, today, streakBroke, nowIso);

    // ─── 10. CONSTRUIR RESPUESTA ──────────────────────────────────────────────
    const { minXP: finalMinXP, nextLevelXP: finalNextXP } = getLevelXPRange(finalLevel);
    const xpIntoLevel      = finalXP - finalMinXP;
    const xpNeededForNext  = finalNextXP - finalMinXP;
    const progressPercent  = Math.max(0, Math.min(100, Math.round((xpIntoLevel / xpNeededForNext) * 100)));

    return Response.json({
      status: 'ok',
      streak_days: newStreakDays,
      streak_broke: streakBroke,
      streak_saved_by_shield: shieldUsed,
      xp_earned: earnedXP + weeklyBonusXP,
      total_xp: finalXP,
      total_stars: finalStars,
      level: finalLevel,
      leveled_up: leveledUp,
      newly_unlocked_achievements: newlyUnlocked,
      multiplier,
      tree_level_up: treeLevelUp,
      new_tree_stage: newTreeStage,
      weekly_goal_completed: weeklyGoalJustCompleted,
      xp_into_level: xpIntoLevel,
      xp_needed_for_next_level: xpNeededForNext,
      progress_percent: progressPercent,
      gamificationProfile: { ...gamUpdate },
    });
  } catch (err) {
    console.error('handleUserEvent error:', err.message, err.stack);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});