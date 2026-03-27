import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

// ─── BIBLIOTECA DE MENSAJES ───────────────────────────────────────────────────

const getHour = () => new Date().getHours();

const MESSAGES = {
  greeting_morning: [
    "🌞 ¡Buenos días! Hoy es un gran día para aprender",
    "☀️ Empezar temprano te da ventaja, vamos 💪",
    "📚 Un poco de estudio ahora hará tu día mejor",
    "🔥 Mantén tu racha viva desde temprano",
    "🌱 Cada día suma, hoy no es la excepción",
  ],
  greeting_afternoon: [
    "👋 ¿Listo para continuar donde te quedaste?",
    "⚡ Aún estás a tiempo de avanzar hoy",
    "📈 Un pequeño progreso hoy hace una gran diferencia",
    "💡 ¿Qué tal una lección rápida?",
    "🎯 Sigues en buen ritmo, no lo pierdas",
  ],
  greeting_night: [
    "🌙 Cerrar el día aprendiendo es una gran decisión",
    "🔥 No dejes que tu racha se rompa hoy",
    "📚 Un último esfuerzo antes de descansar",
    "💪 Los que avanzan hoy, lideran mañana",
    "✨ Incluso una pequeña lección cuenta",
  ],
  streak_active: [
    "💪 Tu disciplina está dando resultados",
    "⚡ No rompas tu racha ahora",
    "🏆 Estás construyendo un gran hábito",
  ],
  streak_risk: [
    "⚠️ Tu racha está en riesgo, estudia hoy para salvarla",
    "🔥 No dejes que se pierda tu progreso",
    "⏳ Aún puedes mantener tu racha",
    "🚨 Última oportunidad para conservar tu racha",
  ],
  streak_lost: [
    "😢 Perdiste tu racha, pero puedes empezar otra hoy",
    "🔁 Cada inicio es una nueva oportunidad",
    "🌱 Comienza de nuevo, esta vez más fuerte",
    "💪 No te detengas, retoma el ritmo",
  ],
  tree_water: [
    "💧 Tienes agua disponible para tu árbol",
    "🌳 Tu árbol puede crecer ahora mismo",
    "✨ Cada riego lo hace más fuerte",
    "🌱 Dale vida a tu progreso",
  ],
  tree_growing: [
    "🌿 Tu árbol está creciendo muy bien",
    "🌳 Ya se nota tu progreso",
    "🌟 Estás construyendo algo grande",
    "🍃 Sigue cuidándolo",
  ],
  weekly_goal: [
    "📊 Vas avanzando en tu meta semanal",
    "🔥 Estás cerca de cumplir tu objetivo",
    "💪 No te detengas ahora",
    "⚠️ Aún puedes recuperarte en tu meta",
  ],
  xp_level: [
    "⚡ Estás ganando experiencia",
    "📈 Tu progreso es constante",
    "🔥 Estás cerca de subir de nivel",
    "🏆 El siguiente nivel está cerca",
    "💥 Ese nivel ya casi es tuyo",
  ],
  challenge_available: [
    "🎯 Tienes un desafío diario disponible",
    "⚡ Es una gran oportunidad para ganar XP",
    "🏆 No dejes pasar el desafío de hoy",
  ],
  challenge_pending: [
    "📅 Aún no haces tu desafío de hoy",
    "🔥 Puedes ganar recompensas extra con el desafío",
  ],
  challenge_done: [
    "🎉 Ya completaste tu desafío hoy",
    "💪 Buen trabajo con el desafío, sigue así",
  ],
  stars: [
    "⭐ Tienes estrellas disponibles para usar",
    "🛡️ Puedes proteger tu racha con tus estrellas",
    "💎 Úsalas sabiamente",
  ],
  positive: [
    "🎉 ¡Excelente trabajo!",
    "💪 Vas por buen camino",
    "🔥 Sigue así",
    "👏 Cada esfuerzo cuenta",
    "🌟 Lo estás haciendo muy bien",
  ],
  neutral: [
    "👀 Veamos qué puedes hacer hoy",
    "📊 Tu progreso sigue avanzando",
    "💡 Siempre hay algo que mejorar",
    "🚀 Vamos paso a paso",
  ],
  onboarding: [
    "👋 ¡Bienvenido! Aquí puedes ver tu progreso diario",
    "🔥 Mantén tu racha estudiando todos los días",
    "🌳 Usa tus tokens de agua para hacer crecer tu árbol",
    "⭐ Gana estrellas completando actividades",
    "🎯 Completa el desafío diario para ganar XP extra",
    "🛡️ Usa estrellas para proteger tu racha si un día no estudias",
    "📈 Tu nivel sube conforme acumulas más XP",
    "🏆 Desbloquea logros cumpliendo metas de estudio",
    "💧 Riega tu árbol para ver tu progreso visualmente",
    "📚 Completa lecciones para avanzar de nivel",
  ],
};

// ─── SELECCIÓN DE MENSAJE ─────────────────────────────────────────────────────

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function selectMessage(profile, assistantState, isOnboarding) {
  const today = new Date().toISOString().split('T')[0];
  const lastText = assistantState?.last_message_text || '';
  const lastType = assistantState?.last_message_type || '';

  if (isOnboarding) {
    const msgs = MESSAGES.onboarding.filter(m => m !== lastText);
    return { text: pickRandom(msgs.length ? msgs : MESSAGES.onboarding), type: 'onboarding' };
  }

  // Candidatos por contexto (prioridad descendente)
  const candidates = [];

  const hour = getHour();
  const streakDays = profile?.streak_days || 0;
  const lastStudy = profile?.last_study_date_normalized;
  const todayStudied = lastStudy === today;
  const waterTokens = profile?.water_tokens || 0;
  const examDone = profile?.last_surprise_exam_date_normalized === today;
  const totalStars = profile?.total_stars || 0;
  const xp = profile?.xp_points || 0;
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 10)));
  const nextLevelXP = Math.pow(level + 1, 2) * 10;
  const xpProgress = xp / nextLevelXP;

  // Racha en riesgo (no estudió hoy y tiene racha activa)
  if (!todayStudied && streakDays > 0) {
    candidates.push({ type: 'streak_risk', msgs: MESSAGES.streak_risk });
  }
  // Sin racha
  if (streakDays === 0) {
    candidates.push({ type: 'streak_lost', msgs: MESSAGES.streak_lost });
  }
  // Desafío pendiente
  if (!examDone) {
    candidates.push({ type: 'challenge_available', msgs: MESSAGES.challenge_available });
  }
  // Agua disponible
  if (waterTokens > 0) {
    candidates.push({ type: 'tree_water', msgs: MESSAGES.tree_water });
  }
  // XP cerca de subir de nivel
  if (xpProgress > 0.75) {
    candidates.push({ type: 'xp_level', msgs: MESSAGES.xp_level });
  }
  // Meta semanal
  if ((profile?.weekly_goal_progress || 0) > 0) {
    candidates.push({ type: 'weekly_goal', msgs: MESSAGES.weekly_goal });
  }
  // Racha activa
  if (streakDays >= 3) {
    candidates.push({ type: 'streak_active', msgs: MESSAGES.streak_active });
  }
  // Árbol creciendo
  if ((profile?.tree_stage || 0) >= 1) {
    candidates.push({ type: 'tree_growing', msgs: MESSAGES.tree_growing });
  }
  // Desafío completado
  if (examDone) {
    candidates.push({ type: 'challenge_done', msgs: MESSAGES.challenge_done });
  }
  // Estrellas disponibles
  if (totalStars >= 5) {
    candidates.push({ type: 'stars', msgs: MESSAGES.stars });
  }
  // Positivo
  if (todayStudied) {
    candidates.push({ type: 'positive', msgs: MESSAGES.positive });
  }

  // Filtrar misma categoría consecutiva
  const filtered = candidates.filter(c => c.type !== lastType);
  const pool = filtered.length ? filtered : candidates;

  if (pool.length > 0) {
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const msgs = chosen.msgs.filter(m => m !== lastText);
    const text = pickRandom(msgs.length ? msgs : chosen.msgs);
    return { text, type: chosen.type };
  }

  // Saludo por hora como fallback
  let greetingKey = 'greeting_afternoon';
  if (hour >= 5 && hour < 12) greetingKey = 'greeting_morning';
  else if (hour >= 19 || hour < 5) greetingKey = 'greeting_night';

  const greetMsgs = MESSAGES[greetingKey].filter(m => m !== lastText);
  return { text: pickRandom(greetMsgs.length ? greetMsgs : MESSAGES[greetingKey]), type: greetingKey };
}

// ─── HOOK PRINCIPAL ───────────────────────────────────────────────────────────

const MAX_MESSAGES_PER_DAY = 3;
const MIN_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 horas
const VISIBLE_DURATION_MS = 7000;

export function useAssistant({ userEmail, profile, allowedPages, currentPage }) {
  const [message, setMessage] = useState(null);
  const [visible, setVisible] = useState(false);
  const stateRef = useRef(null);
  const hideTimerRef = useRef(null);

  const isAllowed = allowedPages.includes(currentPage);

  const loadAndShow = useCallback(async () => {
    if (!userEmail || !isAllowed) return;

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Obtener o crear AssistantState
    let records = await base44.entities.AssistantState.filter({ user_email: userEmail });
    let state = records[0] || null;

    // Reset diario
    if (state && state.last_reset_date !== today) {
      state = await base44.entities.AssistantState.update(state.id, {
        messages_shown_today: 0,
        last_reset_date: today,
      });
    }

    if (!state) {
      state = await base44.entities.AssistantState.create({
        user_email: userEmail,
        days_since_signup: 0,
        onboarding_completed: false,
        messages_shown_today: 0,
        last_reset_date: today,
      });
    }

    stateRef.current = state;

    // Verificar límites
    if ((state.messages_shown_today || 0) >= MAX_MESSAGES_PER_DAY) return;
    if (state.last_message_seen_at) {
      const elapsed = now - new Date(state.last_message_seen_at);
      if (elapsed < MIN_INTERVAL_MS) return;
    }

    // Calcular días desde registro
    const signupDate = profile?.created_date ? new Date(profile.created_date) : new Date();
    const daysDiff = Math.floor((now - signupDate) / (1000 * 60 * 60 * 24));
    const isOnboarding = !state.onboarding_completed && daysDiff <= 7;

    const { text, type } = selectMessage(profile, state, isOnboarding);

    // Actualizar estado
    const newCount = (state.messages_shown_today || 0) + 1;
    const updatedState = {
      messages_shown_today: newCount,
      last_message_type: type,
      last_message_text: text,
      last_message_seen_at: now.toISOString(),
      days_since_signup: daysDiff,
    };
    if (isOnboarding && newCount >= 5) {
      updatedState.onboarding_completed = true;
    }
    await base44.entities.AssistantState.update(state.id, updatedState);

    setMessage({ text, type });
    setVisible(true);

    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setVisible(false), VISIBLE_DURATION_MS);
  }, [userEmail, profile, isAllowed]);

  useEffect(() => {
    if (!userEmail || !profile || !isAllowed) return;

    // Pequeño delay inicial para no bloquear el render
    const t = setTimeout(loadAndShow, 3000);
    return () => {
      clearTimeout(t);
      clearTimeout(hideTimerRef.current);
    };
  }, [userEmail, profile?.user_email, isAllowed]);

  const dismiss = useCallback(() => {
    setVisible(false);
    clearTimeout(hideTimerRef.current);
  }, []);

  return { message, visible, dismiss };
}