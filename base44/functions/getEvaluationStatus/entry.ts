import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Endpoint que devuelve el estado real de evaluación de una materia para el frontend.
// El frontend NO debe calcular bloqueos ni intentos: solo reflejar este estado.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { subject_id } = body;

  if (!subject_id) {
    return Response.json({ error: 'subject_id is required' }, { status: 400 });
  }

  const user_email = user.email;

  // ─── Obtener SubjectProgress ──────────────────────────────────────────────────
  const spArr = await base44.asServiceRole.entities.SubjectProgress.filter({ user_email, subject_id });
  const sp = spArr[0];

  const test_attempts = sp?.test_attempts || 0;
  const test_passed = sp?.test_passed || false;
  const final_grade = sp?.final_grade ?? null;
  const progress_percent = sp?.progress_percent || 0;
  const is_completed = progress_percent >= 100 || sp?.completed || false;
  const final_exam_unlocked = sp?.final_exam_unlocked || false;
  const extraordinary_attempts_used = sp?.extraordinary_attempts_used || 0;
  const requires_reinforcement = sp?.requires_reinforcement || false;
  const errors_noted = sp?.errors_noted || [];

  // ─── Calcular estado del examen final ─────────────────────────────────────────
  const is_blocked = !test_passed && test_attempts >= 3 && !final_exam_unlocked;
  const attempts_left = Math.max(0, 3 - test_attempts);
  const can_take_exam = is_completed && !test_passed && !is_blocked;

  // ─── Contar intentos de mini_eval desde EvaluationAttempt ─────────────────────
  const miniEvalAttempts = await base44.asServiceRole.entities.EvaluationAttempt.filter({
    user_email, subject_id, type: 'mini_eval',
  });

  return Response.json({
    status: 'ok',
    subject_id,
    // Progreso de contenido
    progress_percent,
    is_completed,
    // Estado del examen final
    test_attempts,
    test_passed,
    final_grade,
    is_blocked,
    attempts_left,
    can_take_exam,
    final_exam_unlocked,
    extraordinary_attempts_used,
    // Señal académica de refuerzo (mini_eval)
    requires_reinforcement,
    errors_noted,
    // Conteo de mini_eval
    mini_eval_total_attempts: miniEvalAttempts.length,
    mini_eval_passed: miniEvalAttempts.filter(a => a.passed === true).length,
  });
});