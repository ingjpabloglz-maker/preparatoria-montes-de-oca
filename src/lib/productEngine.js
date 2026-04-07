// ─── PRODUCT ENGINE ───────────────────────────────────────────────────────────
// Responsabilidad única: decidir QUÉ debe ocurrir, con qué prioridad y qué
// navegación ejecutar. NO conoce React, NO toca el DOM.
// ─────────────────────────────────────────────────────────────────────────────

const MATAMOROS_TZ = 'America/Matamoros';

// ─── UTILIDADES DE FECHA ──────────────────────────────────────────────────────

export const getMatamorosNow = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MATAMOROS_TZ,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(now);
  const g = (type) => parseInt(parts.find(p => p.type === type).value);
  return new Date(Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')));
};

export const toDateStr = (dateObj) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: MATAMOROS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(dateObj);

// ─── UUID ─────────────────────────────────────────────────────────────────────

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── UTILIDADES DE NIVEL ──────────────────────────────────────────────────────

const getLevelFromXP   = (xp)  => Math.max(1, Math.floor(Math.sqrt(xp / 10)));
const getMinXpForLevel = (lvl) => Math.pow(lvl, 2) * 10;
const getNextLevelXp   = (lvl) => Math.pow(lvl + 1, 2) * 10;

// ─── JERARQUÍA DE PRIORIDADES ─────────────────────────────────────────────────

export const PRIORITY = {
  URGENT:      6,
  ONBOARDING:  5,
  RECOVERY:    4,
  OPPORTUNITY: 3,
  MISSION:     2,
  AMBIENT:     1,
};

// ─── TIPOS DE ACCIÓN ──────────────────────────────────────────────────────────

export const ACTION_TYPES = {
  SHOW_MESSAGE: 'SHOW_MESSAGE',
  NAVIGATE:     'NAVIGATE',
  REWARD:       'REWARD',
};

// ─── ONBOARDING STEPS ────────────────────────────────────────────────────────

export const ONBOARDING_STEPS = [
  { text: '👋 Bienvenido. Comienza completando tu primera lección 📚', route: '/Dashboard', label: 'Ir a mi primera lección' },
  { text: '🎯 ¡Bien hecho! Ahora prueba el desafío diario y gana XP extra', route: '/SurpriseExam', label: 'Aceptar desafío' },
  { text: '🌱 Un último paso: riega tu árbol con tus tokens de agua', route: '/Rewards', label: 'Ver mi árbol' },
];

// ─── createDecision ───────────────────────────────────────────────────────────
// Fábrica estándar de decisiones con scoring automático.

export function createDecision({
  id,
  type,
  priorityKey,
  priority,
  reason,
  text,
  callToAction = null,
  duration = 13000,
  isReactive = false,
  ctx = {},
  userState = 'neutral',
  source = 'rule_engine',
}) {
  // urgency según tipo de prioridad
  const urgency =
    priorityKey === 'URGENT'      ? 1.5 :
    priorityKey === 'OPPORTUNITY' ? 1.2 : 1;

  // peso según engagement
  const engagementWeight =
    userState === 'at_risk' ? 1.5 :
    userState === 'engaged' ? 1.2 : 1;

  // factor tiempo: presión al final del día
  const h = ctx.hoursUntilDayEnd ?? 24;
  const timeFactor = h <= 3 ? 1.5 : h <= 6 ? 1.2 : 1;

  const score = priority * urgency * engagementWeight * timeFactor;

  return {
    // Identidad
    id,                                        // tipo de decisión (para cooldown lookup)
    decision_instance_id: generateUUID(),      // instancia única (para tracking click/dismiss)
    type: ACTION_TYPES.SHOW_MESSAGE,
    priorityKey,
    priority,
    score,
    reason,
    source,
    createdAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 1000,   // expira en 1h por defecto
    // Payload de render
    payload: {
      text,
      messageType: id,
      callToAction,
      duration,
      isReactive,
    },
  };
}

// ─── buildContext ─────────────────────────────────────────────────────────────

export function buildContext(profile) {
  const now = getMatamorosNow();
  const todayString = toDateStr(now);

  const xp     = profile?.xp_points || 0;
  const level  = getLevelFromXP(xp);
  const minXp  = getMinXpForLevel(level);
  const nextXp = getNextLevelXp(level);
  const xpToNextLevel = Math.max(0, nextXp - xp);
  const xpIntoLevel   = xp - minXp;
  const canLevelUpNow = xpToNextLevel <= 0;

  const streakDays   = profile?.streak_days || 0;
  const lastStudy    = profile?.last_study_date_normalized;
  const todayStudied = lastStudy === todayString;
  const streakAtRisk = streakDays > 0 && !todayStudied;

  const currentHour      = now.getUTCHours();
  const hoursUntilDayEnd = Math.max(0, 23 - currentHour);

  const examDoneToday  = profile?.last_surprise_exam_date_normalized === todayString;
  const waterTokens    = profile?.water_tokens || 0;

  const weeklyTarget   = profile?.weekly_goal_target || null;
  const weeklyProgress = profile?.weekly_goal_progress || 0;
  const lessonsNeededForWeeklyGoal = weeklyTarget ? Math.max(0, weeklyTarget - weeklyProgress) : null;
  const weeklyGoalCompleted = weeklyTarget && weeklyProgress >= weeklyTarget;

  return {
    now, todayString,
    xp, level, xpToNextLevel, xpIntoLevel, canLevelUpNow,
    streakDays, lastStudy, todayStudied, streakAtRisk,
    hoursUntilDayEnd,
    examDoneToday, waterTokens,
    weeklyTarget, weeklyProgress, lessonsNeededForWeeklyGoal, weeklyGoalCompleted,
  };
}

// ─── getUserState ─────────────────────────────────────────────────────────────

export function getUserState(behavior) {
  if (!behavior) return 'neutral';
  const score = behavior.engagement_score ?? 50;
  if (score < 30) return 'at_risk';
  if (score > 70) return 'engaged';
  return 'neutral';
}

// ─── evaluateUserState ────────────────────────────────────────────────────────
// Devuelve un array de decisiones estructuradas con scoring completo.
// flags: objeto con feature flags (ej. { XP_MULTIPLIER_ENABLED: true })

export function evaluateUserState({ profile, behavior, flags = {} }) {
  if (!profile) {
    return [createDecision({
      id: 'fallback', type: ACTION_TYPES.SHOW_MESSAGE,
      priorityKey: 'AMBIENT', priority: PRIORITY.AMBIENT,
      reason: 'no_profile',
      text: '¡Tu aventura de aprendizaje empieza ahora! 🚀',
      callToAction: { label: 'Ir al inicio', route: '/Dashboard' },
      userState: 'neutral',
    })];
  }

  const ctx       = buildContext(profile);
  const userState = getUserState(behavior);
  const decisions = [];

  const d = (params) => createDecision({ ...params, ctx, userState });

  // ── ONBOARDING ───────────────────────────────────────────────────────────
  if (!behavior?.onboarding_completed) {
    const step = behavior?.onboarding_step || 0;
    const onboardingStep = ONBOARDING_STEPS[step];
    if (onboardingStep) {
      return [d({
        id: 'onboarding',
        priorityKey: 'ONBOARDING', priority: PRIORITY.ONBOARDING,
        reason: `onboarding_step_${step}`,
        text: onboardingStep.text,
        callToAction: { label: onboardingStep.label, route: onboardingStep.route },
        payload_extra: { onboardingStep: step },
      })];
    }
  }

  // ── RECOVERY ─────────────────────────────────────────────────────────────
  if (userState === 'at_risk') {
    decisions.push(d({
      id: 'recovery',
      priorityKey: 'RECOVERY', priority: PRIORITY.RECOVERY,
      reason: 'low_engagement_score',
      text: '👀 Hace tiempo que no avanzas… retomemos poco a poco.',
      callToAction: { label: 'Volver ahora', route: '/Dashboard' },
    }));
  }

  // ── URGENT — Racha en riesgo ──────────────────────────────────────────────
  if (ctx.streakAtRisk) {
    const h = ctx.hoursUntilDayEnd;
    const urgencyLevel = h <= 2 ? 'critical' : h <= 6 ? 'high' : 'low';
    const urgencyText = {
      low:      `⏳ Te quedan ${h}h para no perder tu racha de ${ctx.streakDays} días.`,
      high:     `⚠️ Últimas ${h}h. Tu racha de ${ctx.streakDays} días está en peligro.`,
      critical: `🚨 ÚLTIMO AVISO. Pierdes ${ctx.streakDays} días de racha si no estudias ahora.`,
    };
    decisions.push(d({
      id: 'save_streak',
      priorityKey: 'URGENT', priority: PRIORITY.URGENT,
      reason: 'streak_at_risk',
      text: urgencyText[urgencyLevel],
      callToAction: { label: 'Salvar mi racha', route: '/Dashboard' },
    }));
  }

  // ── OPPORTUNITY — Nivel próximo ───────────────────────────────────────────
  if (ctx.xpToNextLevel > 0 && ctx.xpToNextLevel <= 50) {
    decisions.push(d({
      id: 'level_up_imminent',
      priorityKey: 'OPPORTUNITY', priority: PRIORITY.OPPORTUNITY,
      reason: 'xp_near_level_up',
      text: `⚡ Estás a solo ${ctx.xpToNextLevel} XP del Nivel ${ctx.level + 1}. ¡Una lección te lleva ahí!`,
      callToAction: { label: 'Subir de nivel', route: '/Dashboard' },
    }));
  }

  // ── OPPORTUNITY — Meta semanal casi terminada ─────────────────────────────
  if (ctx.lessonsNeededForWeeklyGoal !== null && ctx.lessonsNeededForWeeklyGoal > 0 && ctx.lessonsNeededForWeeklyGoal <= 2) {
    decisions.push(d({
      id: 'complete_weekly_goal',
      priorityKey: 'OPPORTUNITY', priority: PRIORITY.OPPORTUNITY,
      reason: 'weekly_goal_near_completion',
      text: `📅 Te faltan solo ${ctx.lessonsNeededForWeeklyGoal} lección(es) para completar tu meta semanal.`,
      callToAction: { label: 'Terminar mi meta', route: '/Dashboard' },
    }));
  }

  // ── OPPORTUNITY — XP Multiplier (feature flag) ────────────────────────────
  if (flags.XP_MULTIPLIER_ENABLED && !ctx.todayStudied && !ctx.streakAtRisk) {
    decisions.push(d({
      id: 'xp_multiplier',
      priorityKey: 'OPPORTUNITY', priority: PRIORITY.OPPORTUNITY,
      reason: 'xp_multiplier_active',
      text: `🔥 ¡Doble XP disponible por tiempo limitado! Estudia ahora y aprovecha el bonus.`,
      callToAction: { label: 'Aprovechar bonus', route: '/Dashboard' },
    }));
  }

  // ── OPPORTUNITY — Doble XP por estudiar hoy (default) ────────────────────
  if (!flags.XP_MULTIPLIER_ENABLED && !ctx.todayStudied && !ctx.streakAtRisk) {
    decisions.push(d({
      id: 'double_xp',
      priorityKey: 'OPPORTUNITY', priority: PRIORITY.OPPORTUNITY,
      reason: 'first_study_of_day',
      text: `🔥 Estudia ahora y tus lecciones de hoy valen el doble de XP. Solo por hoy.`,
      callToAction: { label: 'Aprovechar bonus', route: '/Dashboard' },
    }));
  }

  // ── MISSION — Desafío diario ──────────────────────────────────────────────
  if (!ctx.examDoneToday) {
    decisions.push(d({
      id: 'do_daily_challenge',
      priorityKey: 'MISSION', priority: PRIORITY.MISSION,
      reason: 'daily_challenge_available',
      text: `🎯 Tu desafío diario está disponible. Complétalo y gana XP extra.`,
      callToAction: { label: 'Aceptar desafío', route: '/SurpriseExam' },
    }));
  }

  // ── MISSION — Agua disponible ─────────────────────────────────────────────
  if (ctx.waterTokens > 0) {
    decisions.push(d({
      id: 'water_tree',
      priorityKey: 'MISSION', priority: PRIORITY.MISSION,
      reason: 'water_tokens_available',
      text: `💧 Tienes ${ctx.waterTokens} token${ctx.waterTokens > 1 ? 's' : ''} de agua. Tu árbol puede crecer ahora.`,
      callToAction: { label: 'Regar mi árbol', route: '/Rewards' },
    }));
  }

  // ── MISSION — Progreso semanal ────────────────────────────────────────────
  if (ctx.weeklyTarget && !ctx.weeklyGoalCompleted) {
    decisions.push(d({
      id: 'progress_weekly',
      priorityKey: 'MISSION', priority: PRIORITY.MISSION,
      reason: 'weekly_goal_in_progress',
      text: `📖 Llevas ${ctx.weeklyProgress}/${ctx.weeklyTarget} lecciones esta semana. Sigues a tiempo.`,
      callToAction: { label: 'Continuar', route: '/Dashboard' },
    }));
  }

  // ── AMBIENT — Racha activa ────────────────────────────────────────────────
  if (ctx.streakDays >= 2 && ctx.todayStudied) {
    decisions.push(d({
      id: 'streak_active',
      priorityKey: 'AMBIENT', priority: PRIORITY.AMBIENT,
      reason: 'active_streak',
      text: `🔥 ¡${ctx.streakDays} días de racha! La constancia es tu superpoder.`,
      callToAction: { label: 'Continuar aprendiendo', route: '/Dashboard' },
    }));
  }

  // ── AMBIENT — Saludo por hora ─────────────────────────────────────────────
  const h = ctx.now.getUTCHours();
  const greetText = h >= 5 && h < 12
    ? '🌞 Buenos días. Empezar el día estudiando te da ventaja. ¡Vamos!'
    : h < 19
    ? '👋 ¿Listo para continuar donde te quedaste? Aún hay tiempo hoy.'
    : '🌙 Cerrar el día aprendiendo algo nuevo siempre vale la pena 📚';

  decisions.push(d({
    id: 'greeting',
    priorityKey: 'AMBIENT', priority: PRIORITY.AMBIENT,
    reason: 'time_based_greeting',
    text: greetText,
    callToAction: { label: 'Continuar aprendiendo', route: '/Dashboard' },
  }));

  // Ordenar por score DESC (scoring completo: priority * urgency * engagement * timeFactor)
  return decisions.sort((a, b) => b.score - a.score);
}

// ─── getTopDecision ───────────────────────────────────────────────────────────
// Recibe array ya filtrado por cooldown, retorna la decisión con mayor score.

export function getTopDecision(decisions, lastMessageType = '') {
  if (!decisions?.length) return null;
  const messages = decisions.filter(d => d.type === ACTION_TYPES.SHOW_MESSAGE);
  if (!messages.length) return null;

  const top = messages[0]; // ya vienen ordenados por score DESC
  // Evitar repetir el mismo tipo consecutivo salvo URGENT
  if (lastMessageType && top.payload?.messageType === lastMessageType && top.priorityKey !== 'URGENT') {
    return messages[1] || top;
  }
  return top;
}

// ─── buildLoginDecision ───────────────────────────────────────────────────────

export function buildLoginDecision({ name, profile, behavior }) {
  if (!profile) {
    return createDecision({
      id: 'login',
      priorityKey: 'AMBIENT', priority: PRIORITY.AMBIENT,
      reason: 'login_no_profile',
      text: 'Bienvenido de nuevo. ¡Sigue avanzando hoy! 🚀',
      callToAction: { label: 'Continuar aprendiendo', route: '/Dashboard' },
      isReactive: true,
      duration: 10000,
      userState: 'neutral',
    });
  }

  const ctx = buildContext(profile);
  const userState = getUserState(behavior);
  const h = ctx.now.getUTCHours();
  const firstName = name?.split(' ')[0] || 'estudiante';
  const saludo = h >= 5 && h < 12 ? `🌞 ¡Buenos días, ${firstName}!`
    : h < 19 ? `☀️ ¡Buenas tardes, ${firstName}!`
    : `🌙 ¡Buenas noches, ${firstName}!`;

  const allDecisions = evaluateUserState({ profile, behavior });
  const top = getTopDecision(allDecisions, null);
  const next = top?.payload;

  return createDecision({
    id: 'login',
    priorityKey: 'AMBIENT', priority: PRIORITY.AMBIENT,
    reason: 'login_greeting',
    text: `${saludo} ${next?.text || '¡Sigue avanzando!'}`,
    callToAction: next?.callToAction || null,
    isReactive: true,
    duration: 12000,
    ctx,
    userState,
  });
}

// ─── buildReactiveDecision ────────────────────────────────────────────────────

const REACTIVE_DURATION = {
  level_up:             20000,
  achievement_unlocked: 18000,
  daily_exam_completed: 14000,
  lesson_completed:     8000,
  xp_gained:            8000,
  default:              12000,
};

export function buildReactiveDecision(eventType, payload, ctx) {
  let text = null;
  let callToAction = { label: 'Continuar aprendiendo', route: '/Dashboard' };

  switch (eventType) {
    case 'lesson_completed': {
      const xpGain = payload?.xp || 0;
      const title  = payload?.lessonTitle;
      text = title
        ? `📚 "${title}" completada. +${xpGain} XP ⚡`
        : `📚 ¡Lección completada! +${xpGain} XP ⚡`;
      if (ctx?.xpToNextLevel > 0) text += ` Estás a ${ctx.xpToNextLevel} XP del Nivel ${ctx.level + 1}.`;
      break;
    }
    case 'quiz_perfect_score':
      text = `💯 ¡Puntuación PERFECTA! +${payload?.xp || 0} XP 🏆`;
      break;
    case 'xp_gained': {
      if (!payload?.xp) return null;
      text = `⚡ +${payload.xp} XP ganados. Total: ${ctx?.xp || '??'} XP.`;
      if (ctx?.xpToNextLevel > 0) text += ` Faltan ${ctx.xpToNextLevel} XP para el Nivel ${ctx?.level + 1}.`;
      break;
    }
    case 'level_up':
      text = payload?.level
        ? `🎉 ¡SUBISTE AL NIVEL ${payload.level}! Con ${ctx?.xp || '??'} XP acumulados.`
        : `🎉 ¡NUEVO NIVEL! Sigue así.`;
      break;
    case 'tree_watered':
      text = payload?.stage !== undefined
        ? `💧 ¡Árbol en Etapa ${payload.stage}! Sigue regando para verlo florecer 🌳`
        : `💧 ¡Tu árbol ha crecido!`;
      callToAction = { label: 'Ver mi árbol', route: '/Rewards' };
      break;
    case 'streak_updated':
      text = payload?.streak_days
        ? `🔥 ¡${payload.streak_days} día${payload.streak_days > 1 ? 's' : ''} de racha! Mañana, día ${payload.streak_days + 1}.`
        : `🔥 ¡Racha activa! Cada día cuenta.`;
      break;
    case 'streak_lost':
      text = `💔 Perdiste tu racha. Pero HOY puedes empezar una nueva. ¡El primer paso es el más importante!`;
      break;
    case 'daily_exam_completed': {
      const score    = payload?.score;
      const xpEarned = payload?.xp_earned;
      text = score !== undefined && xpEarned !== undefined
        ? `🎯 Desafío completado: ${score}% de aciertos. +${xpEarned} XP 🏆`
        : `🎯 ¡Desafío diario completado! XP extra en camino.`;
      break;
    }
    case 'achievement_unlocked':
      text = payload?.name
        ? `🏆 Logro desbloqueado: "${payload.name}" ✨`
        : `🏆 ¡Nuevo logro desbloqueado!`;
      callToAction = { label: 'Ver mis logros', route: '/Rewards' };
      break;
    default:
      return null;
  }

  if (!text) return null;

  return createDecision({
    id: eventType,
    priorityKey: 'URGENT', priority: PRIORITY.URGENT,
    reason: `reactive_${eventType}`,
    text,
    callToAction,
    isReactive: true,
    duration: REACTIVE_DURATION[eventType] || REACTIVE_DURATION.default,
    ctx: ctx || {},
    userState: 'neutral',
  });
}

// ─── groupQueuedDecisions ─────────────────────────────────────────────────────

export function groupQueuedDecisions(queue, ctx) {
  if (!queue.length) return [];

  let totalXP   = 0;
  let lessons   = 0;
  let achievements = 0;
  const standalone = [];

  for (const event of queue) {
    const t = event.type;
    if (t === 'xp_gained')             totalXP += event.data?.xp || 0;
    else if (t === 'lesson_completed')  lessons += 1;
    else if (t === 'achievement_unlocked') achievements += 1;
    else if (['level_up', 'streak_updated', 'daily_exam_completed'].includes(t)) {
      const d = buildReactiveDecision(t, event.data, ctx);
      if (d) standalone.push(d);
    }
  }

  const decisions = [];

  if (lessons > 0 || totalXP > 0 || achievements > 0) {
    const parts = [];
    if (lessons > 0)      parts.push(`${lessons} lección${lessons > 1 ? 'es' : ''} completada${lessons > 1 ? 's' : ''}`);
    if (totalXP > 0)      parts.push(`+${totalXP} XP`);
    if (achievements > 0) parts.push(`${achievements} logro${achievements > 1 ? 's' : ''} nuevo${achievements > 1 ? 's' : ''}`);
    let text = parts.length > 1 ? `🔥 ¡Gran sesión! ${parts.join(', ')}.` : `📚 ¡${parts[0]}!`;
    if (ctx?.xpToNextLevel > 0) text += ` Estás a ${ctx.xpToNextLevel} XP del Nivel ${ctx.level + 1}.`;

    decisions.push(createDecision({
      id: 'queued_summary',
      priorityKey: 'URGENT', priority: PRIORITY.URGENT,
      reason: 'queued_events_summary',
      text,
      callToAction: { label: 'Continuar aprendiendo', route: '/Dashboard' },
      isReactive: true,
      duration: 10000,
      ctx: ctx || {},
      userState: 'neutral',
    }));
  }

  decisions.push(...standalone);
  return decisions;
}