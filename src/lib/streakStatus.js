// Calcula el estado visual de la racha basado en last_study_date_normalized
// Zona horaria: America/Matamoros (UTC-6)
const MATAMOROS_OFFSET_HOURS = -6;

function getMatamorosTodayStr() {
  const nowUtc = new Date();
  const local = new Date(nowUtc.getTime() + MATAMOROS_OFFSET_HOURS * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = (local.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = local.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {string|null} lastStudyDateNormalized - "YYYY-MM-DD"
 * @param {number} streakDays - Días de racha actuales (0 = rota por decay)
 * @returns {"normal" | "at_risk" | "lost" | "none"}
 */
export function getStreakStatus(lastStudyDateNormalized, streakDays = 0) {
  if (!lastStudyDateNormalized) return 'none';

  // Si el decay ya puso streak_days a 0, la racha está perdida
  if (streakDays === 0) return 'lost';

  const today = getMatamorosTodayStr();
  const [ty, tm, td] = today.split('-').map(Number);
  const [ly, lm, ld] = lastStudyDateNormalized.split('-').map(Number);

  const todayMs = Date.UTC(ty, tm - 1, td);
  const lastMs  = Date.UTC(ly, lm - 1, ld);
  const diffDays = Math.round((todayMs - lastMs) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'normal';  // estudió hoy
  if (diffDays === 1) return 'at_risk'; // estudió ayer — aún no estudió hoy
  return 'at_risk'; // >1 día pero streak_days > 0 → escudos lo están cubriendo
}