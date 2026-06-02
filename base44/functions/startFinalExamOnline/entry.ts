import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const EXAM_CONFIG = { total: 50, duration_minutes: 60 };
const ALLOWED_TYPES = ['multiple_choice', 'true_false', 'fill_blank'];
const EXAM_VERSION = '2.0';
const GRADING_VERSION = '1.0';

// ── Logging estructurado ──────────────────────────────────────────────────────
function logEvent(event, data = {}) {
  console.log(JSON.stringify({ event, timestamp: new Date().toISOString(), ...data }));
}

// ── Normalizar actividad legacy/fallback ──────────────────────────────────────
function normalizeActivity(a) {
  const out = { ...a };

  // 1. Normalizar correct_answer desde correct_answers si es array
  if (!out.correct_answer && Array.isArray(out.correct_answers) && out.correct_answers.length > 0) {
    out.correct_answer = out.correct_answers[0];
    out._normalized_from_correct_answers = true;
  }

  // 2. NO forzar type — si no tiene type, se excluye más adelante
  // 3. Asegurar options sea array
  if (!Array.isArray(out.options)) out.options = [];
  // 4. Asegurar explanation sea string
  if (typeof out.explanation !== 'string') out.explanation = '';

  return out;
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
    const existing = await base44.asServiceRole.entities.FinalExamSession.filter({ user_email: user.email, subject_id });
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

      logEvent('EXAM_ACTIVE_SESSION_RECOVERED', {
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

    // ── 2. Validar intentos usando SubjectProgress (fuente de verdad académica) ──
    const spArr = await base44.asServiceRole.entities.SubjectProgress.filter({ user_email: user.email, subject_id });
    const sp = spArr[0];

    if (sp) {
      // Si ya aprobó, bloqueo definitivo
      if (sp.test_passed) {
        logEvent('EXAM_ALREADY_PASSED', {
          user_email: user.email, subject_id,
          test_attempts: sp.test_attempts, final_grade: sp.final_grade,
        });
        return Response.json({
          error: 'Ya aprobaste esta materia. No puedes presentar el examen nuevamente.',
          already_completed: true,
          passed: true,
          score: sp.final_grade || null,
        }, { status: 409 });
      }

      const test_attempts = sp.test_attempts || 0;
      const final_exam_unlocked = sp.final_exam_unlocked || false;

      // Si agotó los 3 intentos y no tiene folio extraordinario activo
      if (test_attempts >= 3 && !final_exam_unlocked) {
        logEvent('EXAM_ATTEMPT_BLOCKED', {
          user_email: user.email, subject_id,
          test_attempts, final_exam_unlocked, is_blocked: true,
        });
        return Response.json({
          error: 'Has agotado los 3 intentos permitidos. Necesitas un folio de prueba extraordinaria.',
          is_blocked: true,
          attempts_exhausted: true,
        }, { status: 403 });
      }

      logEvent('EXAM_ATTEMPT_ALLOWED', {
        user_email: user.email, subject_id,
        test_attempts, final_exam_unlocked,
        attempt_to_start: test_attempts + 1,
      });
    }

    // ── 3. Verificar materia ──
    const subject = (await base44.asServiceRole.entities.Subject.filter({ id: subject_id }))[0];
    if (!subject) return Response.json({ error: 'Materia no encontrada' }, { status: 404 });

    // ── 4. Banco de preguntas con normalización flexible ──
    // CourseActivity NO tiene subject_id directo. Traversal: Subject → CourseLesson → CourseActivity
    const lessons = await base44.asServiceRole.entities.CourseLesson.filter({ subject_id });
    const lessonIds = lessons.map(l => l.id);

    console.log(JSON.stringify({ event: 'EXAM_LESSONS_FOUND', subject_id, lesson_count: lessonIds.length }));

    const activitiesPerLesson = await Promise.all(
      lessonIds.map(lid => base44.asServiceRole.entities.CourseActivity.filter({ lesson_id: lid }))
    );
    const allActivities = activitiesPerLesson.flat();

    let normalized_from_correct_answers = 0;
    let rejected_missing_question = 0;
    let rejected_missing_answer = 0;
    let rejected_unknown_type = 0;

    const valid = [];
    for (const raw of allActivities) {
      const a = normalizeActivity(raw);

      if (a._normalized_from_correct_answers) normalized_from_correct_answers++;

      if (!a.question) { rejected_missing_question++; continue; }
      if (!a.correct_answer) { rejected_missing_answer++; continue; }
      if (!a.type || !ALLOWED_TYPES.includes(a.type)) { rejected_unknown_type++; continue; }

      valid.push(a);
    }

    console.log(JSON.stringify({
      event: 'EXAM_QUESTION_SELECTION_DIAGNOSTIC',
      subject_id,
      total_activities: allActivities.length,
      total_valid: valid.length,
      normalized_from_correct_answers,
      rejected_missing_question,
      rejected_missing_answer,
      rejected_unknown_type,
    }));

    if (valid.length < 10) {
      return Response.json({ error: 'No hay suficientes preguntas en el banco. Mínimo 10 requeridas.' }, { status: 422 });
    }

    let selected = shuffle(valid).slice(0, EXAM_CONFIG.total);

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