import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Zona horaria: America/Matamoros (UTC-6)
const MATAMOROS_OFFSET_HOURS = -6;

const getMatamorosLocalDate = () => {
  const nowUtc = new Date();
  return new Date(nowUtc.getTime() + (MATAMOROS_OFFSET_HOURS * 60 * 60 * 1000));
};

const getLocalDateString = (dateObj) => {
  const y = dateObj.getUTCFullYear();
  const m = (dateObj.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = dateObj.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { goal } = body;

  if (!goal || typeof goal !== 'number' || goal < 1 || goal > 50) {
    return Response.json({ error: 'La meta debe ser un número entre 1 y 50' }, { status: 400 });
  }

  const user_email = user.email;
  const today = getLocalDateString(getMatamorosLocalDate());

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