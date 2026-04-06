// ─── DECISION COOLDOWNS ───────────────────────────────────────────────────────
// Tiempos base de cooldown por decision_id en milisegundos.
// getCooldown ajusta dinámicamente según el estado de engagement del usuario.
// ─────────────────────────────────────────────────────────────────────────────

export const BASE_DECISION_COOLDOWNS = {
  save_streak:               6 * 60 * 60 * 1000,  // 6h
  xp_multiplier:             3 * 60 * 60 * 1000,  // 3h
  level_up_imminent:         2 * 60 * 60 * 1000,  // 2h
  do_daily_challenge:        20 * 60 * 60 * 1000, // 20h (1 vez por día)
  water_tree:                8 * 60 * 60 * 1000,  // 8h
  complete_weekly_goal:      4 * 60 * 60 * 1000,  // 4h
  progress_weekly:           12 * 60 * 60 * 1000, // 12h
  double_xp:                 6 * 60 * 60 * 1000,  // 6h
  streak_active:             8 * 60 * 60 * 1000,  // 8h
  greeting:                  4 * 60 * 60 * 1000,  // 4h
  recovery:                  24 * 60 * 60 * 1000, // 24h
};

/**
 * Retorna el cooldown ajustado según estado de engagement:
 * - at_risk  → 30% menos cooldown (más frecuente, re-engagement)
 * - engaged  → 30% más cooldown (menos intrusivo)
 * - neutral  → sin cambio
 */
export function getCooldown(decisionId, userState) {
  const base = BASE_DECISION_COOLDOWNS[decisionId] ?? 0;
  if (userState === 'at_risk') return Math.round(base * 0.7);
  if (userState === 'engaged') return Math.round(base * 1.3);
  return base;
}