import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin' && user.role !== 'teacher') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const {
    user_email,
    subject_id,
    lesson_id,
    type,
    requires_manual_review,
    requires_reinforcement,
    only_failed,
    score_min,
    score_max,
    date_from,
    date_to,
    limit = 200,
  } = body;

  // Fetch all needed data in parallel
  const [attempts, subjects, lessons, modules, units, users] = await Promise.all([
    base44.asServiceRole.entities.EvaluationAttempt.list('-submitted_at', limit),
    base44.asServiceRole.entities.Subject.list(),
    base44.asServiceRole.entities.CourseLesson.list(),
    base44.asServiceRole.entities.CourseModule.list(),
    base44.asServiceRole.entities.CourseUnit.list(),
    base44.asServiceRole.entities.User.list(),
  ]);

  // Build lookup maps
  const subjectMap = {};
  for (const s of subjects) subjectMap[s.id] = s.name;

  const lessonMap = {};
  for (const l of lessons) lessonMap[l.id] = l;

  const moduleMap = {};
  for (const m of modules) moduleMap[m.id] = m;

  const unitMap = {};
  for (const u of units) unitMap[u.id] = u;

  const userMap = {};
  for (const u of users) {
    const apellidoP = u.apellido_paterno || '';
    const apellidoM = u.apellido_materno || '';
    const nombres = u.nombres || '';
    const parts = [apellidoP, apellidoM, nombres].filter(Boolean);
    userMap[u.email] = parts.length > 0 ? parts.join(' ') : (u.full_name || u.email);
  }

  // Filter
  const filtered = attempts.filter(a => {
    if (user_email) {
      const q = user_email.toLowerCase();
      const fullName = (userMap[a.user_email] || '').toLowerCase();
      if (!a.user_email?.toLowerCase().includes(q) && !fullName.includes(q)) return false;
    }
    if (subject_id && a.subject_id !== subject_id) return false;
    if (lesson_id && a.lesson_id !== lesson_id) return false;
    if (type && a.type !== type) return false;
    if (requires_manual_review !== undefined && a.requires_manual_review !== requires_manual_review) return false;
    if (requires_reinforcement && !a.requires_reinforcement) return false;
    if (only_failed && a.passed !== false) return false;
    if (score_min !== undefined && (a.score ?? 0) < score_min) return false;
    if (score_max !== undefined && (a.score ?? 100) > score_max) return false;
    if (date_from && a.submitted_at && new Date(a.submitted_at) < new Date(date_from)) return false;
    if (date_to && a.submitted_at && new Date(a.submitted_at) > new Date(date_to)) return false;
    return true;
  });

  // Enrich each attempt with full academic context
  const enriched = filtered.map(a => {
    const lesson = lessonMap[a.lesson_id] || {};
    const mod = moduleMap[lesson.module_id] || {};
    const unit = unitMap[mod.unit_id] || {};

    return {
      ...a,
      full_name: userMap[a.user_email] || a.user_email,
      subject_title: subjectMap[a.subject_id] || a.subject_id,
      lesson_title: lesson.title || null,
      module_title: mod.title || null,
      unit_title: unit.title || null,
    };
  });

  return Response.json({ status: 'ok', attempts: enriched, total: enriched.length });
});