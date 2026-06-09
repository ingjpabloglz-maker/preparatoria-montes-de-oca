import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SERVICE_ACCOUNT_RE = /^service\+|@no-reply\.base44\.com$|^bot\+|^automation\+|^system\+/i;
function requireStudentRole(user, fnName) {
  const email = user?.email || 'anonymous';
  const role = user?.role || 'none';
  if (!user || user.role !== 'user' || SERVICE_ACCOUNT_RE.test(email)) {
    console.log(JSON.stringify({ event: 'NON_STUDENT_OPERATION_BLOCKED', function: fnName, email, role, timestamp: new Date().toISOString() }));
    return Response.json({ status: 'ignored', message: 'Operación exclusiva para alumnos.', blocked_role: role }, { status: 403 });
  }
  return null;
}

// Obtiene la fecha actual en la zona horaria America/Matamoros (respeta DST)
const getLocalDateString = (dateObj) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Matamoros',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(dateObj);
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Solo alumnos configuran metas semanales
  const blocked = requireStudentRole(user, 'setWeeklyGoal');
  if (blocked) return blocked;

  const body = await req.json();
  const { goal } = body;

  if (!goal || typeof goal !== 'number' || goal < 1 || goal > 50) {
    return Response.json({ error: 'La meta debe ser un número entre 1 y 50' }, { status: 400 });
  }

  const user_email = user.email;
  const today = getLocalDateString(new Date());

  const gamArr = await base44.asServiceRole.entities.GamificationProfile.filter({ user_email });
  const gam = gamArr[0] || null;

  const update = {
    weekly_goal_target: goal,
    weekly_goal_progress: 0,
    weekly_goal_start_date: today,
    weekly_goal_completed: false,
    weekly_goal_reward_claimed: false,
  };

  if (gam) {
    await base44.asServiceRole.entities.GamificationProfile.update(gam.id, update);
  } else {
    await base44.asServiceRole.entities.GamificationProfile.create({ user_email, ...update });
  }

  return Response.json({ status: 'ok', goal, start_date: today });
});