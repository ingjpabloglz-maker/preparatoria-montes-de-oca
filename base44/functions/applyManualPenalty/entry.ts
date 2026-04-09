import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['docente', 'admin'].includes(user.role)) {
      return Response.json({ error: 'FORBIDDEN: solo docentes y admins pueden penalizar' }, { status: 403 });
    }

    const { user_email, reason, severity } = await req.json();
    if (!user_email || !reason || !severity) {
      return Response.json({ error: 'Faltan parámetros: user_email, reason, severity' }, { status: 400 });
    }

    const severityPoints = severity === 'warning' ? 5 : severity === 'medium' ? 15 : 30;

    const banDays = severity === 'warning' ? 0 : severity === 'medium' ? 3 : 7;

    const now = new Date();

    // Actualizar o crear ForumPenalty
    const sa = base44.asServiceRole;
    const penalties = await sa.entities.ForumPenalty.filter({ user_email });
    const existing = penalties?.[0];
    const incidentCount = (existing?.incident_count || 0) + 1;

    const bannedUntil = banDays > 0
      ? new Date(now.getTime() + banDays * 24 * 60 * 60 * 1000).toISOString()
      : existing?.banned_until || null;

    const penaltyData = {
      user_email,
      incident_count: incidentCount,
      banned_until: bannedUntil,
      last_incident_date: now.toISOString(),
      last_incident_reason: `[${severity.toUpperCase()} — ${user.full_name}] ${reason}`,
    };

    let penaltyId;
    if (existing) {
      await sa.entities.ForumPenalty.update(existing.id, penaltyData);
      penaltyId = existing.id;
    } else {
      const created = await sa.entities.ForumPenalty.create(penaltyData);
      penaltyId = created.id;
    }

    // Registrar en UserReport para auditoría
    await sa.entities.UserReport.create({
      reported_user_email: user_email,
      reported_by: user.email,
      reported_by_name: user.full_name,
      reported_by_role: user.role,
      reason: `[PENALIZACIÓN MANUAL — ${severity.toUpperCase()}] ${reason}`,
      status: 'reviewed',
    });

    // Descontar XP si existe GamificationProfile
    const gamArr = await sa.entities.GamificationProfile.filter({ user_email });
    const gam = gamArr?.[0];
    if (gam) {
      const xpPenalty = Math.min(gam.xp_points || 0, severityPoints);
      await sa.entities.GamificationProfile.update(gam.id, {
        xp_points: Math.max(0, (gam.xp_points || 0) - xpPenalty),
        ...(severity !== 'warning' ? { streak_days: 0 } : {}),
      });
    }

    return Response.json({
      success: true,
      penalty_id: penaltyId,
      incident_count: incidentCount,
      ban_days: banDays,
      banned_until: bannedUntil,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});