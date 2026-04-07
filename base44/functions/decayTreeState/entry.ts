/**
 * decayTreeState — Automation scheduled: runs every 6 hours.
 * Applies time-based decay to tree_energy and tree_vitality
 * for ALL users based on their last_tree_update.
 * Also prunes growth_flow entries older than 7 days.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Decay rates per hour of inactivity
const ENERGY_DECAY_PER_HOUR  = 1.2;  // 100 → 0 in ~83h of total inactivity
const VITALITY_DECAY_PER_HOUR = 0.02; // 1 → 0 in ~50h of total inactivity
const GROWTH_FLOW_MAX_AGE_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow scheduled automation (no user auth) or admin call
  let isAdmin = false;
  try {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    isAdmin = true;
  } catch {
    // Called from scheduled automation — no user token, use service role only
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // Fetch all profiles
  const profiles = await base44.asServiceRole.entities.GamificationProfile.list();

  let updated = 0;
  let skipped = 0;

  for (const gam of profiles) {
    const lastUpdate = gam.last_tree_update;
    if (!lastUpdate) { skipped++; continue; }

    const lastMs = new Date(lastUpdate).getTime();
    const hoursInactive = (nowMs - lastMs) / (1000 * 60 * 60);

    // Only decay if inactive for at least 1 hour
    if (hoursInactive < 1) { skipped++; continue; }

    const currentEnergy   = gam.tree_energy   ?? 0;
    const currentVitality = gam.tree_vitality  ?? 0;

    const newEnergy   = Math.max(0, currentEnergy   - ENERGY_DECAY_PER_HOUR   * hoursInactive);
    const newVitality = Math.max(0, currentVitality - VITALITY_DECAY_PER_HOUR * hoursInactive);

    // Prune growth_flow: remove entries older than 7 days
    const rawFlow = gam.growth_flow ?? [];
    const prunedFlow = rawFlow.filter(entry => {
      const entryMs = new Date(entry.ts).getTime();
      return (nowMs - entryMs) <= GROWTH_FLOW_MAX_AGE_MS;
    });

    // Skip write if nothing meaningfully changed
    const energyDelta   = Math.abs(currentEnergy   - newEnergy);
    const vitalityDelta = Math.abs(currentVitality - newVitality);
    const flowChanged   = prunedFlow.length !== rawFlow.length;

    if (energyDelta < 0.5 && vitalityDelta < 0.001 && !flowChanged) {
      skipped++;
      continue;
    }

    await base44.asServiceRole.entities.GamificationProfile.update(gam.id, {
      tree_energy:    Math.round(newEnergy * 10) / 10,
      tree_vitality:  Math.round(newVitality * 1000) / 1000,
      growth_flow:    prunedFlow,
      last_tree_update: nowIso,
    });

    updated++;
  }

  return Response.json({
    success: true,
    processed: profiles.length,
    updated,
    skipped,
    ran_at: nowIso,
  });
});