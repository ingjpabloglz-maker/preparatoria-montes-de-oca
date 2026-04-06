import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ASSISTANT_EVENT_KEY, getAssistantQueue, clearAssistantQueue, setAssistantActive } from '@/lib/assistantEvents';

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const MATAMOROS_TZ = 'America/Matamoros';
const MAX_PASSIVE_PER_DAY = 4;
const MIN_PASSIVE_INTERVAL_MS = 90 * 60 * 1000;
const PASSIVE_DURATION = 13000;
const REACTIVE_DURATION = {
  level_up: 20000,
  achievement_unlocked: 18000,
  daily_exam_completed: 14000,
  lesson_completed: 8000,
  xp_gained: 8000,
  default: 12000,
};

// ─── UTILIDADES DE FECHA (Matamoros) ─────────────────────────────────────────

const getMatamorosNow = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MATAMOROS_TZ,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(now);
  const g = (type) => parseInt(parts.find(p => p.type === type).value);
  return new Date(Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')));
};

const toDateStr = (dateObj) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: MATAMOROS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dateObj);

const getLevelFromXP = (xp) => Math.max(1, Math.floor(Math.sqrt(xp / 10)));
const getMinXpForLevel = (lvl) => Math.pow(lvl, 2) * 10;
const getNextLevelXp = (lvl) => Math.pow(lvl + 1, 2) * 10;

// ─── CONTEXTO ────────────────────────────────────────────────────────────────

function buildContext(profile) {
  const now = getMatamorosNow();
  const todayString = toDateStr(now);
  const yesterday = new Date(now);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayString = toDateStr(yesterday);

  const xp = profile?.xp_points || 0;
  const level = getLevelFromXP(xp);
  const minXp = getMinXpForLevel(level);
  const nextXp = getNextLevelXp(level);
  const xpToNextLevel = Math.max(0, nextXp - xp);
  const xpIntoLevel = xp - minXp;
  const canLevelUpNow = xpToNextLevel <= 0;

  const streakDays = profile?.streak_days || 0;
  const lastStudy = profile?.last_study_date_normalized;
  const todayStudied = lastStudy === todayString;
  // racha en riesgo = tiene racha, no estudió hoy, y su último estudio NO fue ayer (ya pasó más de un día)
  const streakAtRisk = streakDays > 0 && !todayStudied;

  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const hoursUntilDayEnd = Math.max(0, 23 - currentHour + (currentMinute === 0 ? 0 : 0));

  const examDoneToday = profile?.last_surprise_exam_date_normalized === todayString;
  const waterTokens = profile?.water_tokens || 0;

  const weeklyTarget = profile?.weekly_goal_target || null;
  const weeklyProgress = profile?.weekly_goal_progress || 0;
  const lessonsNeededForWeeklyGoal = weeklyTarget ? Math.max(0, weeklyTarget - weeklyProgress) : null;
  const weeklyGoalCompleted = weeklyTarget && weeklyProgress >= weeklyTarget;

  return {
    now, todayString, yesterdayString,
    xp, level, xpToNextLevel, xpIntoLevel, canLevelUpNow,
    streakDays, lastStudy, todayStudied, streakAtRisk,
    hoursUntilDayEnd,
    examDoneToday, waterTokens,
    weeklyTarget, weeklyProgress, lessonsNeededForWeeklyGoal, weeklyGoalCompleted,
  };
}

// ─── ESTADO EMOCIONAL ────────────────────────────────────────────────────────

function getUserState(behavior) {
  if (!behavior) return 'neutral';
  const score = behavior.engagement_score ?? 50;
  if (score < 30) return 'at_risk';
  if (score > 70) return 'engaged';
  return 'neutral';
}

// ─── ONBOARDING GUIADO ───────────────────────────────────────────────────────

const ONBOARDING_STEPS = [
  { text: '👋 Bienvenido. Comienza completando tu primera lección 📚', callToAction: { label: 'Ir a mi primera lección', route: '/Dashboard' } },
  { text: '🎯 ¡Bien hecho! Ahora prueba el desafío diario y gana XP extra', callToAction: { label: 'Aceptar desafío', route: '/SurpriseExam' } },
  { text: '🌱 Un último paso: riega tu árbol con tus tokens de agua', callToAction: { label: 'Ver mi árbol', route: '/Rewards' } },
];

function getOnboardingMessage(step) {
  return ONBOARDING_STEPS[step] || null;
}

// ─── NEXT BEST ACTION ────────────────────────────────────────────────────────

function getNextBestAction(ctx, behavior) {
  const userState = getUserState(behavior);

  // — at_risk: usuario desenganchado, mensaje de recuperación suave
  if (userState === 'at_risk') {
    return {
      action: 'recovery',
      label: '👀 Hace tiempo que no avanzas… retomemos poco a poco.',
      priority: 'URGENT',
      callToAction: { label: 'Volver ahora', route: '/Dashboard' },
    };
  }

  // 1. URGENT — Racha en riesgo con presión progresiva
  if (ctx.streakAtRisk) {
    const h = ctx.hoursUntilDayEnd;
    let urgencyLevel = 'low';
    if (h <= 6) urgencyLevel = 'high';
    if (h <= 2) urgencyLevel = 'critical';

    const labels = {
      low:      `⏳ Te quedan ${h}h para no perder tu racha de ${ctx.streakDays} días. Haz una lección.`,
      high:     `⚠️ Últimas ${h}h. Tu racha de ${ctx.streakDays} días está en peligro.`,
      critical: `🚨 ÚLTIMO AVISO. Pierdes ${ctx.streakDays} días de racha si no estudias ahora.`,
    };

    return {
      action: 'save_streak',
      label: labels[urgencyLevel],
      priority: 'URGENT',
      urgencyLevel,
      callToAction: { label: 'Salvar mi racha', route: '/Dashboard' },
    };
  }

  // 2. OPPORTUNITY — XP cerca del siguiente nivel
  if (ctx.xpToNextLevel > 0 && ctx.xpToNextLevel <= 50) {
    return {
      action: 'level_up_imminent',
      label: `⚡ Estás a solo ${ctx.xpToNextLevel} XP del Nivel ${ctx.level + 1}. ¡Una lección te lleva ahí!`,
      priority: 'OPPORTUNITY',
      callToAction: { label: 'Subir de nivel', route: '/Dashboard' },
      reward: `Nivel ${ctx.level + 1} desbloqueado`,
    };
  }

  // 3. OPPORTUNITY — Meta semanal casi terminada
  if (ctx.lessonsNeededForWeeklyGoal !== null && ctx.lessonsNeededForWeeklyGoal > 0 && ctx.lessonsNeededForWeeklyGoal <= 2) {
    return {
      action: 'complete_weekly_goal',
      label: `📅 Te faltan solo ${ctx.lessonsNeededForWeeklyGoal} lección(es) para completar tu meta semanal y ganar el bonus.`,
      priority: 'OPPORTUNITY',
      callToAction: { label: 'Terminar mi meta', route: '/Dashboard' },
      reward: '+50 XP y 3 estrellas de bonus',
    };
  }

  // 4. ECONOMÍA CONDUCTUAL — Bonus de doble XP si no estudió hoy
  if (!ctx.todayStudied) {
    return {
      action: 'double_xp',
      label: `🔥 Estudia ahora y tus lecciones de hoy valen el doble de XP. Solo por hoy.`,
      priority: 'OPPORTUNITY',
      callToAction: { label: 'Aprovechar bonus', route: '/Dashboard' },
      reward: 'XP x2 solo hoy',
    };
  }

  // 5. MISSION — Desafío diario disponible
  if (!ctx.examDoneToday) {
    return {
      action: 'do_daily_challenge',
      label: `🎯 Tu desafío diario está disponible. Complétalo ahora y gana XP extra.`,
      priority: 'MISSION',
      callToAction: { label: 'Aceptar desafío', route: '/SurpriseExam' },
    };
  }

  // 6. MISSION — Agua disponible para el árbol
  if (ctx.waterTokens > 0) {
    return {
      action: 'water_tree',
      label: `💧 Tienes ${ctx.waterTokens} token${ctx.waterTokens > 1 ? 's' : ''} de agua. Tu árbol puede crecer ahora.`,
      priority: 'MISSION',
      callToAction: { label: 'Regar mi árbol', route: '/Rewards' },
    };
  }

  // 7. MISSION — Progreso semanal general
  if (ctx.weeklyTarget && !ctx.weeklyGoalCompleted) {
    return {
      action: 'progress_weekly',
      label: `📖 Llevas ${ctx.weeklyProgress}/${ctx.weeklyTarget} lecciones esta semana. Sigues a tiempo.`,
      priority: 'MISSION',
      callToAction: { label: 'Continuar', route: '/Dashboard' },
    };
  }

  // 8. AMBIENT — Racha activa celebración
  if (ctx.streakDays >= 2 && ctx.todayStudied) {
    return {
      action: 'streak_active',
      label: `🔥 ¡${ctx.streakDays} días de racha! La constancia es tu superpoder.`,
      priority: 'AMBIENT',
    };
  }

  // 9. AMBIENT — Saludo por hora
  const h = ctx.now.getUTCHours();
  const greet = h >= 5 && h < 12
    ? '🌞 Buenos días. Empezar el día estudiando te da ventaja. ¡Vamos!'
    : h < 19
    ? '👋 ¿Listo para continuar donde te quedaste? Aún hay tiempo hoy.'
    : '🌙 Cerrar el día aprendiendo algo nuevo siempre vale la pena 📚';

  return { action: 'greeting', label: greet, priority: 'AMBIENT' };
}

// ─── MEMORIA DEL USUARIO ─────────────────────────────────────────────────────

async function trackAssistantInteraction(userEmail, type, actionTaken) {
  const records = await base44.entities.AssistantBehavior.filter({ user_email: userEmail });
  let state = records[0];

  if (!state) {
    state = await base44.entities.AssistantBehavior.create({
      user_email: userEmail,
      messages_ignored: 0,
      messages_clicked: 0,
      engagement_score: 50,
      onboarding_step: 0,
      onboarding_completed: false,
    });
  }

  const update = { last_interaction_at: new Date().toISOString() };

  if (type === 'ignored') {
    update.messages_ignored = (state.messages_ignored || 0) + 1;
    update.engagement_score = Math.max(0, (state.engagement_score ?? 50) - 5);
  } else if (type === 'clicked') {
    update.messages_clicked = (state.messages_clicked || 0) + 1;
    update.engagement_score = Math.min(100, (state.engagement_score ?? 50) + 10);
    if (actionTaken) update.last_action_taken = actionTaken;
  }

  await base44.entities.AssistantBehavior.update(state.id, update);
}

async function advanceOnboardingStep(userEmail, currentStep) {
  const records = await base44.entities.AssistantBehavior.filter({ user_email: userEmail });
  const state = records[0];
  if (!state) return;

  const nextStep = currentStep + 1;
  const completed = nextStep >= ONBOARDING_STEPS.length;

  await base44.entities.AssistantBehavior.update(state.id, {
    onboarding_step: completed ? currentStep : nextStep,
    onboarding_completed: completed,
  });
}

// ─── MENSAJES DE LOGIN ────────────────────────────────────────────────────────

function buildLoginMessage(payload, behavior) {
  const { name, profile } = payload || {};
  if (!profile) return { text: 'Bienvenido de nuevo. ¡Sigue avanzando hoy! 🚀', type: 'login', isReactive: true, duration: 10000 };

  const firstName = name?.split(' ')[0] || 'estudiante';
  const ctx = buildContext(profile);
  const h = ctx.now.getUTCHours();
  const saludo = h >= 5 && h < 12 ? `🌞 ¡Buenos días, ${firstName}!`
    : h < 19 ? `☀️ ¡Buenas tardes, ${firstName}!`
    : `🌙 ¡Buenas noches, ${firstName}!`;

  const next = getNextBestAction(ctx, behavior);
  const rewardText = next.reward ? ` Recompensa: ${next.reward}.` : '';
  const text = `${saludo} ${next.label}${rewardText}`;

  return { text, type: 'login', isReactive: true, duration: 12000, callToAction: next.callToAction };
}

// ─── MENSAJES REACTIVOS ───────────────────────────────────────────────────────

function buildReactiveMessage(eventType, payload, ctx) {
  let text = null;

  switch (eventType) {
    case 'lesson_completed': {
      const xpGain = payload?.xp || 0;
      const title = payload?.lessonTitle;
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
        ? `🎉 ¡SUBISTE AL NIVEL ${payload.level}! Con ${ctx?.xp || '??'} XP acumulados. ¡Nuevo reto desbloqueado!`
        : `🎉 ¡NUEVO NIVEL! Sigue así.`;
      break;
    case 'tree_watered':
      text = payload?.stage !== undefined
        ? `💧 ¡Árbol en Etapa ${payload.stage}! Sigue regando para verlo florecer 🌳`
        : `💧 ¡Tu árbol ha crecido!`;
      break;
    case 'streak_updated':
      text = payload?.streak_days
        ? `🔥 ¡${payload.streak_days} día${payload.streak_days > 1 ? 's' : ''} de racha! Eres imparable. Mañana, día ${payload.streak_days + 1}.`
        : `🔥 ¡Racha activa! Cada día cuenta.`;
      break;
    case 'streak_lost':
      text = `💔 Perdiste tu racha. Pero HOY puedes empezar una nueva. ¡El primer paso es el más importante!`;
      break;
    case 'daily_exam_completed': {
      const score = payload?.score;
      const xpEarned = payload?.xp_earned;
      text = score !== undefined && xpEarned !== undefined
        ? `🎯 Desafío completado: ${score}% de aciertos. +${xpEarned} XP 🏆`
        : `🎯 ¡Desafío diario completado! XP extra en camino.`;
      break;
    }
    case 'achievement_unlocked':
      text = payload?.name
        ? `🏆 Logro desbloqueado: "${payload.name}" ✨ ¡Un hito más en tu historial!`
        : `🏆 ¡Nuevo logro desbloqueado!`;
      break;
    default:
      return null;
  }

  if (!text) return null;
  return { text, type: eventType, isReactive: true, duration: REACTIVE_DURATION[eventType] || REACTIVE_DURATION.default };
}

// ─── MENSAJES PASIVOS ────────────────────────────────────────────────────────

function selectPassiveMessage(profile, assistantState, behavior) {
  if (!profile) return { text: '¡Tu aventura de aprendizaje empieza ahora! 🚀', type: 'fallback', priority: 'AMBIENT' };

  // Onboarding guiado (tiene prioridad total)
  if (!behavior?.onboarding_completed) {
    const step = behavior?.onboarding_step || 0;
    const onboarding = getOnboardingMessage(step);
    if (onboarding) return { text: onboarding.text, type: 'onboarding', priority: 'MISSION', callToAction: onboarding.callToAction };
  }

  const ctx = buildContext(profile);
  const next = getNextBestAction(ctx, behavior);
  const lastType = assistantState?.last_message_type || '';

  // Evitar repetir el mismo tipo pasivo consecutivo (excepto urgentes)
  if (next.action === lastType && next.priority !== 'URGENT') {
    return { text: '👋 ¿Listo para seguir aprendiendo hoy?', type: 'generic_nudge', priority: 'AMBIENT' };
  }

  return {
    text: next.label,
    type: next.action,
    priority: next.priority,
    callToAction: next.callToAction || null,
  };
}

// ─── AGRUPADOR DE COLA ────────────────────────────────────────────────────────

function groupQueuedEvents(queue, ctx) {
  if (!queue.length) return [];

  let totalXP = 0;
  let lessons = 0;
  let achievements = 0;
  const standalone = [];

  for (const event of queue) {
    const t = event.type;
    if (t === 'xp_gained')          totalXP += event.data?.xp || 0;
    else if (t === 'lesson_completed') lessons += 1;
    else if (t === 'achievement_unlocked') achievements += 1;
    else if (['level_up', 'streak_updated', 'daily_exam_completed'].includes(t)) {
      const msg = buildReactiveMessage(t, event.data, ctx);
      if (msg) standalone.push(msg);
    }
  }

  const messages = [];

  if (lessons > 0 || totalXP > 0 || achievements > 0) {
    const parts = [];
    if (lessons > 0) parts.push(`${lessons} lección${lessons > 1 ? 'es' : ''} completada${lessons > 1 ? 's' : ''}`);
    if (totalXP > 0) parts.push(`+${totalXP} XP`);
    if (achievements > 0) parts.push(`${achievements} logro${achievements > 1 ? 's' : ''} nuevo${achievements > 1 ? 's' : ''}`);
    let text = parts.length > 1 ? `🔥 ¡Gran sesión! ${parts.join(', ')}.` : `${parts[0] ? `📚 ¡${parts[0]}!` : ''}`;
    if (ctx?.xpToNextLevel > 0) text += ` Estás a ${ctx.xpToNextLevel} XP del Nivel ${ctx.level + 1}.`;
    messages.push({ text, type: 'queued_summary', isReactive: true, duration: 10000 });
  }

  messages.push(...standalone);
  return messages;
}

// ─── HOOK PRINCIPAL ───────────────────────────────────────────────────────────

export function useAssistant({ userEmail, profile, allowedPages, currentPage }) {
  const [message, setMessage] = useState(null);
  const [visible, setVisible] = useState(false);

  const queueRef = useRef([]);
  const isShowingRef = useRef(false);
  const hideTimerRef = useRef(null);
  const assistantStateRef = useRef(null);
  const behaviorRef = useRef(null);
  const ctxRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();

  const isAllowed = allowedPages.includes(currentPage);
  const isActiveRoute =
    location.pathname.toLowerCase().includes('dashboard') ||
    location.pathname.toLowerCase().includes('rewards');

  // Recalcular contexto cuando cambia el perfil
  useEffect(() => {
    if (profile) ctxRef.current = buildContext(profile);
  }, [profile]);

  // ── showNext ────────────────────────────────────────────────────────────────
  const showNext = useCallback(() => {
    if (queueRef.current.length === 0) { isShowingRef.current = false; return; }
    isShowingRef.current = true;
    const next = queueRef.current.shift();
    setMessage(next);
    setVisible(true);

    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(showNext, 500);
    }, next.duration || PASSIVE_DURATION);
  }, []);

  // ── enqueue ──────────────────────────────────────────────────────────────────
  const enqueue = useCallback((msg) => {
    if (!isAllowed) return;
    queueRef.current.push(msg);
    if (!isShowingRef.current) showNext();
  }, [isAllowed, showNext]);

  // ── dismiss (trackea "ignored") ──────────────────────────────────────────────
  const dismiss = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    setVisible(false);
    queueRef.current = [];
    isShowingRef.current = false;
    if (userEmail) trackAssistantInteraction(userEmail, 'ignored');
  }, [userEmail]);

  // ── handleCTA (navega + trackea "clicked") ───────────────────────────────────
  const handleCTA = useCallback((msg) => {
    if (!msg?.callToAction?.route) return;
    navigate(msg.callToAction.route);
    if (userEmail) trackAssistantInteraction(userEmail, 'clicked', msg.type);
    // Si era onboarding, avanzar al siguiente paso
    if (msg.type === 'onboarding' && behaviorRef.current) {
      const step = behaviorRef.current.onboarding_step || 0;
      advanceOnboardingStep(userEmail, step).then(() => {
        behaviorRef.current = { ...behaviorRef.current, onboarding_step: step + 1 };
      });
    }
    dismiss();
  }, [navigate, userEmail, dismiss]);

  // ── setAssistantActive ───────────────────────────────────────────────────────
  useEffect(() => {
    setAssistantActive(isAllowed && isActiveRoute);
    return () => setAssistantActive(false);
  }, [isAllowed, isActiveRoute]);

  // ── Escuchar eventos reactivos ───────────────────────────────────────────────
  useEffect(() => {
    if (!isAllowed) return;
    const handler = (e) => {
      const { eventType, payload } = e.detail;
      if (eventType === 'login') {
        enqueue(buildLoginMessage(payload, behaviorRef.current));
        return;
      }
      const msg = buildReactiveMessage(eventType, payload, ctxRef.current);
      if (msg) enqueue(msg);
    };
    window.addEventListener(ASSISTANT_EVENT_KEY, handler);
    return () => window.removeEventListener(ASSISTANT_EVENT_KEY, handler);
  }, [isAllowed, enqueue]);

  // ── Procesar cola persistente al montar ──────────────────────────────────────
  useEffect(() => {
    if (!isAllowed) return;
    const queue = getAssistantQueue();
    if (!queue.length) return;
    clearAssistantQueue();
    const cutoff = Date.now() - 30 * 60 * 1000;
    const recent = queue.filter(e => e.timestamp >= cutoff);
    const grouped = groupQueuedEvents(recent, ctxRef.current);
    grouped.forEach((msg, i) => setTimeout(() => enqueue(msg), 800 * i));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllowed]);

  // ── Mensajes pasivos (carga inicial) ────────────────────────────────────────
  useEffect(() => {
    if (!userEmail || !profile || !isAllowed) return;

    const loadPassive = async () => {
      const today = toDateStr(getMatamorosNow());
      const now = new Date();

      // Cargar AssistantState (contador diario)
      let stateRecords = await base44.entities.AssistantState.filter({ user_email: userEmail });
      let state = stateRecords[0] || null;

      if (state && state.last_reset_date !== today) {
        state = await base44.entities.AssistantState.update(state.id, { messages_shown_today: 0, last_reset_date: today });
      }
      if (!state) {
        state = await base44.entities.AssistantState.create({ user_email: userEmail, messages_shown_today: 0, last_reset_date: today });
      }
      assistantStateRef.current = state;

      // Cargar AssistantBehavior (memoria del usuario)
      let behaviorRecords = await base44.entities.AssistantBehavior.filter({ user_email: userEmail });
      let behavior = behaviorRecords[0] || null;
      if (!behavior) {
        behavior = await base44.entities.AssistantBehavior.create({
          user_email: userEmail,
          messages_ignored: 0,
          messages_clicked: 0,
          engagement_score: 50,
          onboarding_step: 0,
          onboarding_completed: false,
        });
      }
      behaviorRef.current = behavior;

      // Verificar límites
      if ((state.messages_shown_today || 0) >= MAX_PASSIVE_PER_DAY) return;
      if (state.last_message_seen_at) {
        const elapsed = now - new Date(state.last_message_seen_at);
        if (elapsed < MIN_PASSIVE_INTERVAL_MS) return;
      }

      const { text, type, priority, callToAction } = selectPassiveMessage(profile, state, behavior);
      const newCount = (state.messages_shown_today || 0) + 1;

      await base44.entities.AssistantState.update(state.id, {
        messages_shown_today: newCount,
        last_message_type: type,
        last_message_text: text,
        last_message_seen_at: now.toISOString(),
      });

      enqueue({ text, type, isReactive: false, duration: PASSIVE_DURATION, priority, callToAction });
    };

    const t = setTimeout(loadPassive, 4000);
    return () => { clearTimeout(t); clearTimeout(hideTimerRef.current); };
  }, [userEmail, profile?.xp_points, profile?.streak_days, isAllowed]);

  return { message, visible, dismiss, handleCTA };
}