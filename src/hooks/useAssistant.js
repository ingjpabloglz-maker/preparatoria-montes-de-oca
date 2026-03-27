import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ASSISTANT_EVENT_KEY, getAssistantQueue, clearAssistantQueue, setAssistantActive } from '@/lib/assistantEvents';

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

function buildContext(profile) {
  const today = new Date().toISOString().split('T')[0];
  const xp = profile?.xp_points || 0;
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 10)));
  const nextLevelXP = Math.pow(level + 1, 2) * 10;
  const progressToNextLevel = Math.min(100, Math.round((xp / nextLevelXP) * 100));
  const streakDays = profile?.streak_days || 0;
  const todayStudied = profile?.last_study_date_normalized === today;
  const examDoneToday = profile?.last_surprise_exam_date_normalized === today;
  const waterTokens = profile?.water_tokens || 0;
  const weeklyGoal = profile?.weekly_goal_target || 10;
  const weeklyProgress = profile?.weekly_goal_progress || 0;
  const weeklyPercent = Math.min(100, Math.round((weeklyProgress / weeklyGoal) * 100));

  return {
    today, xp, level, nextLevelXP, progressToNextLevel,
    streakDays, todayStudied, examDoneToday,
    waterTokens, weeklyGoal, weeklyProgress, weeklyPercent,
  };
}

// ─── MENSAJES DE LOGIN ────────────────────────────────────────────────────────

function buildLoginMessage(payload) {
  const { name, profile } = payload || {};
  if (!profile) return { text: 'Bienvenido de nuevo, sigue avanzando hoy 🚀', type: 'login', isReactive: true, duration: 10000 };

  const firstName = name?.split(' ')[0] || 'estudiante';
  const hour = new Date().getHours();
  const ctx = buildContext(profile);

  let saludo = '';
  if (hour >= 5 && hour < 12) saludo = `🌞 ¡Buenos días, ${firstName}!`;
  else if (hour >= 12 && hour < 19) saludo = `☀️ ¡Buenas tardes, ${firstName}!`;
  else saludo = `🌙 ¡Buenas noches, ${firstName}!`;

  let texto = saludo;

  // Prioridad 1: racha en riesgo (tiene racha pero no estudió hoy)
  if (ctx.streakDays > 0 && !ctx.todayStudied) {
    texto += ` 🔥 Tu racha de ${ctx.streakDays} día${ctx.streakDays > 1 ? 's' : ''} está en riesgo, ¡estudia hoy!`;
  // Prioridad 2: tiene racha activa
  } else if (ctx.streakDays >= 2) {
    texto += ` 🔥 Llevas ${ctx.streakDays} días de racha, ¡no la pierdas!`;
  // Prioridad 3: desafío disponible
  } else if (!ctx.examDoneToday) {
    texto += ` 🎯 Tienes el desafío diario disponible. ¡Gana XP extra!`;
  // Prioridad 4: árbol sin regar
  } else if (ctx.waterTokens > 0) {
    texto += ` 💧 Tienes ${ctx.waterTokens} token${ctx.waterTokens > 1 ? 's' : ''} de agua para regar tu árbol.`;
  // Prioridad 5: cerca de subir de nivel
  } else if (ctx.progressToNextLevel >= 75) {
    texto += ` ⚡ Estás al ${ctx.progressToNextLevel}% del siguiente nivel, ¡ya casi!`;
  } else {
    texto += ` Listo para seguir aprendiendo hoy 📚`;
  }

  return { text: texto, type: 'login', isReactive: true, duration: 12000 };
}

// ─── DURACIÓN POR TIPO ────────────────────────────────────────────────────────

const REACTIVE_DURATION = {
  level_up: 20000,
  achievement_unlocked: 18000,
  daily_exam_completed: 14000,
  default: 12000,
};

const PASSIVE_DURATION = 13000;

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── MENSAJES REACTIVOS (dinámicos con payload real) ─────────────────────────

function buildReactiveMessage(eventType, payload) {
  let text = null;

  switch (eventType) {
    case 'lesson_completed':
      text = payload?.lessonTitle
        ? `📚 Lección "${payload.lessonTitle}" completada ✅`
        : `📚 ¡Lección completada! Sigue así 💪`;
      break;
    case 'quiz_perfect_score':
      text = `💯 ¡Puntuación perfecta! Sin errores 🏆`;
      break;
    case 'xp_gained':
      text = payload?.xp ? `⚡ +${payload.xp} XP ganados` : null;
      break;
    case 'level_up':
      text = payload?.level ? `🎉 ¡Subiste al Nivel ${payload.level}!` : `🎉 ¡Subiste de nivel!`;
      break;
    case 'tree_watered':
      text = payload?.stage !== undefined
        ? `💧 ¡Árbol regado! Etapa ${payload.stage} 🌱`
        : `💧 Tu árbol ha crecido 🌳`;
      break;
    case 'streak_updated':
      text = payload?.streak_days
        ? `🔥 ¡Racha de ${payload.streak_days} día${payload.streak_days > 1 ? 's' : ''}!`
        : `🔥 ¡Racha activa! Sigue estudiando`;
      break;
    case 'streak_lost':
      text = `😢 Perdiste tu racha. Pero hoy puedes empezar una nueva 💪`;
      break;
    case 'daily_exam_completed': {
      const score = payload?.score;
      const xpEarned = payload?.xp_earned;
      if (score !== undefined && xpEarned !== undefined) {
        text = `🎯 Desafío completado: ${score}% de aciertos, +${xpEarned} XP 🏆`;
      } else if (score !== undefined) {
        text = `🎯 Desafío completado con ${score}% ¡Bien hecho!`;
      } else {
        text = `🎯 ¡Desafío diario completado! XP extra ganado ⚡`;
      }
      break;
    }
    case 'achievement_unlocked':
      text = payload?.name
        ? `🏆 Logro desbloqueado: "${payload.name}" ✨`
        : `🏆 ¡Nuevo logro desbloqueado!`;
      break;
    default:
      return null;
  }

  if (!text) return null;
  const duration = REACTIVE_DURATION[eventType] || REACTIVE_DURATION.default;
  return { text, type: eventType, isReactive: true, duration };
}

function selectPassiveMessage(profile, state) {
  if (!profile) return { text: 'Bienvenido de nuevo, sigue avanzando hoy 🚀', type: 'fallback' };

  const ctx = buildContext(profile);
  const lastType = state?.last_message_type || '';
  const hour = new Date().getHours();

  // Onboarding (usuario nuevo)
  if (!state?.onboarding_completed) {
    const onboardingMsgs = [
      '👋 Aquí puedes ver tu progreso diario y racha de estudio',
      '🌳 Usa tus tokens de agua para hacer crecer tu árbol del conocimiento',
      '🎯 Completa el desafío diario para ganar XP extra cada día',
      '⭐ Gana estrellas completando actividades y sube de nivel',
    ];
    const filtered = onboardingMsgs.filter(m => m !== state?.last_message_text);
    return { text: pickRandom(filtered.length ? filtered : onboardingMsgs), type: 'onboarding' };
  }

  // Sistema de prioridad basado en estado real
  // Prioridad 1: racha en riesgo (tiene racha pero no estudió hoy)
  if (ctx.streakDays > 0 && !ctx.todayStudied && lastType !== 'streak_risk') {
    return {
      text: `⚠️ Tu racha de ${ctx.streakDays} día${ctx.streakDays > 1 ? 's' : ''} está en riesgo. ¡Estudia hoy para salvarla!`,
      type: 'streak_risk',
    };
  }

  // Prioridad 2: muy cerca de subir de nivel (>= 80%)
  if (ctx.progressToNextLevel >= 80 && lastType !== 'xp_level') {
    return {
      text: `⚡ Estás al ${ctx.progressToNextLevel}% del Nivel ${ctx.level + 1}. ¡Ya casi llegas!`,
      type: 'xp_level',
    };
  }

  // Prioridad 3: desafío diario disponible
  if (!ctx.examDoneToday && lastType !== 'challenge_available') {
    return {
      text: `🎯 Aún no hiciste el desafío diario. ¡Complétalo y gana XP extra!`,
      type: 'challenge_available',
    };
  }

  // Prioridad 4: tiene agua para regar árbol
  if (ctx.waterTokens > 0 && lastType !== 'tree_water') {
    return {
      text: `💧 Tienes ${ctx.waterTokens} token${ctx.waterTokens > 1 ? 's' : ''} de agua disponible${ctx.waterTokens > 1 ? 's' : ''}. ¡Riega tu árbol!`,
      type: 'tree_water',
    };
  }

  // Prioridad 5: meta semanal en buen progreso
  if (ctx.weeklyPercent >= 50 && ctx.weeklyPercent < 100 && lastType !== 'weekly_goal') {
    return {
      text: `📅 Llevas ${ctx.weeklyProgress} de ${ctx.weeklyGoal} lecciones esta semana (${ctx.weeklyPercent}%). ¡Vas muy bien!`,
      type: 'weekly_goal',
    };
  }

  // Prioridad 6: racha activa > 1 día
  if (ctx.streakDays >= 2 && ctx.todayStudied && lastType !== 'streak_active') {
    return {
      text: `🔥 ¡${ctx.streakDays} días de racha! La constancia es tu superpoder 💪`,
      type: 'streak_active',
    };
  }

  // Fallback: saludo según hora
  const hour12 = hour;
  let text = '';
  if (hour12 >= 5 && hour12 < 12) text = '🌞 Buenos días. Empezar el día estudiando te da ventaja. ¡Vamos!';
  else if (hour12 >= 12 && hour12 < 19) text = '👋 ¿Listo para continuar donde te quedaste? Aún hay tiempo hoy.';
  else text = '🌙 Cerrar el día aprendiendo algo nuevo siempre vale la pena 📚';

  return { text, type: 'greeting' };
}

// ─── AGRUPADOR DE COLA ────────────────────────────────────────────────────────

function groupQueuedEvents(queue) {
  if (!queue.length) return [];

  // Acumular datos agrupables
  let totalXP = 0;
  let lessons = 0;
  let achievements = 0;
  const standalone = []; // eventos que siempre se muestran solos

  for (const event of queue) {
    const t = event.type;
    if (t === 'xp_gained') {
      totalXP += event.data?.xp || 0;
    } else if (t === 'lesson_completed') {
      lessons += 1;
    } else if (t === 'achievement_unlocked') {
      achievements += 1;
    } else if (t === 'level_up') {
      // level_up siempre sale individual
      const msg = buildReactiveMessage('level_up', event.data);
      if (msg) standalone.push(msg);
    } else if (t === 'streak_updated') {
      const msg = buildReactiveMessage('streak_updated', event.data);
      if (msg) standalone.push(msg);
    } else if (t === 'daily_exam_completed') {
      const msg = buildReactiveMessage('daily_exam_completed', event.data);
      if (msg) standalone.push(msg);
    }
    // login no se procesa desde cola (ya se maneja de otro modo)
  }

  const messages = [];

  // Mensaje agrupado de progreso
  if (lessons > 0 || totalXP > 0 || achievements > 0) {
    const parts = [];
    if (lessons > 0) parts.push(`${lessons} lección${lessons > 1 ? 'es' : ''} completada${lessons > 1 ? 's' : ''}`);
    if (totalXP > 0) parts.push(`+${totalXP} XP`);
    if (achievements > 0) parts.push(`${achievements} logro${achievements > 1 ? 's' : ''} nuevo${achievements > 1 ? 's' : ''}`);

    let text = '';
    if (parts.length === 1) {
      text = lessons > 0 ? `📚 ¡${parts[0]}!` : totalXP > 0 ? `⚡ ¡${parts[0]}!` : `🏆 ¡${parts[0]}!`;
    } else {
      text = `🔥 Gran avance: ${parts.join(', ')}`;
    }
    messages.push({ text, type: 'queued_summary', isReactive: true, duration: 10000 });
  }

  // Eventos individuales
  messages.push(...standalone);

  return messages;
}

// ─── HOOK PRINCIPAL ───────────────────────────────────────────────────────────

const MAX_PASSIVE_PER_DAY = 4;
const MIN_PASSIVE_INTERVAL_MS = 90 * 60 * 1000; // 90 min entre mensajes pasivos

export function useAssistant({ userEmail, profile, allowedPages, currentPage }) {
  const [message, setMessage] = useState(null);
  const [visible, setVisible] = useState(false);
  const queueRef = useRef([]); // cola de mensajes reactivos
  const isShowingRef = useRef(false);
  const hideTimerRef = useRef(null);
  const stateRef = useRef(null);

  const location = useLocation();
  const isAllowed = allowedPages.includes(currentPage);

  // assistantActive = true SOLO cuando la ruta es /dashboard o /rewards
  const isActiveRoute =
    location.pathname.toLowerCase().includes('dashboard') ||
    location.pathname.toLowerCase().includes('rewards');

  // ── Mostrar siguiente mensaje de la cola ──────────────────────────────────
  const showNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      isShowingRef.current = false;
      return;
    }
    isShowingRef.current = true;
    const next = queueRef.current.shift();
    setMessage(next);
    setVisible(true);

    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      // Esperar animación de salida, luego mostrar siguiente
      setTimeout(showNext, 500);
    }, next.duration || PASSIVE_DURATION);
  }, []);

  // ── Encolar y mostrar mensaje ─────────────────────────────────────────────
  const enqueue = useCallback((msg) => {
    if (!isAllowed) return;
    queueRef.current.push(msg);
    if (!isShowingRef.current) {
      showNext();
    }
  }, [isAllowed, showNext]);

  // ── Registrar si el asistente está en una ruta activa ────────────────────
  useEffect(() => {
    setAssistantActive(isAllowed && isActiveRoute);
    return () => setAssistantActive(false);
  }, [isAllowed, isActiveRoute]);

  // ── Escuchar eventos reactivos (despacho inmediato) ──────────────────────
  useEffect(() => {
    if (!isAllowed) return;

    const handler = (e) => {
      const { eventType, payload } = e.detail;
      if (eventType === 'login') {
        const msg = buildLoginMessage(payload);
        enqueue(msg);
        return;
      }
      const msg = buildReactiveMessage(eventType, payload);
      if (msg) enqueue(msg);
    };

    window.addEventListener(ASSISTANT_EVENT_KEY, handler);
    return () => window.removeEventListener(ASSISTANT_EVENT_KEY, handler);
  }, [isAllowed, enqueue]);

  // ── Procesar cola persistente (localStorage) al montar ───────────────────
  useEffect(() => {
    if (!isAllowed) return;

    const queue = getAssistantQueue();
    if (!queue.length) return;

    // Limpiar cola ANTES de procesar para evitar duplicados
    clearAssistantQueue();

    // Agrupar eventos similares ocurridos en los últimos 30 min
    const cutoff = Date.now() - 30 * 60 * 1000;
    const recent = queue.filter(e => e.timestamp >= cutoff);

    const grouped = groupQueuedEvents(recent);
    grouped.forEach(msg => {
      // Pequeño delay entre mensajes agrupados para no saturar
      setTimeout(() => enqueue(msg), 800);
    });
  // Solo al montar (isAllowed cambia cuando el componente entra en una página permitida)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllowed]);

  // ── Mensajes pasivos (carga inicial) ─────────────────────────────────────
  useEffect(() => {
    if (!userEmail || !profile || !isAllowed) return;

    const loadPassive = async () => {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();

      let records = await base44.entities.AssistantState.filter({ user_email: userEmail });
      let state = records[0] || null;

      if (state && state.last_reset_date !== today) {
        state = await base44.entities.AssistantState.update(state.id, {
          messages_shown_today: 0,
          last_reset_date: today,
        });
      }

      if (!state) {
        state = await base44.entities.AssistantState.create({
          user_email: userEmail,
          onboarding_completed: false,
          messages_shown_today: 0,
          last_reset_date: today,
        });
      }

      stateRef.current = state;

      if ((state.messages_shown_today || 0) >= MAX_PASSIVE_PER_DAY) return;
      if (state.last_message_seen_at) {
        const elapsed = now - new Date(state.last_message_seen_at);
        if (elapsed < MIN_PASSIVE_INTERVAL_MS) return;
      }

      const { text, type } = selectPassiveMessage(profile, state);
      const newCount = (state.messages_shown_today || 0) + 1;

      await base44.entities.AssistantState.update(state.id, {
        messages_shown_today: newCount,
        last_message_type: type,
        last_message_text: text,
        last_message_seen_at: now.toISOString(),
        onboarding_completed: type !== 'onboarding' || newCount >= 3,
      });

      enqueue({ text, type, isReactive: false, duration: PASSIVE_DURATION });
    };

    const t = setTimeout(loadPassive, 4000);
    return () => {
      clearTimeout(t);
      clearTimeout(hideTimerRef.current);
    };
  }, [userEmail, profile?.user_email, isAllowed]);

  const dismiss = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    setVisible(false);
    queueRef.current = []; // limpiar cola al cerrar manualmente
    isShowingRef.current = false;
  }, []);

  return { message, visible, dismiss };
}