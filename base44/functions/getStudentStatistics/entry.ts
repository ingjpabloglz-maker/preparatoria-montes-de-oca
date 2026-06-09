import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function requireAdmin(base44) {
  const user = await base44.auth.me();
  if (!user) return { error: 'Unauthorized', status: 401 };
  if (user.role !== 'admin') return { error: 'Forbidden: Admin access required', status: 403 };
  return { user };
}

const daysSince = (isoDate) => {
  if (!isoDate) return 999;
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const formatName = (u) => {
  const parts = [u.apellido_paterno, u.apellido_materno, u.nombres].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (u.full_name || u.user_email || 'Sin nombre');
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireAdmin(base44);
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

    const sa = base44.asServiceRole;

    const [allProfiles, allProgress, allGamification, allSubjectProgress, subjects] = await Promise.all([
      sa.entities.UserProfile.list(),
      sa.entities.UserProgress.list(),
      sa.entities.GamificationProfile.list(),
      sa.entities.SubjectProgress.list(),
      sa.entities.Subject.list('level'),
    ]);

    const students = allProfiles.filter(u => u.role === 'user');
    const studentEmails = new Set(students.map(u => u.user_email));
    const total_students = students.length;

    const enriched = students.map(u => {
      const prog = allProgress.find(p => p.user_email === u.user_email);
      const gam = allGamification.find(g => g.user_email === u.user_email);
      const lastStudy = gam?.last_study_date_normalized;
      const days = daysSince(lastStudy);
      return {
        email: u.user_email,
        name: formatName(u),
        level: prog?.current_level || 1,
        progress: Math.round(prog?.total_progress_percent || 0),
        blocked: prog?.blocked_due_to_time || false,
        xp: gam?.xp_points || 0,
        streak: gam?.streak_days || 0,
        daysSinceActivity: days,
      };
    });

    const active_today = enriched.filter(s => s.daysSinceActivity <= 1).length;
    const at_risk = enriched.filter(s => s.daysSinceActivity >= 2 && s.daysSinceActivity <= 5).length;
    const inactive = enriched.filter(s => s.daysSinceActivity >= 6).length;

    const avg_xp = total_students > 0
      ? Math.round(enriched.reduce((a, s) => a + s.xp, 0) / total_students)
      : 0;
    const avg_streak = total_students > 0
      ? Math.round(enriched.reduce((a, s) => a + s.streak, 0) / total_students)
      : 0;

    const levelDist = [1, 2, 3, 4, 5, 6].map(lvl => {
      const inLevel = allProgress.filter(p => p.current_level === lvl && studentEmails.has(p.user_email));
      const avgProg = inLevel.length > 0
        ? Math.round(inLevel.reduce((a, p) => a + (p.total_progress_percent || 0), 0) / inLevel.length)
        : 0;
      return { level: `N${lvl}`, alumnos: inLevel.length, progreso: avgProg };
    }).filter(d => d.alumnos > 0);

    const atRiskList = enriched
      .filter(s => s.daysSinceActivity >= 2)
      .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity)
      .slice(0, 15);

    const topByXP = [...enriched].sort((a, b) => b.xp - a.xp).slice(0, 10);
    const topByStreak = [...enriched].sort((a, b) => b.streak - a.streak).slice(0, 10);

    const subjectCompletions = subjects.map(s => ({
      name: s.name,
      level: s.level,
      completions: allSubjectProgress.filter(sp => sp.subject_id === s.id && sp.test_passed).length,
    })).filter(s => s.completions > 0).sort((a, b) => b.completions - a.completions);

    const weekActivity = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const label = d.toLocaleDateString('es-MX', { weekday: 'short' });
      const count = enriched.filter(s => s.daysSinceActivity === (6 - i)).length;
      return { day: label, activos: count };
    });

    return Response.json({
      total_students, active_today, at_risk, inactive,
      avg_xp, avg_streak,
      levelDist, atRiskList, topByXP, topByStreak,
      subjectCompletions, weekActivity,
      raw_students: enriched,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});