import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── STUDENT GUARD ────────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_RE = /^service\+|@no-reply\.base44\.com$|^bot\+|^automation\+|^system\+/i;
function requireStudentRole(user, fnName) {
  const email = user?.email || 'anonymous';
  const role = user?.role || 'none';
  if (!user || user.role !== 'user' || SERVICE_ACCOUNT_RE.test(email)) {
    console.log(JSON.stringify({ event: 'NON_STUDENT_OPERATION_BLOCKED', function: fnName, email, role, timestamp: new Date().toISOString() }));
    return Response.json({ status: 'ignored', message: 'Operación exclusiva para alumnos.', blocked_role: role }, { status: 403 });
  }
  return null;
}

// ─── UTILIDADES DE FECHA ─────────────────────────────────────────────────────
const getMatamorosDateObject = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Matamoros',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(now);

  const year   = parseInt(parts.find(p => p.type === 'year').value);
  const month  = parseInt(parts.find(p => p.type === 'month').value);
  const day    = parseInt(parts.find(p => p.type === 'day').value);
  const hour   = parseInt(parts.find(p => p.type === 'hour').value);
  const minute = parseInt(parts.find(p => p.type === 'minute').value);
  const second = parseInt(parts.find(p => p.type === 'second').value);

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
};

// Formatea un Date object a YYYY-MM-DD en la zona horaria de Matamoros
const getLocalDateString = (dateObj) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Matamoros',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(dateObj);
};

// Convierte YYYY-MM-DD a número entero para comparación 100% timezone-agnostic
const toDayNumber = (dateStr) => {
  if (!dateStr) return 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  return y * 10000 + m * 100 + d;
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
// SEGURIDAD: score siempre viene del campo calculado_score (calculado en backend por submitEvaluation)
// NUNCA del event_data.score enviado por frontend
function calculateBaseAwards(event_type, event_data) {
  // Se usa calculated_score si existe (enviado desde submitEvaluation), de lo contrario 0
  const score = event_data.calculated_score ?? 0;
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
// decayTreeState ya consumió escudos día a día y puso streak_days = 0 si se agotaron.
// Aquí solo leemos el estado autoritativo del backend y continuamos/reiniciamos.
//
// REGLA OFICIAL (edge case 3):
//   - streak_days === 0 → racha muerta. El usuario reinicia desde 1.
//     Los shields NO pueden revivir una racha muerta; solo protegen futuras ausencias.
//   - streak_days > 0   → racha viva; seguir incrementando.
function calculateStreak(gam, todayString) {
  const currentStreak = gam?.streak_days ?? 0;
  const lastDate      = gam?.last_study_date_normalized ?? null;

  // Evento duplicado el mismo día → no modificar racha
  if (lastDate === todayString) {
    return { newStreakDays: Math.max(1, currentStreak), streakBroke: false };
  }

  if (currentStreak > 0) {
    // Racha viva → continuar
    console.log(JSON.stringify({
      event:         'STREAK_PROTECTED',
      user:          gam.user_email,
      streak_before: currentStreak,
      streak_after:  currentStreak + 1,
      last_study:    lastDate,
      today:         todayString,
      timestamp:     new Date().toISOString(),
    }));
    return { newStreakDays: currentStreak + 1, streakBroke: false };
  }

  // Racha muerta (puesta a 0 por decay) → reiniciar desde 1
  console.log(JSON.stringify({
    event:         'STREAK_RESET',
    user:          gam?.user_email,
    streak_before: currentStreak,
    streak_after:  1,
    last_study:    lastDate,
    today:         todayString,
    timestamp:     new Date().toISOString(),
  }));
  return { newStreakDays: 1, streakBroke: currentStreak > 0 };
}

// ─── BLOQUE 3b: Anti-maratón diario — multiplicador de XP decreciente ───────
// Cuenta cuántas lecciones ya fueron recompensadas HOY (zona horaria Matamoros).
// Umbrales: 1-7 → 100% XP, 8-12 → 50% XP, 13+ → 0% XP
async function getDailyMarathonMultiplier(base44, user_email, todayString) {
  const allRewarded = await base44.asServiceRole.entities.LessonProgress.filter({
    user_email,
    rewards_granted: true,
  });

  const todayRewarded = allRewarded.filter(lp => {
    if (!lp.rewards_granted_at) return false;
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Matamoros',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(lp.rewards_granted_at));
    return localDate === todayString;
  });

  const countToday = todayRewarded.length; // lecciones ya recompensadas hoy (antes de esta)
  if (countToday < 7) return { multiplier: 1.0, dailyCount: countToday };
  if (countToday < 12) return { multiplier: 0.5, dailyCount: countToday };
  return { multiplier: 0.0, dailyCount: countToday };
}

// ─── BLOQUE 4: Calcular puntos de gamificación ───────────────────────────────
function calculateGamificationPoints(gam, baseXP, baseStars, baseWater, newStreakDays) {
  // Clamp inferior a 1 para proteger contra streakDays corruptos (ej: negativos)
  const multiplier = Math.max(1, Math.min(1 + (newStreakDays / 20), 2));
  const earnedXP = Math.round(baseXP * multiplier);
  const newXP = (gam?.xp_points || 0) + earnedXP;
  const newStars = (gam?.total_stars || 0) + baseStars;
  const newWater = (gam?.water_tokens || 0) + baseWater;
  const newMaxStreak = Math.max(gam?.max_streak || 0, newStreakDays);
  return { earnedXP, newXP, newStars, newWater, newMaxStreak, multiplier };
}

// ─── BLOQUE 5: Calcular crecimiento del árbol ────────────────────────────────
const TREE_THRESHOLDS = [0, 5, 15, 30, 60, 100, 150, 220, 300, 400, 550, 750, 1000];

// Pesos de eventos para el ecosistema del árbol
const TREE_EVENT_WEIGHTS = {
  lesson_completed:       1,
  mini_eval_passed:       3,
  subject_test_passed:    8,
  activity_submitted:     0.5,
  surprise_exam_completed: 2,
  forum_solution_earned:  1,
};

function updateTreeGrowth(newGrowthPoints, newStreakDays, gam, event_type, nowIso) {
  let newTreeStage = 0;
  for (let i = TREE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (newGrowthPoints >= TREE_THRESHOLDS[i]) { newTreeStage = i; break; }
  }
  const newGrowthStreak = newStreakDays;

  // tree_energy: base limitado a 100, modulado por streakDays
  const streakBonus = Math.min(newGrowthStreak * 2, 40);
  const rawEnergy = Math.min(100, (gam?.tree_energy ?? 0) + (TREE_EVENT_WEIGHTS[event_type] ?? 1) * 4 + streakBonus * 0.1);
  const newTreeEnergy = Math.round(Math.min(100, rawEnergy) * 10) / 10;

  // tree_vitality: 0–1, sube con eventos de mayor peso
  const eventWeight = TREE_EVENT_WEIGHTS[event_type] ?? 1;
  const vitalityBoost = Math.min(1, (eventWeight / 8) * 0.35);
  const newVitality = Math.min(1, Math.round(((gam?.tree_vitality ?? 0) + vitalityBoost) * 1000) / 1000);

  // growth_flow: ventana deslizante de últimas 20 entradas
  const existingFlow = gam?.growth_flow ?? [];
  const newFlowEntry = { ts: nowIso, weight: eventWeight };
  const newGrowthFlow = [...existingFlow, newFlowEntry].slice(-20);

  return { newTreeStage, newGrowthStreak, newTreeEnergy, newVitality, newGrowthFlow };
}

// ─── BLOQUE 6: Gestionar meta semanal (WeeklyGoalSession) — STATE MACHINE ────
// Estado formal: active → completed → rewarded → archived
//                active → failed → archived
// Solo lesson_completed avanza el progreso.
// Backend es la única autoridad de expiración y recompensas.

function weeklyGoalAuditLog(event, fields) {
  console.log(JSON.stringify({ event, ...fields, timestamp: new Date().toISOString() }));
}

async function manageWeeklyGoal(base44, user_email, gam, event_type, nowIso) {
  // Solo lesson_completed avanza la meta
  if (event_type !== 'lesson_completed') {
    return { weeklyBonusXP: 0, weeklyBonusStars: 0, weeklyGoalJustCompleted: false, activeSession: null };
  }

  const now = new Date(nowIso);

  // Buscar sesión con status='active' (fuente de verdad del state machine)
  const activeSessions = await base44.asServiceRole.entities.WeeklyGoalSession.filter({
    user_email,
    status: 'active',
  });

  let activeSession = activeSessions[0] || null;

  // ── Detectar y reparar sesiones activas expiradas (corrupción de estado) ──
  if (activeSessions.length > 1) {
    // Corrupción: múltiples activas → dejar la más reciente, fallar el resto
    weeklyGoalAuditLog('WEEKLY_GOAL_CORRUPTION_FIXED', {
      user_email,
      issue: 'multiple_active_sessions',
      count: activeSessions.length,
      kept_session_id: activeSessions[activeSessions.length - 1].id,
    });
    // Ordenar por started_at descendente → el más reciente es el activo
    activeSessions.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
    activeSession = activeSessions[0];
    for (const s of activeSessions.slice(1)) {
      const isSExpired = new Date(s.expires_at) <= now;
      await base44.asServiceRole.entities.WeeklyGoalSession.update(s.id, {
        status: isSExpired ? 'failed' : 'archived',
        archived: true,
        failed_at: isSExpired ? nowIso : undefined,
        archived_at: nowIso,
      });
    }
  }

  // ── Si la sesión activa expiró → transición a 'failed' ──────────────────
  if (activeSession) {
    const expiresAt = new Date(activeSession.expires_at);
    if (now >= expiresAt) {
      await base44.asServiceRole.entities.WeeklyGoalSession.update(activeSession.id, {
        status: 'failed',
        archived: true,
        failed_at: nowIso,
        archived_at: nowIso,
      });
      weeklyGoalAuditLog('WEEKLY_GOAL_FAILED', {
        user_email,
        session_id: activeSession.id,
        target: activeSession.target,
        progress: activeSession.progress,
        goal_number_in_cycle: activeSession.goal_number_in_cycle,
        started_at: activeSession.started_at,
        expires_at: activeSession.expires_at,
      });
      activeSession = null;
    }
  }

  // Sin sesión activa válida → no hay meta
  if (!activeSession) {
    return { weeklyBonusXP: 0, weeklyBonusStars: 0, weeklyGoalJustCompleted: false, activeSession: null };
  }

  // ── Avanzar progreso (cap en target*2 para robustez) ────────────────────
  const newProgress = Math.min((activeSession.progress || 0) + 1, activeSession.target * 2);
  const justCompleted = newProgress >= activeSession.target && activeSession.status === 'active';

  let weeklyBonusXP = 0;
  let weeklyBonusStars = 0;
  let weeklyGoalJustCompleted = false;
  const sessionUpdate = { progress: newProgress };

  if (justCompleted) {
    // Las recompensas ya están fijadas en la sesión desde su creación (anti-farming)
    // Solo se otorgan si aún no se reclamaron (idempotencia)
    const rewardAlreadyClaimed = ['rewarded', 'completed'].includes(activeSession.status) && activeSession.reward_claimed;

    if (!rewardAlreadyClaimed) {
      weeklyBonusXP = activeSession.reward_xp || 0;
      weeklyBonusStars = activeSession.reward_stars || 0;
      weeklyGoalJustCompleted = true;

      // Transición: active → rewarded (si hay recompensa) o → completed (si no hay)
      const nextStatus = (weeklyBonusXP > 0 || weeklyBonusStars > 0) ? 'rewarded' : 'completed';
      sessionUpdate.status = nextStatus;
      sessionUpdate.completed = true;
      sessionUpdate.completed_at = nowIso;
      sessionUpdate.reward_claimed = true;
      if (nextStatus === 'rewarded') sessionUpdate.rewarded_at = nowIso;

      weeklyGoalAuditLog(nextStatus === 'rewarded' ? 'WEEKLY_GOAL_REWARDED' : 'WEEKLY_GOAL_COMPLETED', {
        user_email,
        session_id: activeSession.id,
        target: activeSession.target,
        progress: newProgress,
        reward_xp: weeklyBonusXP,
        reward_stars: weeklyBonusStars,
        goal_number_in_cycle: activeSession.goal_number_in_cycle,
        started_at: activeSession.started_at,
        expires_at: activeSession.expires_at,
      });
    } else {
      // Recompensa ya otorgada (idempotencia) → solo actualizar progreso
      weeklyGoalJustCompleted = true;
    }
  }

  await base44.asServiceRole.entities.WeeklyGoalSession.update(activeSession.id, sessionUpdate);
  const updatedSession = { ...activeSession, ...sessionUpdate };

  return { weeklyBonusXP, weeklyBonusStars, weeklyGoalJustCompleted, activeSession: updatedSession };
}

// ─── BLOQUE 7: Gestionar datos de examen sorpresa ────────────────────────────
function handleSurpriseExamData(gam, isSurpriseExam, event_data, todayString) {
  let surpriseIds = gam?.answered_surprise_questions_ids || [];
  let lastSurpriseExamDate = gam?.last_surprise_exam_date_normalized || null;

  if (isSurpriseExam && event_data.question_ids?.length) {
    surpriseIds = [...surpriseIds, ...event_data.question_ids];
    if (surpriseIds.length > 100) surpriseIds = surpriseIds.slice(-100);
    lastSurpriseExamDate = todayString;
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
async function updateUserMetrics(base44, user_email, metrics, currentMinute, todayString, streakBroke, nowIso) {
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
    total_days_active: metrics?.last_daily_active?.split('T')[0] !== todayString
      ? (metrics?.total_days_active || 0) + 1
      : (metrics?.total_days_active || 0),
  };

  if (metrics) {
    await base44.asServiceRole.entities.UserMetrics.update(metrics.id, metricUpdate);
  } else {
    await base44.asServiceRole.entities.UserMetrics.create(metricUpdate);
  }
}

// ─── BLOQUE 10: Actualizar SubjectProgress.progress_percent ─────────────────
async function updateSubjectProgressPercent(base44, user_email, event_data) {
  const subject_id = event_data?.subject_id;
  if (!subject_id) return;

  // Contar lecciones totales y completadas del subject (sin mini evals)
  const [allLessons, completedLessons] = await Promise.all([
    base44.asServiceRole.entities.CourseLesson.filter({ subject_id }),
    base44.asServiceRole.entities.LessonProgress.filter({ user_email, subject_id, completed: true }),
  ]);

  const totalCount = allLessons.filter(l => !l.is_mini_eval).length;
  if (totalCount === 0) return;

  const completedCount = completedLessons.filter(lp => {
    const lesson = allLessons.find(l => l.id === lp.lesson_id);
    return lesson && !lesson.is_mini_eval;
  }).length;

  const progress_percent = Math.round((completedCount / totalCount) * 100);

  // Buscar o crear SubjectProgress
  const existing = await base44.asServiceRole.entities.SubjectProgress.filter({ user_email, subject_id });
  if (existing[0]) {
    await base44.asServiceRole.entities.SubjectProgress.update(existing[0].id, {
      progress_percent,
      last_activity: new Date().toISOString(),
    });
  } else {
    await base44.asServiceRole.entities.SubjectProgress.create({
      user_email,
      subject_id,
      progress_percent,
      completed: false,
      last_activity: new Date().toISOString(),
    });
  }
}

// ─── ORQUESTADOR PRINCIPAL ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // ─── EARLY RETURN: solo alumnos generan gamificación/progreso ────────────────
  const blocked = requireStudentRole(user, 'handleUserEvent');
  if (blocked) return blocked;

  const body = await req.json();
  const { event_id, event_type, event_data = {} } = body;

  if (!event_id || !event_type) {
    return Response.json({ error: 'event_id and event_type are required' }, { status: 400 });
  }

  const user_email = event_data?.user_email || user.email;
  const nowIso = new Date().toISOString();
  const currentMinute = nowIso.substring(0, 16);

  // ─── 0. BLOQUEO GLOBAL POST-EGRESO ─────────────────────────────────────────
  const upCheck = await base44.asServiceRole.entities.UserProgress.filter({ user_email });
  if (upCheck[0]?.graduation_status === 'completed' || upCheck[0]?.graduation_status === 'certified') {
    return Response.json({
      status: 'ignored',
      message: 'El alumno ya egresó. Se ignora la gamificación.',
    });
  }

  // ─── 1. IDEMPOTENCIA: registrar evento antes de procesar ─────────────────
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

    // ─── SEGURIDAD: Ignorar score/correct_answers del frontend ───────────────
    // Para eventos de evaluación, el score debe venir de submitEvaluation (calculated_score)
    // Se ignoran explícitamente event_data.score y event_data.correct_answers
    delete event_data.score;
    delete event_data.correct_answers;

    // ─── SURPRISE EXAM: Lookup seguro por attempt_id ──────────────────────────
    // El score NUNCA viene del frontend. Se obtiene del registro guardado por submitSurpriseExam.
    if (event_type === 'surprise_exam_completed') {
      const attempt_id = event_data.attempt_id;
      if (!attempt_id) {
        return Response.json({ error: 'attempt_id is required for surprise_exam_completed' }, { status: 400 });
      }
      const attempts = await base44.asServiceRole.entities.SurpriseExamAttempt.filter({ id: attempt_id });
      const attempt = attempts[0];
      if (!attempt) {
        return Response.json({ error: 'Attempt not found' }, { status: 404 });
      }
      if (attempt.user_email !== user_email) {
        return Response.json({ error: 'Forbidden: attempt does not belong to this user' }, { status: 403 });
      }
      if (typeof attempt.score !== 'number') {
        return Response.json({ error: 'Invalid attempt score' }, { status: 400 });
      }
      // Inyectar el score verificado como calculated_score para que calculateBaseAwards lo use
      event_data.calculated_score = attempt.score;
    }

    // ─── 4. CREAR/OBTENER UserProgress ───────────────────────────────────────
    await initializeUserProgress(base44, user_email, nowIso);

    // ─── 5. OBTENER GamificationProfile ──────────────────────────────────────
    const gamArr = await base44.asServiceRole.entities.GamificationProfile.filter({ user_email });
    const gam = gamArr[0] || null;
    // Usar new Date() real (UTC) con Intl.DateTimeFormat para evitar doble conversión de zona horaria
    const matamorosNow = new Date();
    const todayString = getLocalDateString(matamorosNow); // YYYY-MM-DD en zona horaria Matamoros (correcto)
    const isSurpriseExam = event_type === 'surprise_exam_completed';

    // ─── 6. ANTI-FARMING: Verificar si la lección ya fue recompensada ────────────
    // Idempotencia total: si rewards_granted === true en LessonProgress, no dar nada.
    let isRepeat = false;
    let rewardsBlocked = false;
    const isLessonEvent = ['lesson_completed', 'mini_eval_passed'].includes(event_type);

    if (isLessonEvent && event_data.lesson_id) {
      const lpArr = await base44.asServiceRole.entities.LessonProgress.filter({
        user_email,
        lesson_id: event_data.lesson_id,
      });
      const lp = lpArr[0];
      if (lp?.rewards_granted === true) {
        isRepeat = true;
        rewardsBlocked = true;
        console.log(JSON.stringify({
          event: 'LESSON_REWARD_BLOCKED_REPEAT',
          user_email,
          lesson_id: event_data.lesson_id,
          rewards_granted_at: lp.rewards_granted_at,
          timestamp: nowIso,
        }));
      }
    }

    // ─── 6b. BLOQUEAR RECOMPENSAS SI NO APROBÓ ───────────────────────────────
    if (isLessonEvent && event_data.passed === false) {
      rewardsBlocked = true;
      console.log(JSON.stringify({
        event: 'LESSON_REWARD_DENIED_NOT_PASSED',
        user_email,
        lesson_id: event_data.lesson_id,
        score: event_data.score,
        timestamp: nowIso,
      }));
    }

    // ─── 6. CALCULAR TODOS LOS VALORES DE GAMIFICACIÓN ───────────────────────
    // Si rewardsBlocked, anular premios base para esta lección
    const rawAwards = calculateBaseAwards(event_type, event_data);
    const { baseXP, baseStars, baseWater } = rewardsBlocked
      ? { baseXP: 0, baseStars: 0, baseWater: 0 }
      : rawAwards;

    // ─── ANTI-MARATÓN: Reducir XP si el alumno excede lecciones diarias ──────
    let marathonMultiplier = 1.0;
    let dailyLessonCount = 0;
    if (isLessonEvent && !rewardsBlocked) {
      const marathon = await getDailyMarathonMultiplier(base44, user_email, todayString);
      marathonMultiplier = marathon.multiplier;
      dailyLessonCount = marathon.dailyCount;
      if (marathonMultiplier < 1.0) {
        console.log(JSON.stringify({
          event: 'MARATHON_XP_REDUCED',
          user_email,
          daily_lessons_before_this: dailyLessonCount,
          multiplier: marathonMultiplier,
          timestamp: nowIso,
        }));
      }
    }
    const adjustedBaseXP = Math.round(baseXP * marathonMultiplier);
    // Estrellas y agua: se dejan de otorgar después de 10 lecciones completadas diarias
    const starWaterMultiplier = (isLessonEvent && !rewardsBlocked && dailyLessonCount >= 10) ? 0.0 : 1.0;
    const adjustedBaseStars = baseStars * starWaterMultiplier;
    const adjustedBaseWater = baseWater * starWaterMultiplier;

    const { newStreakDays, streakBroke }                                  = calculateStreak(gam, todayString);
    const { earnedXP, newXP, newStars, newWater, newMaxStreak, multiplier } = calculateGamificationPoints(gam, adjustedBaseXP, adjustedBaseStars, adjustedBaseWater, newStreakDays);
    const newGrowthPoints = (gam?.tree_growth_points ?? 0) + baseWater;
    const { newTreeStage, newGrowthStreak, newTreeEnergy, newVitality, newGrowthFlow } = updateTreeGrowth(newGrowthPoints, newStreakDays, gam, event_type, nowIso);
    const treeLevelUp                                                    = newTreeStage > (gam?.tree_stage ?? 0);
    const {
      weeklyBonusXP, weeklyBonusStars, weeklyGoalJustCompleted, activeSession,
    } = rewardsBlocked
      ? { weeklyBonusXP: 0, weeklyBonusStars: 0, weeklyGoalJustCompleted: false, activeSession: null }
      : await manageWeeklyGoal(base44, user_email, gam, event_type, nowIso);
    const { surpriseIds, lastSurpriseExamDate }                          = handleSurpriseExamData(gam, isSurpriseExam, event_data, todayString);

    const finalXP    = newXP + weeklyBonusXP;
    const finalStars = newStars + weeklyBonusStars;
    const finalLevel = Math.max(1, getLevelFromXP(finalXP));
    const leveledUp  = finalLevel > (gam?.level || 1);

    // ─── 7. PERSISTIR GamificationProfile ────────────────────────────────────
    // Calcular intensidad del evento (0–1) para last_change_event
    const EVENT_INTENSITY_MAP = {
      lesson_completed:        0.3,
      mini_eval_passed:        0.6,
      subject_test_passed:     1.0,
      activity_submitted:      0.1,
      surprise_exam_completed: 0.5,
      forum_thread_created:    0.15,
      forum_post_created:      0.1,
      forum_solution_earned:   0.3,
    };
    const lastChangeEvent = {
      type:      event_type,
      intensity: EVENT_INTENSITY_MAP[event_type] ?? 0.2,
      source:    'user',
      timestamp: nowIso,
    };

    const gamUpdate = {
      user_email,
      streak_days: newStreakDays,
      last_study_date_normalized: todayString,
      max_streak: newMaxStreak,
      total_stars: finalStars,
      streak_shields: gam?.streak_shields ?? 0,  // escudos ya gestionados por decayTreeState
      streak_shields_paid_days: 0,               // reiniciar gap al estudiar
      water_tokens: newWater,
      xp_points: finalXP,
      level: finalLevel,
      answered_surprise_questions_ids: surpriseIds,
      email_notifications_enabled: gam?.email_notifications_enabled !== false,
      last_surprise_exam_date_normalized: lastSurpriseExamDate,
      tree_stage: newTreeStage,
      tree_growth_points: newGrowthPoints,
      growth_streak: newGrowthStreak,
      tree_energy: newTreeEnergy,
      tree_vitality: newVitality,
      growth_flow: newGrowthFlow,
      last_tree_update: nowIso,
      last_sync_timestamp: nowIso,
      last_change_event: lastChangeEvent,
      // Sincronizar campos legacy de GamificationProfile con la sesión activa
      weekly_goal_target: activeSession?.target ?? gam?.weekly_goal_target ?? null,
      weekly_goal_progress: activeSession?.progress ?? 0,
      weekly_goal_start_date: activeSession ? activeSession.started_at?.substring(0, 10) : null,
      weekly_goal_completed: activeSession?.completed ?? false,
      weekly_goal_reward_claimed: activeSession?.reward_claimed ?? false,
    };

    if (gam) {
      await base44.asServiceRole.entities.GamificationProfile.update(gam.id, gamUpdate);
    } else {
      await base44.asServiceRole.entities.GamificationProfile.create(gamUpdate);
    }

    // ─── 8. EVALUAR LOGROS ────────────────────────────────────────────────────
    const newlyUnlocked = await processAchievements(base44, user_email, event_type, newStreakDays, finalStars, nowIso);

    // ─── 8b. MARCAR rewards_granted EN LessonProgress (idempotencia total) ────
    if (isLessonEvent && event_data.lesson_id && !rewardsBlocked) {
      const lpArr2 = await base44.asServiceRole.entities.LessonProgress.filter({
        user_email,
        lesson_id: event_data.lesson_id,
      });
      const lp2 = lpArr2[0];
      if (lp2 && !lp2.rewards_granted) {
        await base44.asServiceRole.entities.LessonProgress.update(lp2.id, {
          rewards_granted: true,
          rewards_granted_at: nowIso,
        });
        console.log(JSON.stringify({
          event: 'LESSON_REWARD_GRANTED',
          user_email,
          lesson_id: event_data.lesson_id,
          attempt_id: event_data.attempt_id,
          score: event_data.score,
          passed: event_data.passed,
          xp_earned: earnedXP + weeklyBonusXP,
          stars_earned: baseStars + weeklyBonusStars,
          water_tokens_earned: baseWater,
          timestamp: nowIso,
        }));
      }
    }

    // ─── 9. ACTUALIZAR MÉTRICAS ───────────────────────────────────────────────
    await updateUserMetrics(base44, user_email, metrics, currentMinute, todayString, streakBroke, nowIso);

    // NOTA: SubjectProgress y LessonProgress ya son actualizados por submitEvaluation.
    // handleUserEvent es EXCLUSIVAMENTE para gamificación (XP, racha, árbol, logros).

    // ─── 10. CONSTRUIR RESPUESTA ──────────────────────────────────────────────
    const { minXP: finalMinXP, nextLevelXP: finalNextXP } = getLevelXPRange(finalLevel);
    const xpIntoLevel     = finalXP - finalMinXP;
    const xpNeededForNext = finalNextXP - finalMinXP;
    const progressPercent = Math.max(0, Math.min(100, Math.round((xpIntoLevel / xpNeededForNext) * 100)));

    // Calcular streak bonus para display en frontend
    const streakBonus = Math.round(earnedXP * (multiplier - 1));
    const perfectScoreBonus = (event_data.score >= 100 && !rewardsBlocked) ? 5 : 0;

    console.log(JSON.stringify({
      event: rewardsBlocked && isRepeat ? 'LESSON_REWARD_BLOCKED_REPEAT'
           : rewardsBlocked ? 'LESSON_REWARD_DENIED_NOT_PASSED'
           : isLessonEvent ? 'LESSON_REWARD_GRANTED' : 'EVENT_PROCESSED',
      user_email,
      lesson_id: event_data.lesson_id,
      xp_earned: earnedXP + weeklyBonusXP,
      stars_earned: baseStars + weeklyBonusStars,
      water_tokens_earned: baseWater,
      is_repeat: isRepeat,
      rewards_granted: !rewardsBlocked,
      timestamp: nowIso,
    }));

    return Response.json({
      status: 'ok',
      streak_days: newStreakDays,
      streak_broke: streakBroke,
      streak_saved_by_shield: false,
      // Recompensas desglosadas para display inmediato en LessonResults
      xp_earned: earnedXP + weeklyBonusXP,
      stars_earned: baseStars + weeklyBonusStars,
      water_tokens_earned: baseWater,
      weekly_bonus_xp: weeklyBonusXP,
      weekly_bonus_stars: weeklyBonusStars,
      streak_bonus: streakBonus,
      perfect_score_bonus: perfectScoreBonus,
      is_repeat: isRepeat,
      rewards_granted: !rewardsBlocked,
      total_xp: finalXP,
      total_stars: finalStars,
      level: finalLevel,
      leveled_up: leveledUp,
      newly_unlocked_achievements: newlyUnlocked,
      multiplier,
      marathon_multiplier: marathonMultiplier,
      daily_lesson_count: dailyLessonCount + (isLessonEvent && !rewardsBlocked ? 1 : 0),
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