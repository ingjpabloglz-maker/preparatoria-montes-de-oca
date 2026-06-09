import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MIN_TARGET = 5;
const MAX_TARGET = 50;
const ROLLING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 días exactos en ms UTC

const SERVICE_ACCOUNT_RE = /^service\+|@no-reply\.base44\.com$|^bot\+|^automation\+|^system\+/i;

// Recompensas por número de meta en el ciclo (anti-farming hard cap en 2)
const GOAL_REWARDS = [
  { xp: 50, stars: 3 },  // Meta 1
  { xp: 25, stars: 1 },  // Meta 2
  // Meta 3+: { xp: 0, stars: 0 }
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getRewardForGoalNumber(n) {
  return GOAL_REWARDS[n - 1] || { xp: 0, stars: 0 };
}

// week_cycle_id: "YYYY-Www" basado en número de semana ISO del año en UTC
function getWeekCycleId(isoTimestamp) {
  const d = new Date(isoTimestamp);
  const year = d.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((d - startOfYear) / 86400000);
  const weekNum = Math.ceil((dayOfYear + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function auditLog(event, fields) {
  console.log(JSON.stringify({
    event,
    ...fields,
    timestamp: new Date().toISOString(),
  }));
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const email = user?.email || '';
  const role  = user?.role  || 'none';

  if (!user || role !== 'user' || SERVICE_ACCOUNT_RE.test(email)) {
    return Response.json({ status: 'ignored', message: 'Operación exclusiva para alumnos.', blocked_role: role }, { status: 403 });
  }

  const body = await req.json();
  const { goal } = body;

  if (
    !goal ||
    typeof goal !== 'number' ||
    !Number.isInteger(goal) ||
    goal < MIN_TARGET ||
    goal > MAX_TARGET
  ) {
    return Response.json({
      error: `La meta debe ser un número entero entre ${MIN_TARGET} y ${MAX_TARGET}.`,
    }, { status: 400 });
  }

  const user_email = user.email;
  const nowIso    = new Date().toISOString();
  // expires_at siempre como UTC absoluto para resistir DST y cambios de timezone del dispositivo
  const expiresAt = new Date(Date.now() + ROLLING_WINDOW_MS).toISOString();
  const weekCycleId = getWeekCycleId(nowIso);

  // ── RACE CONDITION GUARD: verificar si ya existe una meta activa ────────────
  // Esta es la validación atómica que previene doble creación por:
  // - doble click
  // - mobile retry
  // - reconnection replay
  // - requests duplicados
  const currentActive = await base44.asServiceRole.entities.WeeklyGoalSession.filter({
    user_email,
    status: 'active',
  });

  if (currentActive.length > 0) {
    const existing = currentActive[0];
    // Verificar que no haya expirado de facto (estado corrupto reparable aquí)
    const isExpired = new Date(existing.expires_at) <= new Date();
    if (!isExpired) {
      // Meta activa vigente → rechazar creación duplicada
      auditLog('WEEKLY_GOAL_DUPLICATE_BLOCKED', {
        user_email,
        existing_session_id: existing.id,
        existing_target: existing.target,
        existing_progress: existing.progress,
        expires_at: existing.expires_at,
      });
      return Response.json({
        error: 'Ya tienes una meta semanal activa. Complétala o espera a que expire antes de crear una nueva.',
        existing_session: {
          id: existing.id,
          target: existing.target,
          progress: existing.progress,
          expires_at: existing.expires_at,
          status: existing.status,
        },
      }, { status: 409 });
    }

    // Sesión activa pero ya expirada → transición automática a 'failed'
    await base44.asServiceRole.entities.WeeklyGoalSession.update(existing.id, {
      status: 'failed',
      archived: true,
      failed_at: nowIso,
      archived_at: nowIso,
    });
    auditLog('WEEKLY_GOAL_FAILED', {
      user_email,
      session_id: existing.id,
      target: existing.target,
      progress: existing.progress,
      goal_number_in_cycle: existing.goal_number_in_cycle,
      started_at: existing.started_at,
      expires_at: existing.expires_at,
    });
  }

  // ── Contar metas no fallidas del ciclo actual para calcular goal_number ─────
  // Solo contamos: active, completed, rewarded (las que "contaron" en el ciclo)
  const sessionsThisCycle = await base44.asServiceRole.entities.WeeklyGoalSession.filter({
    user_email,
    week_cycle_id: weekCycleId,
  });
  const validSessionsInCycle = sessionsThisCycle.filter(s =>
    ['active', 'completed', 'rewarded'].includes(s.status)
  );
  const goalNumberInCycle = validSessionsInCycle.length + 1;
  const reward = getRewardForGoalNumber(goalNumberInCycle);

  // ── Crear nueva sesión con estado formal 'active' ──────────────────────────
  const newSession = await base44.asServiceRole.entities.WeeklyGoalSession.create({
    user_email,
    week_cycle_id: weekCycleId,
    goal_number_in_cycle: goalNumberInCycle,
    target: goal,
    progress: 0,
    status: 'active',
    completed: false,
    reward_claimed: false,
    archived: false,
    reward_xp: reward.xp,
    reward_stars: reward.stars,
    started_at: nowIso,
    expires_at: expiresAt,
  });

  auditLog('WEEKLY_GOAL_CREATED', {
    user_email,
    session_id: newSession.id,
    target: goal,
    progress: 0,
    reward_xp: reward.xp,
    reward_stars: reward.stars,
    goal_number_in_cycle: goalNumberInCycle,
    week_cycle_id: weekCycleId,
    started_at: nowIso,
    expires_at: expiresAt,
  });

  // ── Sincronizar GamificationProfile (campos legacy para compatibilidad UI) ──
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