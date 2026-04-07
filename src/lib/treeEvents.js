/**
 * Dispara una animación en el árbol del conocimiento.
 * event_type: 'lesson_completed' | 'mini_eval_passed' | 'exam_passed'
 * Fix #2: Debounce por evento para evitar animaciones duplicadas.
 */
const _lastEventTime = new Map();

export function dispatchTreeEvent(event_type) {
  const now = Date.now();
  if (now - (_lastEventTime.get(event_type) ?? 0) < 1000) return;
  _lastEventTime.set(event_type, now);
  window.dispatchEvent(new CustomEvent('tree_animation_event', { detail: { event_type } }));
}