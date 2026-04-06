// ─── useAssistant ─────────────────────────────────────────────────────────────
// Responsabilidad: UI, cola de mensajes, navegación CTA, memoria de usuario.
// La lógica de decisión vive en /lib/productEngine.js.
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
  getTopDecision,
  ONBOARDING_STEPS,
  getMatamorosNow,
  toDateStr,
} from '@/lib/productEngine';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────

const MAX_PASSIVE_PER_DAY      = 4;
const MIN_PASSIVE_INTERVAL_MS  = 90 * 60 * 1000;
const PASSIVE_DURATION         = 13000;

// ─── UTILIDADES DE MEMORIA ────────────────────────────────────────────────────

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
    update.messages_ignored  = (state.messages_ignored || 0) + 1;
    update.engagement_score  = Math.max(0, (state.engagement_score ?? 50) - 5);
  } else if (type === 'clicked') {
    update.messages_clicked  = (state.messages_clicked || 0) + 1;
    update.engagement_score  = Math.min(100, (state.engagement_score ?? 50) + 10);
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
  const [message, setMessage]   = useState(null);
  const [visible, setVisible]   = useState(false);

  const queueRef          = useRef([]);
  const isShowingRef      = useRef(false);
  const hideTimerRef      = useRef(null);
  const assistantStateRef = useRef(null);
  const behaviorRef       = useRef(null);
  const ctxRef            = useRef(null);

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

    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(showNext, 500);
    }, next.duration || PASSIVE_DURATION);
  }, []);

  // ── enqueue ───────────────────────────────────────────────────────────────
  // Recibe una decisión del ProductEngine y la normaliza para el render.
  const enqueue = useCallback((decisionOrMsg) => {
    if (!isAllowed) return;

    // Normalizar: si es una decisión del engine, extraer el payload
    const msg = decisionOrMsg?.payload ?? decisionOrMsg;

    // Mapear campos del engine al formato de render del componente
    const renderMsg = {
      text:          msg.text,
      type:          msg.messageType || msg.type,
      isReactive:    msg.isReactive || false,
      duration:      msg.duration || PASSIVE_DURATION,
      priority:      msg.priorityKey || msg.priority,
      callToAction:  msg.callToAction || null,
    };

    queueRef.current.push(renderMsg);
    if (!isShowingRef.current) showNext();
  }, [isAllowed, showNext]);

  // ── dismiss ───────────────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    setVisible(false);
    queueRef.current    = [];
    isShowingRef.current = false;
    if (userEmail) trackAssistantInteraction(userEmail, 'ignored');
  }, [userEmail]);

  // ── handleCTA ─────────────────────────────────────────────────────────────
  const handleCTA = useCallback((msg) => {
    if (!msg?.callToAction?.route) return;
    navigate(msg.callToAction.route);
    if (userEmail) trackAssistantInteraction(userEmail, 'clicked', msg.type);

    // Onboarding: avanzar paso
    if (msg.type === 'onboarding' && behaviorRef.current) {
      const step = behaviorRef.current.onboarding_step || 0;
      advanceOnboardingStep(userEmail, step).then(() => {
        behaviorRef.current = { ...behaviorRef.current, onboarding_step: step + 1 };
      });
    }
    dismiss();
  }, [navigate, userEmail, dismiss]);

  // ── Activar/desactivar asistente según ruta ───────────────────────────────
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

  // ── Mensajes pasivos (carga inicial) ──────────────────────────────────────
  useEffect(() => {
    if (!userEmail || !profile || !isAllowed) return;

    const loadPassive = async () => {
      const today = toDateStr(getMatamorosNow());
      const now   = new Date();

      // Cargar AssistantState (contador diario)
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

      // Verificar límites diarios
      if ((state.messages_shown_today || 0) >= MAX_PASSIVE_PER_DAY) return;
      if (state.last_message_seen_at) {
        const elapsed = now - new Date(state.last_message_seen_at);
        if (elapsed < MIN_PASSIVE_INTERVAL_MS) return;
      }

      // Pedir decisión al ProductEngine
      const decision = getTopDecision({
        profile,
        behavior,
        lastMessageType: state?.last_message_type || '',
      });
      if (!decision) return;

      const { text, messageType, priorityKey, callToAction } = decision.payload;
      const newCount = (state.messages_shown_today || 0) + 1;

      await base44.entities.AssistantState.update(state.id, {
        messages_shown_today: newCount,
        last_message_type:    messageType,
        last_message_text:    text,
        last_message_seen_at: now.toISOString(),
      });

      enqueue(decision);
    };

    const t = setTimeout(loadPassive, 4000);
    return () => { clearTimeout(t); clearTimeout(hideTimerRef.current); };
  }, [userEmail, profile?.xp_points, profile?.streak_days, isAllowed]);

  return { message, visible, dismiss, handleCTA };
}