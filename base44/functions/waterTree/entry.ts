import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const STAGE_THRESHOLDS = [0, 5, 15, 30, 60, 100, 150, 220, 300, 400, 550, 750, 1000];

function calcStage(growthPoints) {
  let stage = 0;
  for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (growthPoints >= STAGE_THRESHOLDS[i]) { stage = i; break; }
  }
  return stage;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const user_email = user.email;

  const gamArr = await base44.asServiceRole.entities.GamificationProfile.filter({ user_email });
  const gam = gamArr[0];

  if (!gam) return Response.json({ error: 'Perfil no encontrado' }, { status: 404 });

  const waterTokens = gam.water_tokens ?? 0;
  if (waterTokens <= 0) {
    return Response.json({ error: 'No tienes agua disponible' }, { status: 400 });
  }

  const prevGrowth = gam.tree_growth_points ?? 0;
  const prevStage = gam.tree_stage ?? 0;

  const newWaterTokens = waterTokens - 1;
  const newGrowthPoints = prevGrowth + 1;
  const newStage = calcStage(newGrowthPoints);
  const treeLevelUp = newStage > prevStage;

  await base44.asServiceRole.entities.GamificationProfile.update(gam.id, {
    water_tokens: newWaterTokens,
    tree_growth_points: newGrowthPoints,
    tree_stage: newStage,
    last_tree_update: new Date().toISOString(),
  });

  return Response.json({
    success: true,
    water_tokens: newWaterTokens,
    tree_growth_points: newGrowthPoints,
    tree_stage: newStage,
    tree_level_up: treeLevelUp,
  });
});