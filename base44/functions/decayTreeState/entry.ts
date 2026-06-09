/**
 * decayTreeState — Automation scheduled: runs every 6 hours.
 * - Applies time-based decay to tree_energy and tree_vitality.
 * - Processes streak shield consumption day-by-day for inactive users.
 * - Prunes growth_flow entries older than 7 days.
 *
 * TIMEZONE: All date comparisons use America/Matamoros (UTC-6/UTC-5 DST).
 * Dates are always compared as YYYY-MM-DD strings derived from Intl.DateTimeFormat,
 * never from raw Date arithmetic, to be DST-safe.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Decay rates per hour of inactivity
const ENERGY_DECAY_PER_HOUR   = 1.2;   // 100 → 0 in ~83h
const VITALITY_DECAY_PER_HOUR = 0.02;  // 1 → 0 in ~50h
const GROWTH_FLOW_MAX_AGE_MS  = 7 * 24 * 60 * 60 * 1000;

// ─── DATE HELPERS (DST-safe, Intl-based) ─────────────────────────────────────

/** Returns "YYYY-MM-DD" for a given UTC timestamp in America/Matamoros. */
function toMatamorosDateStr(msOrIso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Matamoros',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(typeof msOrIso === 'number' ? new Date(msOrIso) : new Date(msOrIso));
}

/**
 * Computes exact calendar-day difference between two YYYY-MM-DD strings
 * using Date.UTC to be fully timezone-agnostic (no DST issues).
 */
function daysBetween(olderStr, newerStr) {
  if (!olderStr || !newerStr) return 0;
  const [oy, om, od] = olderStr.split('-').map(Number);
  const [ny, nm, nd] = newerStr.split('-').map(Number);
  return Math.round((Date.UTC(ny, nm - 1, nd) - Date.UTC(oy, om - 1, od)) / 86400000);
}

// ─── STREAK SHIELD LOGIC ─────────────────────────────────────────────────────

/**
 * Validates and self-heals streak_shields_paid_days.
 * If the field is somehow negative or larger than possible inactive days, clamp it.
 */
function sanitizePaidDays(paidDays, maxPossible) {
  const n = typeof paidDays === 'number' && Number.isFinite(paidDays) ? paidDays : 0;
  return Math.max(0, Math.min(n, maxPossible));
}

/**
 * Processes streak shield consumption for one user profile.
 * Returns the fields to update (or null if no streak change needed).
 *
 * Rules:
 * 1. If streak_days === 0 → already lost; NEVER consume shields. Return null.
 * 2. For each unpaid inactive day (beyond the grace day), consume 1 shield.
 * 3. If shields run out before all inactive days are covered → streak_days = 0.
 * 4. streak_shields_paid_days tracks how many days have been charged in this gap
 *    to avoid double-billing across multiple decay runs.
 */
function processStreakShields(gam, todayStr) {
  const streakDays   = gam.streak_days   ?? 0;
  const lastStudy    = gam.last_study_date_normalized;

  // ── EDGE CASE 4: racha ya muerta → no gastar escudos ──────────────────────
  if (streakDays <= 0) {
    console.log(JSON.stringify({
      event: 'STREAK_ALREADY_LOST',
      user: gam.user_email,
      streak_days: streakDays,
      shields: gam.streak_shields ?? 0,
      timestamp: todayStr,
    }));
    return null; // no update needed for streak
  }

  if (!lastStudy) return null; // no study history yet

  const totalInactiveDays = daysBetween(lastStudy, todayStr);

  // 0 or 1 inactive days → still in grace period, no shields needed
  if (totalInactiveDays <= 1) return null;

  // Days that require a shield (first inactive day = grace, from day 2 onwards)
  const daysRequiringShields = totalInactiveDays - 1;

  // Self-heal: clamp paid_days to a safe range
  const rawPaid = sanitizePaidDays(gam.streak_shields_paid_days, daysRequiringShields);

  // How many new days need to be charged in this run
  const newDaysToCharge = daysRequiringShields - rawPaid;

  if (newDaysToCharge <= 0) return null; // already charged up to today, no-op

  const shieldsBefore = gam.streak_shields ?? 0;
  let   shieldsAfter  = shieldsBefore;
  let   newStreakDays  = streakDays;
  let   paidDaysAfter = rawPaid;

  let streakProtected = false;
  let streakReset     = false;

  for (let i = 0; i < newDaysToCharge; i++) {
    if (shieldsAfter > 0) {
      shieldsAfter--;
      paidDaysAfter++;
      streakProtected = true;
    } else {
      // No more shields → streak dies
      newStreakDays = 0;
      streakReset   = true;
      break;
    }
  }

  // Structured audit logs
  if (streakReset) {
    console.log(JSON.stringify({
      event: 'STREAK_RESET',
      user:            gam.user_email,
      streak_before:   streakDays,
      streak_after:    0,
      shields_before:  shieldsBefore,
      shields_after:   shieldsAfter,
      inactive_days:   totalInactiveDays,
      days_charged:    newDaysToCharge,
      timestamp:       todayStr,
    }));
  } else if (streakProtected) {
    console.log(JSON.stringify({
      event: 'STREAK_SHIELD_CONSUMED',
      user:            gam.user_email,
      streak_before:   streakDays,
      streak_after:    newStreakDays,
      shields_before:  shieldsBefore,
      shields_after:   shieldsAfter,
      inactive_days:   totalInactiveDays,
      days_charged:    newDaysToCharge,
      timestamp:       todayStr,
    }));
  }

  return {
    streak_days:               newStreakDays,
    streak_shields:            Math.max(0, shieldsAfter),
    streak_shields_paid_days:  streakReset ? 0 : paidDaysAfter,
  };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow scheduled automation (no user auth) or admin call
  try {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    // Called from scheduled automation — no user token, proceed with service role
  }

  const nowMs  = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // ── "Today" in Matamoros timezone (DST-safe via Intl) ────────────────────
  const todayStr = toMatamorosDateStr(nowMs);

  // Fetch only student profiles
  const allUsers      = await base44.asServiceRole.entities.User.list();
  const studentEmails = new Set(allUsers.filter(u => u.role === 'user').map(u => u.email));

  const allProfiles = await base44.asServiceRole.entities.GamificationProfile.list();
  const profiles    = allProfiles.filter(p => studentEmails.has(p.user_email));

  let updated      = 0;
  let skipped      = 0;
  let streakEvents = 0;

  for (const gam of profiles) {
    const lastUpdate = gam.last_tree_update;
    if (!lastUpdate) { skipped++; continue; }

    const lastMs         = new Date(lastUpdate).getTime();
    const hoursInactive  = (nowMs - lastMs) / 3600000;
    const currentEnergy  = gam.tree_energy  ?? 0;
    const currentVitality= gam.tree_vitality ?? 0;

    // ── Tree energy / vitality decay ──────────────────────────────────────
    const newEnergy   = Math.max(0, currentEnergy   - ENERGY_DECAY_PER_HOUR   * hoursInactive);
    const newVitality = Math.max(0, currentVitality - VITALITY_DECAY_PER_HOUR * hoursInactive);

    // Prune growth_flow
    const rawFlow    = gam.growth_flow ?? [];
    const prunedFlow = rawFlow.filter(e => (nowMs - new Date(e.ts).getTime()) <= GROWTH_FLOW_MAX_AGE_MS);

    const energyDelta   = Math.abs(currentEnergy   - newEnergy);
    const vitalityDelta = Math.abs(currentVitality - newVitality);
    const flowChanged   = prunedFlow.length !== rawFlow.length;

    // ── Streak shield processing ──────────────────────────────────────────
    const streakUpdate = processStreakShields(gam, todayStr);

    const hasTreeChange   = energyDelta >= 0.5 || vitalityDelta >= 0.001 || flowChanged;
    const hasStreakChange = streakUpdate !== null;

    if (!hasTreeChange && !hasStreakChange && hoursInactive < 1) {
      skipped++;
      continue;
    }

    const decayIntensity = Math.min(1, (energyDelta / 100) * 0.5 + (vitalityDelta / 1) * 0.5);

    const patch = {
      tree_energy:         Math.round(newEnergy   * 10) / 10,
      tree_vitality:       Math.round(newVitality * 1000) / 1000,
      growth_flow:         prunedFlow,
      last_tree_update:    nowIso,
      last_sync_timestamp: nowIso,
      last_change_event: {
        type:      'decay',
        intensity: Math.round(decayIntensity * 1000) / 1000,
        source:    'decay',
        timestamp: nowIso,
      },
    };

    if (hasStreakChange) {
      Object.assign(patch, streakUpdate);
      streakEvents++;
    }

    await base44.asServiceRole.entities.GamificationProfile.update(gam.id, patch);
    updated++;
  }

  return Response.json({
    success:      true,
    processed:    profiles.length,
    updated,
    skipped,
    streak_events: streakEvents,
    ran_at:       nowIso,
  });
});