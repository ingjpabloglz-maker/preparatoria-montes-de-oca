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

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

// ─── UTILIDADES DE NIVEL ──────────────────────────────────────────────────────

const getLevelFromXP   = (xp)  => Math.max(1, Math.floor(Math.sqrt(xp / 10)));
const getMinXpForLevel = (lvl) => Math.pow(lvl, 2) * 10;
const getNextLevelXp   = (lvl) => Math.pow(lvl + 1, 2) * 10;

// ─── JERARQUÍA DE PRIORIDADES ─────────────────────────────────────────────────

export const PRIORITY = {
  URGENT:     6,
  ONBOARDING: 5,
  RECOVERY:   4,
  OPPORTUNITY:3,
  MISSION:    2,
  AMBIENT:    1,
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
// Fábrica estándar de decisiones. Calcula el score final con todos los factores.

export function createDecision({ id, type, priority, reason, message, cta, ctx, userState, source = 'rule_engine' }) {
  // Factor urgencia por tipo
  const urgency =
    type === 'URGENT'      ? 1.5 :
    type === 'OPPORTUNITY' ? 1.2 :
    1;

  // Factor engagement
  const engagementWeight =
    userState === 'engaged' ? 1.2 :
    userState === 'at_risk' ? 1.5 :
    1;

  // Factor tiempo (horas restantes en el día)
  const hours = ctx?.hoursUntilDayEnd ?? 24;
  const timeFactor =
    hours <= 3 ? 1.5 :
    hours <= 6 ? 1.2 :
    1;

  const score = priority * urgency * engagementWeight * timeFactor;

  return {
    // Identificadores
    id,                                        // tipo de decisión (ej: 'save_streak')
    decision_instance_id: generateUUID(),      // instancia única para tracking
    // Metadata
    type,
    priority,
    score,
    reason,
    source,
    createdAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60,   // 1h por defecto
    // Contenido
    message,
    cta,
    // Interno para useAssistant
    payload: {
      text: message,
      messageType: id,
      callToAction: cta || null,
    },
    priorityKey: type,
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

  const examDoneToday = profile?.last_surprise_exam_date_normalized === todayString;
  const waterTokens   = profile?.water_tokens || 0;

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
// Retorna un array de decisiones ordenadas por score DESC.
// Acepta flags para feature flags dinámicos.

export function evaluateUserState({ profile, behavior, flags = {} }) {
  if (!profile) {
    return [
      createDecision({
        id: 'fallback',
        type: 'AMBIENT',
        priority: PRIORITY.AMBIENT,
        reason: 'no_profile',
        message: '¡Tu aventura de aprendizaje empieza ahora! 🚀',
        ctx: null,
        userState: 'neutral',
      }),
    ];
  }

  const ctx       = buildContext(profile);
  const userState = getUserState(behavior);
  const decisions = [];

  // ── ONBOARDING (bloquea el resto si activo) ───────────────────────────────
  if (!behavior?.onboarding_completed) {
    const step = behavior?.onboarding_step || 0;
    const onboardingStep = ONBOARDING_STEPS[step];
    if (onboardingStep) {
      const d = createDecision({
        id: `onboarding_step_${step}`,
        type: 'ONBOARDING',
        priority: PRIORITY.ONBOARDING,
        reason: 'onboarding_incomplete',
        message: onboardingStep.text,
        cta: { label: onboardingStep.label, route: onboardingStep.route },
        ctx,
        userState,
      });
      d.payload.messageType = 'onboarding';
      d.payload.onboardingStep = step;
      return [d];
    }
  }

  // ── RECOVERY — usuario desenganchado ──────────────────────────────────────
  if (userState === 'at_risk') {
    decisions.push(createDecision({
      id: 'recovery',
      type: 'RECOVERY',
      priority: PRIORITY.RECOVERY,
      reason: 'low_engagement_score',
      message: '👀 Hace tiempo que no avanzas… retomemos poco a poco.',
      cta: { label: 'Volver ahora', route: '/Dashboard' },
      ctx,
      userState,
    }));
  }

  // ── URGENT — Racha en riesgo ──────────────────────────────────────────────
  if (ctx.streakAtRisk) {
    const h = ctx.hoursUntilDayEnd;
    const urgencyLevel = h <= 2 ? 'critical' : h <= 6 ? 'high' : 'low';
    const urgencyText = {
      low:      `⏳ Te quedan ${h}h para no perder tu racha de ${ctx.streakDays} días. Haz una lección.`,
      high:     `⚠️ Últimas ${h}h. Tu racha de ${ctx.streakDays} días está en peligro.`,
      critical: `🚨 ÚLTIMO AVISO. Pierdes ${ctx.streakDays} días de racha si no estudias ahora.`,
    };
    const d = createDecision({
      id: 'save_streak',
      type: 'URGENT',
      priority: PRIORITY.URGENT,
      reason: 'streak_at_risk',
      message: urgencyText[urgencyLevel],
      cta: { label: 'Salvar mi racha', route: '/Dashboard' },
      ctx,
      userState,
    });
    d.payload.urgencyLevel = urgencyLevel;
    decisions.push(d);
  }

  // ── OPPORTUNITY — Nivel próximo ───────────────────────────────────────────
  if (ctx.xpToNextLevel > 0 && ctx.xpToNextLevel <= 50) {
    decisions.push(createDecision({
      id: 'level_up_imminent',
      type: 'OPPORTUNITY',
      priority: PRIORITY.OPPORTUNITY,
      reason: 'close_to_level_up',
      message: `⚡ Estás a solo ${ctx.xpToNextLevel} XP del Nivel ${ctx.level + 1}. ¡Una lección te lleva ahí!`,
      cta: { label: 'Subir de nivel', route: '/Dashboard' },
      ctx,
      userState,
    }));
  }

  // ── OPPORTUNITY — Meta semanal casi terminada ─────────────────────────────
  if (ctx.lessonsNeededForWeeklyGoal !== null && ctx.lessonsNeededForWeeklyGoal > 0 && ctx.lessonsNeededForWeeklyGoal <= 2) {
    decisions.push(createDecision({
      id: 'complete_weekly_goal',
      type: 'OPPORTUNITY',
      priority: PRIORITY.OPPORTUNITY,
      reason: 'weekly_goal_near_completion',
      message: `📅 Te faltan solo ${ctx.lessonsNeededForWeeklyGoal} lección(es) para completar tu meta semanal.`,
      cta: { label: 'Terminar mi meta', route: '/Dashboard' },
      ctx,
      userState,
    }));
  }

  // ── OPPORTUNITY — Feature flag: doble XP ─────────────────────────────────
  if (flags.XP_MULTIPLIER_ENABLED && !ctx.todayStudied) {
    decisions.push(createDecision({
      id: 'xp_multiplier',
      type: 'OPPORTUNITY',
      priority: PRIORITY.OPPORTUNITY,
      reason: 'xp_multiplier_active',
      message: '🔥 ¡Doble XP disponible por tiempo limitado! Estudia ahora y duplica tus puntos.',
      cta: { label: 'Aprovechar bonus', route: '/Dashboard' },
      ctx,
      userState,
    }));
  }

  // ── OPPORTUNITY — Economía conductual: doble XP (orgánico) ───────────────
  if (!flags.XP_MULTIPLIER_ENABLED && !ctx.todayStudied && !ctx.streakAtRisk) {
    decisions.push(createDecision({
      id: 'double_xp',
      type: 'OPPORTUNITY',
      priority: PRIORITY.OPPORTUNITY,
      reason: 'first_study_bonus',
      message: '🔥 Estudia ahora y tus lecciones de hoy valen el doble de XP. Solo por hoy.',
      cta: { label: 'Aprovechar bonus', route: '/Dashboard' },
      ctx,
      userState,
    }));
  }

  // ── MISSION — Desafío diario ──────────────────────────────────────────────
  if (!ctx.examDoneToday) {
    decisions.push(createDecision({
      id: 'do_daily_challenge',
      type: 'MISSION',
      priority: PRIORITY.MISSION,
      reason: 'daily_challenge_pending',
      message: '🎯 Tu desafío diario está disponible. Complétalo y gana XP extra.',
      cta: { label: 'Aceptar desafío', route: '/SurpriseExam' },
      ctx,
      userState,
    }));
  }

  // ── MISSION — Agua disponible ─────────────────────────────────────────────
  if (ctx.waterTokens > 0) {
    decisions.push(createDecision({
      id: 'water_tree',
      type: 'MISSION',
      priority: PRIORITY.MISSION,
      reason: 'water_tokens_available',
      message: `💧 Tienes ${ctx.waterTokens} token${ctx.waterTokens > 1 ? 's' : ''} de agua. Tu árbol puede crecer ahora.`,
      cta: { label: 'Regar mi árbol', route: '/Rewards' },
      ctx,
      userState,
    }));
  }

  // ── MISSION — Progreso semanal ────────────────────────────────────────────
  if (ctx.weeklyTarget && !ctx.weeklyGoalCompleted) {
    decisions.push(createDecision({
      id: 'progress_weekly',
      type: 'MISSION',
      priority: PRIORITY.MISSION,
      reason: 'weekly_progress_reminder',
      message: `📖 Llevas ${ctx.weeklyProgress}/${ctx.weeklyTarget} lecciones esta semana. Sigues a tiempo.`,
      cta: { label: 'Continuar', route: '/Dashboard' },
      ctx,
      userState,
    }));
  }

  // ── AMBIENT — Racha activa ────────────────────────────────────────────────
  if (ctx.streakDays >= 2 && ctx.todayStudied) {
    decisions.push(createDecision({
      id: 'streak_active',
      type: 'AMBIENT',
      priority: PRIORITY.AMBIENT,
      reason: 'streak_ongoing',
      message: `🔥 ¡${ctx.streakDays} días de racha! La constancia es tu superpoder.`,
      ctx,
      userState,
    }));
  }

  // ── AMBIENT — Saludo por hora ─────────────────────────────────────────────
  const h = ctx.now.getUTCHours();
  const greetText = h >= 5 && h < 12
    ? '🌞 Buenos días. Empezar el día estudiando te da ventaja. ¡Vamos!'
    : h < 19
    ? '👋 ¿Listo para continuar donde te quedaste? Aún hay tiempo hoy.'
    : '🌙 Cerrar el día aprendiendo algo nuevo siempre vale la pena 📚';

  decisions.push(createDecision({
    id: 'greeting',
    type: 'AMBIENT',
    priority: PRIORITY.AMBIENT,
    reason: 'time_based_greeting',
    message: greetText,
    ctx,
    userState,
  }));

  // Ordenar por score descendente (scoring completo aplicado)
  return decisions.sort((a, b) => b.score - a.score);
}

// ─── getTopDecision ───────────────────────────────────────────────────────────
// Recibe decisiones ya filtradas por cooldown, devuelve la de mayor score.

export function getTopDecision(decisions, lastMessageType) {
  const messages = decisions.filter(d => d.payload?.text);
  if (!messages.length) return null;

  const top = messages[0];
  // Evitar el mismo tipo consecutivo (salvo urgentes)
  if (
    lastMessageType &&
    top.id === lastMessageType &&
    top.type !== 'URGENT'
  ) {
    return messages[1] || top;
  }

  return top;
}

// ─── buildLoginDecision ───────────────────────────────────────────────────────

export function buildLoginDecision({ name, profile, behavior }) {
  const ctx = profile ? buildContext(profile) : null;
  const userState = getUserState(behavior);

  if (!profile) {
    return createDecision({
      id: 'login_welcome',
      type: 'AMBIENT',
      priority: PRIORITY.AMBIENT,
      reason: 'login_event',
      message: 'Bienvenido de nuevo. ¡Sigue avanzando hoy! 🚀',
      ctx,
      userState,
    });
  }

  const h = ctx.now.getUTCHours();
  const firstName = name?.split(' ')[0] || 'estudiante';
  const saludo = h >= 5 && h < 12 ? `🌞 ¡Buenos días, ${firstName}!`
    : h < 19 ? `☀️ ¡Buenas tardes, ${firstName}!`
    : `🌙 ¡Buenas noches, ${firstName}!`;

  const allDecisions  = evaluateUserState({ profile, behavior });
  const topDecision   = allDecisions[0];

  const d = createDecision({
    id: 'login_welcome',
    type: 'AMBIENT',
    priority: PRIORITY.AMBIENT,
    reason: 'login_event',
    message: `${saludo} ${topDecision?.message || '¡Sigue avanzando!'}`,
    cta: topDecision?.cta || null,
    ctx,
    userState,
  });
  d.payload.isReactive = true;
  d.payload.duration   = 12000;
  d.payload.messageType = 'login';
  return d;
}

// ─── buildReactiveDecision ────────────────────────────────────────────────────

const REACTIVE_DURATION = {
  level_up: 20000,
  achievement_unlocked: 18000,
  daily_exam_completed: 14000,
  lesson_completed: 8000,
  xp_gained: 8000,
  default: 12000,
};

export function buildReactiveDecision(eventType, payload, ctx) {
  const userState = 'neutral';
  let message = null;

  switch (eventType) {
    case 'lesson_completed': {
      const xpGain = payload?.xp || 0;
      const title  = payload?.lessonTitle;
      message = title
        ? `📚 "${title}" completada. +${xpGain} XP ⚡`
        : `📚 ¡Lección completada! +${xpGain} XP ⚡`;
      if (ctx?.xpToNextLevel > 0) message += ` Estás a ${ctx.xpToNextLevel} XP del Nivel ${ctx.level + 1}.`;
      break;
    }
    case 'quiz_perfect_score':
      message = `💯 ¡Puntuación PERFECTA! +${payload?.xp || 0} XP 🏆`;
      break;
    case 'xp_gained': {
      if (!payload?.xp) return null;
      message = `⚡ +${payload.xp} XP ganados. Total: ${ctx?.xp || '??'} XP.`;
      if (ctx?.xpToNextLevel > 0) message += ` Faltan ${ctx.xpToNextLevel} XP para el Nivel ${ctx?.level + 1}.`;
      break;
    }
    case 'level_up':
      message = payload?.level
        ? `🎉 ¡SUBISTE AL NIVEL ${payload.level}! Con ${ctx?.xp || '??'} XP acumulados. ¡Nuevo reto desbloqueado!`
        : `🎉 ¡NUEVO NIVEL! Sigue así.`;
      break;
    case 'tree_watered':
      message = payload?.stage !== undefined
        ? `💧 ¡Árbol en Etapa ${payload.stage}! Sigue regando para verlo florecer 🌳`
        : `💧 ¡Tu árbol ha crecido!`;
      break;
    case 'streak_updated':
      message = payload?.streak_days
        ? `🔥 ¡${payload.streak_days} día${payload.streak_days > 1 ? 's' : ''} de racha! Mañana, día ${payload.streak_days + 1}.`
        : `🔥 ¡Racha activa! Cada día cuenta.`;
      break;
    case 'streak_lost':
      message = `💔 Perdiste tu racha. Pero HOY puedes empezar una nueva. ¡El primer paso es el más importante!`;
      break;
    case 'daily_exam_completed': {
      const score    = payload?.score;
      const xpEarned = payload?.xp_earned;
      message = score !== undefined && xpEarned !== undefined
        ? `🎯 Desafío completado: ${score}% de aciertos. +${xpEarned} XP 🏆`
        : `🎯 ¡Desafío diario completado! XP extra en camino.`;
      break;
    }
    case 'achievement_unlocked':
      message = payload?.name
        ? `🏆 Logro desbloqueado: "${payload.name}" ✨`
        : `🏆 ¡Nuevo logro desbloqueado!`;
      break;
    default:
      return null;
  }

  if (!message) return null;

  const d = createDecision({
    id: eventType,
    type: 'URGENT',
    priority: PRIORITY.URGENT,
    reason: `reactive_${eventType}`,
    message,
    ctx,
    userState,
  });
  d.payload.isReactive = true;
  d.payload.duration   = REACTIVE_DURATION[eventType] || REACTIVE_DURATION.default;
  return d;
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
    if (t === 'xp_gained')               totalXP += event.data?.xp || 0;
    else if (t === 'lesson_completed')    lessons += 1;
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
    let msg = parts.length > 1 ? `🔥 ¡Gran sesión! ${parts.join(', ')}.` : `📚 ¡${parts[0]}!`;
    if (ctx?.xpToNextLevel > 0) msg += ` Estás a ${ctx.xpToNextLevel} XP del Nivel ${ctx.level + 1}.`;

    decisions.push(createDecision({
      id: 'queued_summary',
      type: 'URGENT',
      priority: PRIORITY.URGENT,
      reason: 'queued_events_summary',
      message: msg,
      ctx,
      userState: 'neutral',
    }));
  }

  decisions.push(...standalone);
  return decisions;
}