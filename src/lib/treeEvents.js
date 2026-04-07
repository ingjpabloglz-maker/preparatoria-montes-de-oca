/**
 * Dispara una animación en el árbol del conocimiento.
 * event_type: 'lesson_completed' | 'mini_eval_passed' | 'exam_passed'
 */
export function dispatchTreeEvent(event_type) {
  window.dispatchEvent(new CustomEvent('tree_animation_event', { detail: { event_type } }));
}