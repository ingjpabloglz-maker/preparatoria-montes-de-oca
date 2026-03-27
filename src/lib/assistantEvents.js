// ─── SISTEMA DE EVENTOS DEL ASISTENTE CON COLA PERSISTENTE ───────────────────

const ASSISTANT_EVENT_KEY = 'assistant_event';
const QUEUE_STORAGE_KEY = 'assistant_event_queue';
const MAX_QUEUE_SIZE = 20;

// Flag en memoria: el asistente lo activa cuando está montado y escuchando
let assistantMounted = false;

export function setAssistantMounted(value) {
  assistantMounted = value;
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
 * - Si el asistente está montado: despacho inmediato vía CustomEvent.
 * - Si no: guarda en localStorage para procesarlo al volver al Dashboard.
 * - Eventos de login: siempre despacho inmediato (no van a cola).
 */
export function dispatchAssistantEvent(eventType, payload = {}) {
  if (eventType === 'login' || assistantMounted) {
    // Despacho directo
    window.dispatchEvent(new CustomEvent(ASSISTANT_EVENT_KEY, {
      detail: { eventType, payload, timestamp: Date.now() },
    }));
    return;
  }

  // Asistente no montado → encolar
  const queue = getQueue();
  if (queue.length >= MAX_QUEUE_SIZE) return; // cola llena, descartar más antiguo si se prefiere

  const event = {
    type: eventType,
    data: payload,
    timestamp: Date.now(),
    id: `${eventType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  queue.push(event);
  saveQueue(queue);
}

export { ASSISTANT_EVENT_KEY };