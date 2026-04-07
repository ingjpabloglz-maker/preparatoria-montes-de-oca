import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
  const nowIso = new Date().toISOString();

  const gamArr = await base44.asServiceRole.entities.GamificationProfile.filter({ user_email });
  const gam = gamArr[0];

  if (!gam) return Response.json({ error: 'Perfil no encontrado' }, { status: 404 });

  const waterTokens = gam.water_tokens ?? 0;
  if (waterTokens <= 0) {
    return Response.json({ error: 'No tienes agua disponible' }, { status: 400 });
  }

  const prevGrowth = gam.tree_growth_points ?? 0;
  const prevStage  = gam.tree_stage ?? 0;
  const growthStreak = gam.growth_streak ?? 0;

  const newWaterTokens  = waterTokens - 1;
  const newGrowthPoints = prevGrowth + 1;
  const newStage        = calcStage(newGrowthPoints);
  const treeLevelUp     = newStage > prevStage;

  // tree_energy: sube con riego manual (peso = 2), limitado a 100
  const newTreeEnergy = Math.round(Math.min(100, (gam.tree_energy ?? 0) + 2 + growthStreak * 0.1) * 10) / 10;

  // tree_vitality: el riego manual da un impulso moderado (peso 2/8 * 0.35)
  const vitalityBoost = 0.088;
  const newVitality   = Math.min(1, Math.round(((gam.tree_vitality ?? 0) + vitalityBoost) * 1000) / 1000);

  // growth_flow: agrega entrada de riego manual (weight = 2)
  const existingFlow = gam.growth_flow ?? [];
  const newFlowEntry = { ts: nowIso, weight: 2 };
  const newGrowthFlow = [...existingFlow, newFlowEntry].slice(-20);

  await base44.asServiceRole.entities.GamificationProfile.update(gam.id, {
    water_tokens:      newWaterTokens,
    tree_growth_points: newGrowthPoints,
    tree_stage:        newStage,
    tree_energy:       newTreeEnergy,
    tree_vitality:     newVitality,
    growth_flow:       newGrowthFlow,
    last_tree_update:  nowIso,
  });

  return Response.json({
    success: true,
    water_tokens:      newWaterTokens,
    tree_growth_points: newGrowthPoints,
    tree_stage:        newStage,
    tree_energy:       newTreeEnergy,
    tree_vitality:     newVitality,
    tree_level_up:     treeLevelUp,
  });
});