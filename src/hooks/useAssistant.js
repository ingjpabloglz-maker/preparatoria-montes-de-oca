import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { ASSISTANT_EVENT_KEY } from '@/lib/assistantEvents';

// ─── MENSAJES PASIVOS ─────────────────────────────────────────────────────────

const PASSIVE_MESSAGES = {
  greeting_morning: [
    "🌞 ¡Buenos días! Hoy es un gran día para aprender",
    "☀️ Empezar temprano te da ventaja, vamos 💪",
    "📚 Un poco de estudio ahora hará tu día mejor",
    "🔥 Mantén tu racha viva desde temprano",
  ],
  greeting_afternoon: [
    "👋 ¿Listo para continuar donde te quedaste?",
    "⚡ Aún estás a tiempo de avanzar hoy",
    "💡 ¿Qué tal una lección rápida?",
    "🎯 Sigues en buen ritmo, no lo pierdas",
  ],
  greeting_night: [
    "🌙 Cerrar el día aprendiendo es una gran decisión",
    "🔥 No dejes que tu racha se rompa hoy",
    "📚 Un último esfuerzo antes de descansar",
    "💪 Los que avanzan hoy, lideran mañana",
  ],
  streak_risk: [
    "⚠️ Tu racha está en riesgo, estudia hoy para salvarla",
    "🔥 No dejes que se pierda tu progreso",
    "🚨 Última oportunidad para conservar tu racha",
  ],
  streak_lost: [
    "😢 Perdiste tu racha, pero puedes empezar otra hoy",
    "🔁 Cada inicio es una nueva oportunidad",
    "💪 No te detengas, retoma el ritmo",
  ],
  tree_water: [
    "💧 Tienes agua disponible para tu árbol",
    "🌳 Tu árbol puede crecer ahora mismo",
    "🌱 Dale vida a tu progreso",
  ],
  xp_level: [
    "🔥 Estás cerca de subir de nivel",
    "🏆 El siguiente nivel está cerca",
    "💥 Ese nivel ya casi es tuyo",
  ],
  challenge_available: [
    "🎯 Tienes un desafío diario disponible",
    "⚡ Es una gran oportunidad para ganar XP",
    "🏆 No dejes pasar el desafío de hoy",
  ],
  onboarding: [
    "👋 ¡Bienvenido! Aquí puedes ver tu progreso diario",
    "🔥 Mantén tu racha estudiando todos los días",
    "🌳 Usa tus tokens de agua para hacer crecer tu árbol",
    "⭐ Gana estrellas completando actividades",
    "🎯 Completa el desafío diario para ganar XP extra",
  ],
};

// ─── MENSAJES DE LOGIN ────────────────────────────────────────────────────────

function buildLoginMessage(payload) {
  const { name, profile } = payload || {};
  const firstName = name?.split(' ')[0] || 'estudiante';
  const hour = new Date().getHours();
  const streakDays = profile?.streak_days || 0;
  const examDone = profile?.last_surprise_exam_date_normalized === new Date().toISOString().split('T')[0];
  const waterTokens = profile?.water_tokens || 0;

  let greeting = '👋';
  if (hour >= 5 && hour < 12) greeting = '🌞 ¡Buenos días';
  else if (hour >= 12 && hour < 19) greeting = '☀️ ¡Buenas tardes';
  else greeting = '🌙 ¡Buenas noches';

  let text = `${greeting}, ${firstName}!`;

  if (streakDays >= 3) {
    text += ` 🔥 Llevas ${streakDays} días de racha, ¡no la pierdas hoy!`;
  } else if (streakDays === 1) {
    text += ` Tienes 1 día de racha, ¡sigue así!`;
  } else if (!examDone) {
    text += ` 🎯 Tienes el desafío diario disponible. ¡Gana XP!`;
  } else if (waterTokens > 0) {
    text += ` 💧 Tienes ${waterTokens} token${waterTokens > 1 ? 's' : ''} de agua para regar tu árbol.`;
  } else {
    text += ` Listo para aprender hoy? 📚`;
  }

  return { text, type: 'login', isReactive: true, duration: 10000 };
}

// ─── MENSAJES REACTIVOS ───────────────────────────────────────────────────────

const REACTIVE_MESSAGES = {
  lesson_completed: [
    "📚 ¡Lección completada!",
    "💪 Buen trabajo, sigue así",
    "🔥 Una más y tu racha se fortalece",
    "✅ Gran avance hoy",
  ],
  quiz_perfect_score: [
    "💯 ¡Perfecto! Sin errores",
    "🏆 Nivel experto",
    "🔥 Así se hace",
    "⭐ ¡Impecable!",
  ],
  xp_gained: [
    "⚡ ¡XP ganado!",
    "📈 Tu progreso aumenta",
    "🚀 Cada vez más fuerte",
    "💥 Sigue acumulando",
  ],
  level_up: [
    "🎉 ¡Subiste de nivel!",
    "🏆 Nuevo nivel desbloqueado",
    "🔥 Esto se pone interesante",
    "🚀 ¡Increíble progreso!",
  ],
  tree_watered: [
    "💧 Tu árbol crece",
    "🌱 Se ve más fuerte",
    "🌳 Gran progreso",
    "🍃 ¡Lo cuidas muy bien!",
  ],
  streak_updated: [
    "🔥 ¡Racha activa!",
    "💪 No la pierdas",
    "⚡ Excelente constancia",
    "📈 Tu racha sigue creciendo",
  ],
  streak_lost: [
    "😢 Se perdió la racha",
    "🔁 Pero puedes empezar hoy",
    "💪 No te rindas",
  ],
  daily_exam_completed: [
    "🎯 ¡Desafío completado!",
    "🏆 Buen extra de XP",
    "🔥 Vas con todo hoy",
    "⚡ ¡Excelente desafío!",
  ],
  achievement_unlocked: [
    "🏆 ¡Nuevo logro desbloqueado!",
    "🎖️ Bien ganado",
    "✨ Sigue así",
    "🌟 ¡Un nuevo mérito!",
  ],
};

// ─── DURACIÓN POR TIPO ────────────────────────────────────────────────────────

const REACTIVE_DURATION = {
  level_up: 20000,
  achievement_unlocked: 18000,
  default: 12000,
};

const PASSIVE_DURATION = 13000;

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildReactiveMessage(eventType, payload) {
  const msgs = REACTIVE_MESSAGES[eventType];
  if (!msgs) return null;

  let text = pickRandom(msgs);

  // Interpolaciones
  if (eventType === 'xp_gained' && payload?.xp) {
    text = `⚡ +${payload.xp} XP ganados`;
  }
  if (eventType === 'streak_updated' && payload?.streak_days) {
    text = `🔥 Racha: ${payload.streak_days} días`;
  }
  if (eventType === 'level_up' && payload?.level) {
    text = `🎉 ¡Subiste al Nivel ${payload.level}!`;
  }

  const duration = REACTIVE_DURATION[eventType] || REACTIVE_DURATION.default;
  return { text, type: eventType, isReactive: true, duration };
}

function selectPassiveMessage(profile, state) {
  const today = new Date().toISOString().split('T')[0];
  const lastText = state?.last_message_text || '';
  const lastType = state?.last_message_type || '';

  const isOnboarding = !state?.onboarding_completed;
  if (isOnboarding) {
    const msgs = PASSIVE_MESSAGES.onboarding.filter(m => m !== lastText);
    return { text: pickRandom(msgs.length ? msgs : PASSIVE_MESSAGES.onboarding), type: 'onboarding' };
  }

  const candidates = [];
  const hour = new Date().getHours();
  const streakDays = profile?.streak_days || 0;
  const todayStudied = profile?.last_study_date_normalized === today;
  const waterTokens = profile?.water_tokens || 0;
  const examDone = profile?.last_surprise_exam_date_normalized === today;
  const xp = profile?.xp_points || 0;
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 10)));
  const nextLevelXP = Math.pow(level + 1, 2) * 10;
  const xpProgress = xp / nextLevelXP;

  if (!todayStudied && streakDays > 0) candidates.push({ type: 'streak_risk', msgs: PASSIVE_MESSAGES.streak_risk });
  if (streakDays === 0) candidates.push({ type: 'streak_lost', msgs: PASSIVE_MESSAGES.streak_lost });
  if (!examDone) candidates.push({ type: 'challenge_available', msgs: PASSIVE_MESSAGES.challenge_available });
  if (waterTokens > 0) candidates.push({ type: 'tree_water', msgs: PASSIVE_MESSAGES.tree_water });
  if (xpProgress > 0.75) candidates.push({ type: 'xp_level', msgs: PASSIVE_MESSAGES.xp_level });

  const filtered = candidates.filter(c => c.type !== lastType);
  const pool = filtered.length ? filtered : candidates;

  if (pool.length > 0) {
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const msgs = chosen.msgs.filter(m => m !== lastText);
    return { text: pickRandom(msgs.length ? msgs : chosen.msgs), type: chosen.type };
  }

  let key = 'greeting_afternoon';
  if (hour >= 5 && hour < 12) key = 'greeting_morning';
  else if (hour >= 19 || hour < 5) key = 'greeting_night';
  const greetMsgs = PASSIVE_MESSAGES[key].filter(m => m !== lastText);
  return { text: pickRandom(greetMsgs.length ? greetMsgs : PASSIVE_MESSAGES[key]), type: key };
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

  const isAllowed = allowedPages.includes(currentPage);

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

  // ── Escuchar eventos reactivos ────────────────────────────────────────────
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