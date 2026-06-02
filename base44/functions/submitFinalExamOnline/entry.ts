import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PASSING_SCORE = 70;

function normalizeAnswer(str = '') {
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const { session_id, final_answers } = await req.json();
    if (!session_id) return Response.json({ error: 'session_id requerido' }, { status: 400 });

    // ── Cargar sesión ──
    const sessions = await base44.asServiceRole.entities.FinalExamSession.filter({ id: session_id });
    const session = sessions[0];
    if (!session) return Response.json({ error: 'Sesión no encontrada' }, { status: 404 });

    // ── Validaciones de seguridad ──
    if (session.user_email !== user.email) return Response.json({ error: 'Acceso denegado' }, { status: 403 });

    // Protección contra doble submit — idempotente
    if (session.is_locked) {
      return Response.json({
        session_id,
        already_submitted: true,
        score: session.score,
        passed: session.passed,
        status: session.status,
        correct_count: session.correct_count,
        incorrect_count: session.incorrect_count,
      });
    }

    if (session.status !== 'in_progress') return Response.json({ error: 'Sesión no activa.' }, { status: 409 });

    const now = new Date();
    const submitted_at = now.toISOString();

    // ── Aplicar últimas respuestas con validación de ownership ──
    if (Array.isArray(final_answers) && final_answers.length > 0) {
      const sessionActivityIds = new Set(session.questions.map(q => q.activity_id));
      const map = {};
      for (const fa of final_answers) {
        // Solo aceptar IDs que pertenezcan a esta sesión — nunca confiar en el cliente
        if (fa.activity_id && sessionActivityIds.has(fa.activity_id)) {
          map[fa.activity_id] = fa;
        }
      }
      session.questions = session.questions.map(q => {
        const fa = map[q.activity_id];
        if (!fa) return q;
        return { ...q, user_answer: fa.user_answer !== undefined ? fa.user_answer : q.user_answer };
      });
    }

    // ── BACKEND AUTHORITY: determinar si fue a tiempo ──
    const isLate = now > new Date(session.expires_at);
    const duration_seconds = Math.floor((now - new Date(session.exam_started_at)) / 1000);

    // ── Calificación — 100% backend ──
    const points_per_question = 100 / session.questions.length;
    let total_score = 0;
    let correct_count = 0;
    let incorrect_count = 0;

    session.questions = session.questions.map(q => {
      const answered = q.user_answer !== null && q.user_answer !== undefined && q.user_answer !== '';
      let is_correct = false;
      if (answered) {
        if (q.type === 'fill_blank') {
          is_correct = normalizeAnswer(q.user_answer) === normalizeAnswer(q.correct_answer);
        } else {
          is_correct = q.user_answer === q.correct_answer;
        }
      }
      const score_points = is_correct ? points_per_question : 0;
      total_score += score_points;
      if (is_correct) correct_count++; else incorrect_count++;
      return { ...q, is_correct, score_points };
    });

    const score = Math.round(total_score * 10) / 10;
    const passed = score >= PASSING_SCORE;
    const status = isLate ? 'submitted_late' : 'completed';

    // ── Guardar sesión finalizada y bloqueada ──
    await base44.asServiceRole.entities.FinalExamSession.update(session_id, {
      questions: session.questions,
      status,
      is_locked: true,
      submitted_at,
      duration_seconds,
      score,
      passed,
      correct_count,
      incorrect_count,
      last_activity_at: submitted_at,
    });

    // ── Actualizar SubjectProgress ──
    const progresses = await base44.asServiceRole.entities.SubjectProgress.filter({
      user_email: user.email, subject_id: session.subject_id
    });
    const progress = progresses[0];
    if (progress) {
      const prev_grade = progress.final_grade || 0;
      await base44.asServiceRole.entities.SubjectProgress.update(progress.id, {
        test_attempts: (progress.test_attempts || 0) + 1,
        final_grade: score > prev_grade ? score : prev_grade,
        test_passed: passed || progress.test_passed,
        final_exam_status: passed ? 'approved' : 'rejected',
        last_activity: submitted_at,
      });
    }

    // ── Respuesta al frontend: ahora SÍ incluir correct_answer y explanation ──
    const questions_with_results = session.questions.map(q => ({
      index: q.index,
      activity_id: q.activity_id,
      question_text: q.question_text,
      type: q.type,
      options: q.options,
      user_answer: q.user_answer,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      is_correct: q.is_correct,
      flagged: q.flagged,
    }));

    return Response.json({
      session_id,
      score,
      passed,
      status,
      correct_count,
      incorrect_count,
      duration_seconds,
      is_late: isLate,
      questions_with_results,
    });

  } catch (e) {
    console.error('[submitFinalExamOnline]', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});