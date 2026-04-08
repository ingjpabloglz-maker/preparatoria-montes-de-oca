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

  // Fetch subjects to enrich with names
  const [attempts, subjects] = await Promise.all([
    base44.asServiceRole.entities.EvaluationAttempt.list('-submitted_at', limit),
    base44.asServiceRole.entities.Subject.list(),
  ]);

  const subjectMap = {};
  for (const s of subjects) subjectMap[s.id] = s.name;

  const filtered = attempts.filter(a => {
    if (user_email) {
      const q = user_email.toLowerCase();
      if (!a.user_email?.toLowerCase().includes(q)) return false;
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

  // Enrich with subject name
  const enriched = filtered.map(a => ({
    ...a,
    subject_name: subjectMap[a.subject_id] || a.subject_id,
  }));

  return Response.json({ status: 'ok', attempts: enriched, total: enriched.length });
});