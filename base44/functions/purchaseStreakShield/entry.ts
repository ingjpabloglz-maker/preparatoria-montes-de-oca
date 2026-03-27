import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const SHIELD_COST = 10;
const MAX_SHIELDS = 2;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const profiles = await base44.entities.GamificationProfile.filter({ user_email: user.email });
  const profile = profiles[0];

  if (!profile) return Response.json({ error: 'Perfil no encontrado' }, { status: 404 });

  const currentStars = profile.total_stars || 0;
  const currentShields = profile.streak_shields || 0;

  if (currentStars < SHIELD_COST) {
    return Response.json({ error: `Necesitas ${SHIELD_COST} estrellas. Tienes ${currentStars}.` }, { status: 400 });
  }

  if (currentShields >= MAX_SHIELDS) {
    return Response.json({ error: `Ya tienes el máximo de ${MAX_SHIELDS} protecciones activas.` }, { status: 400 });
  }

  await base44.entities.GamificationProfile.update(profile.id, {
    total_stars: currentStars - SHIELD_COST,
    streak_shields: currentShields + 1,
  });

  return Response.json({
    success: true,
    stars_remaining: currentStars - SHIELD_COST,
    shields: currentShields + 1,
  });
});