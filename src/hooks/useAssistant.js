// ─── useAssistant ─────────────────────────────────────────────────────────────
// Responsabilidad: UI, cola de mensajes, navegación CTA, logging de decisiones.
// La lógica de decisión vive en /lib/productEngine.js.
// El cooldown dinámico vive en /lib/decisionCooldowns.js.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  ASSISTANT_EVENT_KEY,
  getAssistantQueue,
  clearAssistantQueue,
  setAssistantActive,
} from '@/lib/assistantEvents';
import {
  buildContext,
  buildLoginDecision,
  buildReactiveDecision,
  groupQueuedDecisions,
  evaluateUserState,
  getTopDecision,
  getUserState,
  ONBOARDING_STEPS,
  getMatamorosNow,
  toDateStr,
} from '@/lib/productEngine';
import { getCooldown } from '@/lib/decisionCooldowns';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const MAX_PASSIVE_PER_DAY     = 4;
const MIN_PASSIVE_INTERVAL_MS = 90 * 60 * 1000;
const PASSIVE_DURATION        = 13000;

// Feature flags globales (fácil de centralizar en el futuro)
const FLAGS = {
  XP_MULTIPLIER_ENABLED: false,
};

// ─── LOGGING DE DECISIONES ────────────────────────────────────────────────────

async function logDecisionShown(decision, userEmail) {
  if (!decision?.decision_instance_id) return;
  try {
    await base44.entities.AssistantDecisionLog.create({
      user_email:           userEmail,
      decision_id:          decision.id,
      decision_instance_id: decision.decision_instance_id,
      decision_type:        decision.type,
      score:                decision.score ?? 0,
      shown_at:             new Date().toISOString(),
      clicked:              false,
      dismissed:            false,
    });
  } catch (e) {
    console.warn('[Assistant] Error logging decision:', e.message);
  }
}

async function updateDecisionLog(decisionInstanceId, update) {
  if (!decisionInstanceId) return;
  try {
    const records = await base44.entities.AssistantDecisionLog.filter({
      decision_instance_id: decisionInstanceId,
    });
    if (records[0]) {
      await base44.entities.AssistantDecisionLog.update(records[0].id, update);
    }
  } catch (e) {
    console.warn('[Assistant] Error updating decision log:', e.message);
  }
}

// ─── COOLDOWN CHECK ───────────────────────────────────────────────────────────

async function isOnCooldown(userEmail, decisionId, userState) {
  const cooldownMs = getCooldown(decisionId, userState);
  if (!cooldownMs) return false;

  const logs = await base44.entities.AssistantDecisionLog.filter({
    user_email:  userEmail,
    decision_id: decisionId,
  });
  if (!logs.length) return false;

  const last = logs.sort((a, b) => new Date(b.shown_at) - new Date(a.shown_at))[0];
  return (Date.now() - new Date(last.shown_at).getTime()) < cooldownMs;
}

// ─── MEMORIA DEL USUARIO ──────────────────────────────────────────────────────

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
  const nextStep  = currentStep + 1;
  const completed = nextStep >= ONBOARDING_STEPS.length;
  await base44.entities.AssistantBehavior.update(state.id, {
    onboarding_step: completed ? currentStep : nextStep,
    onboarding_completed: completed,
  });
}

// ─── HOOK PRINCIPAL ───────────────────────────────────────────────────────────

export function useAssistant({ userEmail, profile, allowedPages, currentPage }) {
  const [message, setMessage] = useState(null);
  const [visible, setVisible] = useState(false);

  const queueRef           = useRef([]);
  const isShowingRef       = useRef(false);
  const hideTimerRef       = useRef(null);
  const assistantStateRef  = useRef(null);
  const behaviorRef        = useRef(null);
  const ctxRef             = useRef(null);

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

  // ── showNext ──────────────────────────────────────────────────────────────
  const showNext = useCallback(() => {
    if (queueRef.current.length === 0) { isShowingRef.current = false; return; }
    isShowingRef.current = true;
    const next = queueRef.current.shift();
    setMessage(next);
    setVisible(true);

    // Loggear que la decisión fue mostrada
    if (userEmail && next?.decision_instance_id) {
      logDecisionShown(next, userEmail);
    }

    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(showNext, 500);
    }, next.duration || PASSIVE_DURATION);
  }, [userEmail]);

  // ── enqueue ───────────────────────────────────────────────────────────────
  const enqueue = useCallback((decision) => {
    if (!isAllowed) return;

    // Normalizar: el mensaje para render une los campos del engine
    const renderMsg = {
      // Identificadores para tracking
      decision_instance_id: decision.decision_instance_id,
      id:                   decision.id,
      type:                 decision.type,
      score:                decision.score,
      // Contenido
      text:         decision.payload?.text    || decision.message,
      messageType:  decision.payload?.messageType || decision.id,
      isReactive:   decision.payload?.isReactive  || false,
      duration:     decision.payload?.duration    || PASSIVE_DURATION,
      priority:     decision.type,
      callToAction: decision.payload?.callToAction || decision.cta || null,
    };

    queueRef.current.push(renderMsg);
    if (!isShowingRef.current) showNext();
  }, [isAllowed, showNext]);

  // ── dismiss ───────────────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    clearTimeout(hideTimerRef.current);

    // Actualizar log: dismissed
    if (message?.decision_instance_id) {
      updateDecisionLog(message.decision_instance_id, { dismissed: true });
    }

    setVisible(false);
    queueRef.current     = [];
    isShowingRef.current = false;
    if (userEmail) trackAssistantInteraction(userEmail, 'ignored');
  }, [userEmail, message]);

  // ── handleCTA ─────────────────────────────────────────────────────────────
  const handleCTA = useCallback((msg) => {
    if (!msg?.callToAction?.route) return;
    navigate(msg.callToAction.route);

    // Actualizar log: clicked
    if (msg?.decision_instance_id) {
      updateDecisionLog(msg.decision_instance_id, { clicked: true });
    }

    if (userEmail) trackAssistantInteraction(userEmail, 'clicked', msg.messageType);

    // Onboarding: avanzar paso
    if (msg.messageType === 'onboarding' && behaviorRef.current) {
      const step = behaviorRef.current.onboarding_step || 0;
      advanceOnboardingStep(userEmail, step).then(() => {
        behaviorRef.current = { ...behaviorRef.current, onboarding_step: step + 1 };
      });
    }
    dismiss();
  }, [navigate, userEmail, dismiss]);

  // ── Activar/desactivar según ruta ─────────────────────────────────────────
  useEffect(() => {
    setAssistantActive(isAllowed && isActiveRoute);
    return () => setAssistantActive(false);
  }, [isAllowed, isActiveRoute]);

  // ── Escuchar eventos reactivos ────────────────────────────────────────────
  useEffect(() => {
    if (!isAllowed) return;
    const handler = (e) => {
      const { eventType, payload } = e.detail;

      if (eventType === 'login') {
        const decision = buildLoginDecision({
          name: payload?.name,
          profile: payload?.profile,
          behavior: behaviorRef.current,
        });
        enqueue(decision);
        return;
      }

      const decision = buildReactiveDecision(eventType, payload, ctxRef.current);
      if (decision) enqueue(decision);
    };

    window.addEventListener(ASSISTANT_EVENT_KEY, handler);
    return () => window.removeEventListener(ASSISTANT_EVENT_KEY, handler);
  }, [isAllowed, enqueue]);

  // ── Procesar cola persistente al montar ───────────────────────────────────
  useEffect(() => {
    if (!isAllowed) return;
    const queue = getAssistantQueue();
    if (!queue.length) return;
    clearAssistantQueue();
    const cutoff  = Date.now() - 30 * 60 * 1000;
    const recent  = queue.filter(e => e.timestamp >= cutoff);
    const grouped = groupQueuedDecisions(recent, ctxRef.current);
    grouped.forEach((decision, i) => setTimeout(() => enqueue(decision), 800 * i));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllowed]);

  // ── Mensajes pasivos (carga inicial con cooldown dinámico) ────────────────
  useEffect(() => {
    if (!userEmail || !profile || !isAllowed) return;

    const loadPassive = async () => {
      const today = toDateStr(getMatamorosNow());
      const now   = new Date();

      // AssistantState (contador diario)
      let stateRecords = await base44.entities.AssistantState.filter({ user_email: userEmail });
      let state = stateRecords[0] || null;

      if (state && state.last_reset_date !== today) {
        state = await base44.entities.AssistantState.update(state.id, {
          messages_shown_today: 0, last_reset_date: today,
        });
      }
      if (!state) {
        state = await base44.entities.AssistantState.create({
          user_email: userEmail, messages_shown_today: 0, last_reset_date: today,
        });
      }
      assistantStateRef.current = state;

      // AssistantBehavior (memoria del usuario)
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

      // Verificar límites diarios
      if ((state.messages_shown_today || 0) >= MAX_PASSIVE_PER_DAY) return;
      if (state.last_message_seen_at) {
        const elapsed = now - new Date(state.last_message_seen_at);
        if (elapsed < MIN_PASSIVE_INTERVAL_MS) return;
      }

      // ── Flujo completo del decision engine ──────────────────────────────
      const userState   = getUserState(behavior);
      const allDecisions = evaluateUserState({ profile, behavior, flags: FLAGS });

      // Filtrar por cooldown dinámico
      const validDecisions = [];
      for (const d of allDecisions) {
        const blocked = await isOnCooldown(userEmail, d.id, userState);
        if (!blocked) validDecisions.push(d);
      }

      const topDecision = getTopDecision(validDecisions, state?.last_message_type || '');
      if (!topDecision) return;

      // Actualizar AssistantState
      await base44.entities.AssistantState.update(state.id, {
        messages_shown_today: (state.messages_shown_today || 0) + 1,
        last_message_type:    topDecision.id,
        last_message_text:    topDecision.message,
        last_message_seen_at: now.toISOString(),
      });

      enqueue(topDecision);
    };

    const t = setTimeout(loadPassive, 4000);
    return () => { clearTimeout(t); clearTimeout(hideTimerRef.current); };
  }, [userEmail, profile?.xp_points, profile?.streak_days, isAllowed]);

  return { message, visible, dismiss, handleCTA };
}