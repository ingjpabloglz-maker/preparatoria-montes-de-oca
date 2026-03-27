// ─── SISTEMA DE EVENTOS DEL ASISTENTE CON COLA PERSISTENTE ───────────────────

const ASSISTANT_EVENT_KEY = 'assistant_event';
const QUEUE_STORAGE_KEY = 'assistant_event_queue';
const MAX_QUEUE_SIZE = 20;

// Flag en memoria: true SOLO cuando la ruta activa es dashboard o rewards
let assistantActive = false;

export function setAssistantActive(value) {
  assistantActive = value;
  console.log('Assistant active:', value);
}

// ─── COLA localStorage ────────────────────────────────────────────────────────

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage no disponible
  }
}

export function clearAssistantQueue() {
  localStorage.removeItem(QUEUE_STORAGE_KEY);
}

export function getAssistantQueue() {
  return getQueue();
}

// ─── DESPACHO DE EVENTOS ──────────────────────────────────────────────────────

/**
 * Despacha un evento al asistente.
 * - Si assistantActive (ruta es /dashboard o /rewards): despacho inmediato.
 * - Si no: guarda en localStorage para procesarlo al volver a esas rutas.
 * - Eventos de login: siempre despacho inmediato (no van a cola).
 */
export function dispatchAssistantEvent(eventType, payload = {}) {
  if (eventType === 'login' || assistantActive) {
    window.dispatchEvent(new CustomEvent(ASSISTANT_EVENT_KEY, {
      detail: { eventType, payload, timestamp: Date.now() },
    }));
    return;
  }

  // Asistente no activo en esta ruta → encolar en localStorage
  const queue = getQueue();
  if (queue.length >= MAX_QUEUE_SIZE) return;

  const event = {
    type: eventType,
    data: payload,
    timestamp: Date.now(),
    id: `${eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  queue.push(event);
  saveQueue(queue);
  console.log('Event queued:', event.type);
}

export { ASSISTANT_EVENT_KEY };