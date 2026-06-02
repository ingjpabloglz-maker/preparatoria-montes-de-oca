import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const EXAM_CONFIG = { total: 50, easy: 15, medium: 25, hard: 10, duration_minutes: 60 };
const EXAM_VERSION = '2.0';
const GRADING_VERSION = '1.0';

// ── Logging estructurado ──────────────────────────────────────────────────────
function logEvent(event, data = {}) {
  console.log(JSON.stringify({ event, timestamp: new Date().toISOString(), ...data }));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sanitizeQuestionForFrontend(q) {
  // NUNCA enviar correct_answer, explanation, is_correct, score_points al frontend
  return {
    index: q.index,
    activity_id: q.activity_id,
    question_text: q.question_text,
    type: q.type,
    options: q.options || [],
    difficulty: q.difficulty,
    user_answer: q.user_answer || null,
    flagged: q.flagged || false,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const { subject_id } = await req.json();
    if (!subject_id) return Response.json({ error: 'subject_id requerido' }, { status: 400 });

    // ── 1. Buscar sesión activa existente ──
    const existing = await base44.entities.FinalExamSession.filter({ user_email: user.email, subject_id });
    const active = existing.find(s => s.status === 'in_progress' && !s.is_locked);

    if (active) {
      const now = new Date();
      const expiresAt = new Date(active.expires_at);

      if (now > expiresAt) {
        await base44.asServiceRole.entities.FinalExamSession.update(active.id, {
          status: 'expired', is_locked: true
        });
        logEvent('EXAM_EXPIRED', { session_id: active.id, user_email: user.email, subject_id, reason: 'detected_on_recovery' });
        return Response.json({ error: 'El examen expiró. Contacta a tu docente.', expired: true }, { status: 410 });
      }

      // Sesión recuperada — incrementar recovery_count
      const recovery_count = (active.recovery_count || 0) + 1;
      await base44.asServiceRole.entities.FinalExamSession.update(active.id, {
        recovery_count,
        last_activity_at: new Date().toISOString(),
      });

      logEvent('EXAM_RECOVERED', {
        session_id: active.id, user_email: user.email, subject_id,
        recovery_count, time_remaining_seconds: Math.floor((expiresAt - now) / 1000),
      });

      const time_remaining_seconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
      return Response.json({
        session_id: active.id,
        recovered: true,
        exam_started_at: active.exam_started_at,
        expires_at: active.expires_at,
        last_activity_at: active.last_activity_at,
        time_remaining_seconds,
        questions: active.questions.map(sanitizeQuestionForFrontend),
        subject_name: active.subject_name,
        attempt_number: active.attempt_number,
      });
    }

    // ── 2. Verificar si ya completó el examen ──
    const completed = existing.find(s => ['completed', 'submitted_late', 'auto_graded'].includes(s.status));
    if (completed) {
      return Response.json({
        error: 'Ya presentaste este examen.',
        already_completed: true,
        score: completed.score,
        passed: completed.passed,
        session_id: completed.id,
      }, { status: 409 });
    }

    // ── 3. Verificar materia ──
    const subject = (await base44.asServiceRole.entities.Subject.filter({ id: subject_id }))[0];
    if (!subject) return Response.json({ error: 'Materia no encontrada' }, { status: 404 });

    // ── 4. Banco de preguntas con balance de dificultad ──
    const allActivities = await base44.asServiceRole.entities.CourseActivity.filter({ subject_id });
    const valid = allActivities.filter(a =>
      a.question && a.correct_answer && a.type &&
      ['multiple_choice', 'true_false', 'fill_blank'].includes(a.type)
    );

    const byDiff = { easy: [], medium: [], hard: [] };
    for (const a of valid) {
      const d = a.difficulty || 'medium';
      if (byDiff[d]) byDiff[d].push(a);
    }

    const pick = (arr, n) => shuffle(arr).slice(0, n);
    let selected = [
      ...pick(byDiff.easy, EXAM_CONFIG.easy),
      ...pick(byDiff.medium, EXAM_CONFIG.medium),
      ...pick(byDiff.hard, EXAM_CONFIG.hard),
    ];

    if (selected.length < EXAM_CONFIG.total) {
      const selectedIds = new Set(selected.map(a => a.id));
      const remaining = valid.filter(a => !selectedIds.has(a.id));
      selected = [...selected, ...pick(remaining, EXAM_CONFIG.total - selected.length)];
    }

    if (selected.length < 10) {
      return Response.json({ error: 'No hay suficientes preguntas en el banco. Mínimo 10 requeridas.' }, { status: 422 });
    }

    selected = shuffle(selected);

    // ── 5. Construir preguntas con correct_answer en DB ──
    const questions = selected.map((a, idx) => ({
      index: idx,
      activity_id: a.id,
      question_text: a.question,
      type: a.type,
      options: a.options || [],
      difficulty: a.difficulty || 'medium',
      correct_answer: a.correct_answer,
      explanation: a.explanation || '',
      user_answer: null,
      is_correct: null,
      score_points: null,
      flagged: false,
    }));

    const attempt_number = existing.length + 1;
    const now = new Date();
    const expires_at = new Date(now.getTime() + EXAM_CONFIG.duration_minutes * 60 * 1000).toISOString();
    const exam_started_at = now.toISOString();

    const ip_address = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';
    const device_info = req.headers.get('user-agent') || '';

    const session = await base44.asServiceRole.entities.FinalExamSession.create({
      user_email: user.email,
      subject_id,
      subject_name: subject.name,
      exam_version: EXAM_VERSION,
      grading_version: GRADING_VERSION,
      status: 'in_progress',
      is_locked: false,
      exam_started_at,
      expires_at,
      last_activity_at: exam_started_at,
      recovery_count: 0,
      autosave_count: 0,
      questions,
      attempt_number,
      ip_address,
      device_info,
    });

    logEvent('EXAM_STARTED', {
      session_id: session.id, user_email: user.email, subject_id,
      subject_name: subject.name, attempt_number,
      question_count: questions.length,
      bank_size: valid.length,
      difficulty_distribution: { easy: byDiff.easy.length, medium: byDiff.medium.length, hard: byDiff.hard.length },
      exam_version: EXAM_VERSION, grading_version: GRADING_VERSION,
    });

    return Response.json({
      session_id: session.id,
      recovered: false,
      exam_started_at,
      expires_at,
      last_activity_at: exam_started_at,
      time_remaining_seconds: EXAM_CONFIG.duration_minutes * 60,
      questions: questions.map(sanitizeQuestionForFrontend),
      subject_name: subject.name,
      attempt_number,
    });

  } catch (e) {
    console.error('[startFinalExamOnline]', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});