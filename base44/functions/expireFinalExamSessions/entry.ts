import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PASSING_SCORE = 70;
const GRADING_VERSION = '1.0';

function logEvent(event, data = {}) {
  console.log(JSON.stringify({ event, timestamp: new Date().toISOString(), ...data }));
}

function normalizeAnswer(str = '') {
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function gradeAndLockSession(base44, session) {
  const now = new Date().toISOString();
  const points_per_question = 100 / session.questions.length;
  let total_score = 0, correct_count = 0, incorrect_count = 0, unanswered_count = 0;

  const gradedQuestions = session.questions.map(q => {
    const answered = q.user_answer !== null && q.user_answer !== undefined && q.user_answer !== '';
    if (!answered) { unanswered_count++; return { ...q, is_correct: false, score_points: 0 }; }
    const is_correct = q.type === 'fill_blank'
      ? normalizeAnswer(q.user_answer) === normalizeAnswer(q.correct_answer)
      : q.user_answer === q.correct_answer;
    const score_points = is_correct ? points_per_question : 0;
    total_score += score_points;
    if (is_correct) correct_count++; else incorrect_count++;
    return { ...q, is_correct, score_points };
  });

  const score = Math.round(total_score * 10) / 10;
  const passed = score >= PASSING_SCORE;

  await base44.asServiceRole.entities.FinalExamSession.update(session.id, {
    questions: gradedQuestions,
    status: 'auto_graded',
    is_locked: true,
    auto_graded: true,
    submitted_at: now,
    duration_seconds: Math.floor((new Date(session.expires_at) - new Date(session.exam_started_at)) / 1000),
    score,
    passed,
    correct_count,
    incorrect_count,
    last_activity_at: now,
  });

  // Actualizar SubjectProgress
  const progresses = await base44.asServiceRole.entities.SubjectProgress.filter({
    user_email: session.user_email,
    subject_id: session.subject_id,
  });
  const progress = progresses[0];
  if (progress) {
    const prev_grade = progress.final_grade || 0;
    await base44.asServiceRole.entities.SubjectProgress.update(progress.id, {
      test_attempts: (progress.test_attempts || 0) + 1,
      final_grade: score > prev_grade ? score : prev_grade,
      test_passed: passed || progress.test_passed,
      final_exam_status: passed ? 'approved' : 'rejected',
      last_activity: now,
    });
  }

  logEvent('EXAM_AUTO_GRADED', {
    session_id: session.id, user_email: session.user_email, subject_id: session.subject_id,
    score, passed, correct_count, incorrect_count, unanswered_count,
    autosave_count: session.autosave_count || 0,
    recovery_count: session.recovery_count || 0,
    grading_version: GRADING_VERSION,
  });

  return { session_id: session.id, user_email: session.user_email, score, passed };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permitir llamada de automation (sin auth) o admin
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch (_) {
      // Llamada desde automation programada — continuar con service role
    }

    const now = new Date();
    const sessions = await base44.asServiceRole.entities.FinalExamSession.list('-exam_started_at', 200);
    const zombie = sessions.filter(s =>
      s.status === 'in_progress' &&
      !s.is_locked &&
      s.expires_at &&
      new Date(s.expires_at) < now
    );

    logEvent('EXAM_EXPIRE_SCAN', {
      checked: sessions.length,
      zombie_found: zombie.length,
      ran_at: now.toISOString(),
    });

    const results = [];
    for (const session of zombie) {
      const result = await gradeAndLockSession(base44, session);
      results.push(result);
      logEvent('EXAM_LOCKED', {
        session_id: session.id, user_email: session.user_email, subject_id: session.subject_id,
        reason: 'auto_expire', score: result.score,
      });
    }

    return Response.json({
      success: true,
      checked: sessions.length,
      expired_found: zombie.length,
      auto_graded: results.length,
      results,
      ran_at: now.toISOString(),
    });

  } catch (e) {
    console.error('[expireFinalExamSessions]', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});