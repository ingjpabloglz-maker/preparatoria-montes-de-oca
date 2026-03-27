// ─── SISTEMA DE EVENTOS GLOBALES DEL ASISTENTE ────────────────────────────────
// Permite disparar eventos desde cualquier parte de la app sin prop drilling

const ASSISTANT_EVENT_KEY = 'assistant_event';

/**
 * Dispara un evento reactivo al asistente
 * @param {string} eventType - Tipo de evento (ej: 'lesson_completed', 'xp_gained')
 * @param {object} payload - Datos del evento (ej: { xp: 50, streak_days: 5 })
 */
export function dispatchAssistantEvent(eventType, payload = {}) {
  const event = new CustomEvent(ASSISTANT_EVENT_KEY, {
    detail: { eventType, payload, timestamp: Date.now() },
  });
  window.dispatchEvent(event);
}

export { ASSISTANT_EVENT_KEY };