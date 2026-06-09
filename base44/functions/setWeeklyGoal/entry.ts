import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SERVICE_ACCOUNT_RE = /^service\+|@no-reply\.base44\.com$|^bot\+|^automation\+|^system\+/i;
function requireStudentRole(user, fnName) {
  const email = user?.email || 'anonymous';
  const role = user?.role || 'none';
  if (!user || user.role !== 'user' || SERVICE_ACCOUNT_RE.test(email)) {
    return Response.json({ status: 'ignored', message: 'Operación exclusiva para alumnos.', blocked_role: role }, { status: 403 });
  }
  return null;
}

// Calcula el week_cycle_id a partir de un ISO timestamp: "YYYY-Www"
function getWeekCycleId(isoTimestamp) {
  const d = new Date(isoTimestamp);
  // Usar número de semana ISO basado en la fecha local de Matamoros
  const localStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Matamoros',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
  const [year, month, day] = localStr.split('-').map(Number);
  // Calcular semana ISO (simplificado: usar fecha YYYY + número de semana del año)
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfYear = Math.floor((date - new Date(Date.UTC(year, 0, 1))) / 86400000);
  const weekNum = Math.ceil((dayOfYear + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

// Recompensas según número de meta en el ciclo (anti-farming)
// Meta 1: 50 XP + 3 ⭐ | Meta 2: 25 XP + 1 ⭐ | Meta 3+: 0
const GOAL_REWARDS = [
  { xp: 50, stars: 3 },   // goal_number_in_cycle = 1
  { xp: 25, stars: 1 },   // goal_number_in_cycle = 2
];
function getRewardForGoalNumber(goalNumber) {
  const idx = goalNumber - 1;
  return GOAL_REWARDS[idx] || { xp: 0, stars: 0 };
}

const MIN_TARGET = 5; // Mínimo obligatorio para evitar farming de metas micro

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const blocked = requireStudentRole(user, 'setWeeklyGoal');
  if (blocked) return blocked;

  const body = await req.json();
  const { goal } = body;

  if (!goal || typeof goal !== 'number' || goal < MIN_TARGET || goal > 50) {
    return Response.json({ error: `La meta debe ser un número entre ${MIN_TARGET} y 50` }, { status: 400 });
  }

  const user_email = user.email;
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const weekCycleId = getWeekCycleId(nowIso);

  // 1. Archivar meta activa anterior (si existe y no está archivada)
  const activeSessions = await base44.asServiceRole.entities.WeeklyGoalSession.filter({
    user_email,
    archived: false,
  });

  for (const session of activeSessions) {
    await base44.asServiceRole.entities.WeeklyGoalSession.update(session.id, {
      archived: true,
      completed_at: session.completed_at || nowIso,
    });
  }

  // 2. Calcular número de meta en este ciclo semanal (para anti-farming de recompensas)
  const sessionsThisCycle = await base44.asServiceRole.entities.WeeklyGoalSession.filter({
    user_email,
    week_cycle_id: weekCycleId,
  });
  const goalNumberInCycle = sessionsThisCycle.length + 1;

  const reward = getRewardForGoalNumber(goalNumberInCycle);

  // 3. Crear nueva sesión
  const newSession = await base44.asServiceRole.entities.WeeklyGoalSession.create({
    user_email,
    week_cycle_id: weekCycleId,
    goal_number_in_cycle: goalNumberInCycle,
    target: goal,
    progress: 0,
    completed: false,
    reward_claimed: false,
    reward_xp: reward.xp,
    reward_stars: reward.stars,
    started_at: nowIso,
    expires_at: expiresAt,
    archived: false,
  });

  // 4. Actualizar GamificationProfile con referencia a la sesión activa (para compatibilidad)
  const gamArr = await base44.asServiceRole.entities.GamificationProfile.filter({ user_email });
  const gam = gamArr[0];
  const profileUpdate = {
    weekly_goal_target: goal,
    weekly_goal_progress: 0,
    weekly_goal_start_date: nowIso.substring(0, 10),
    weekly_goal_completed: false,
    weekly_goal_reward_claimed: false,
  };
  if (gam) {
    await base44.asServiceRole.entities.GamificationProfile.update(gam.id, profileUpdate);
  } else {
    await base44.asServiceRole.entities.GamificationProfile.create({ user_email, ...profileUpdate });
  }

  return Response.json({
    status: 'ok',
    goal,
    goal_number_in_cycle: goalNumberInCycle,
    reward_xp: reward.xp,
    reward_stars: reward.stars,
    rewarded: reward.xp > 0 || reward.stars > 0,
    expires_at: expiresAt,
    session_id: newSession.id,
  });
});