import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const LOCK_TIMEOUT_MINUTES = 15;
const MIN_REVIEW_SECONDS = 45;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (!['admin', 'docente'].includes(user.role)) {
    return Response.json({ error: 'Forbidden: exam.review permission required' }, { status: 403 });
  }

  const body = await req.json();
  const { attempt_id, score, passed, feedback, review_started_at } = body;

  if (!attempt_id || score === undefined || passed === undefined) {
    return Response.json({ error: 'attempt_id, score and passed are required' }, { status: 400 });
  }
  if (score < 0 || score > 100) {
    return Response.json({ error: 'score must be between 0 and 100' }, { status: 400 });
  }

  // ─── Validar tiempo mínimo de revisión (obligatorio en backend) ────────────
  if (!review_started_at) {
    return Response.json({ error: 'review_started_at is required' }, { status: 400 });
  }
  const now = new Date();
  const reviewStart = new Date(review_started_at);
  const elapsedSeconds = Math.round((now - reviewStart) / 1000);

  if (elapsedSeconds < MIN_REVIEW_SECONDS) {
    return Response.json({
      error: 'MIN_REVIEW_TIME_NOT_MET',
      message: `Tiempo mínimo de revisión no cumplido. Faltan ${MIN_REVIEW_SECONDS - elapsedSeconds} segundos.`,
      elapsed_seconds: elapsedSeconds,
      required_seconds: MIN_REVIEW_SECONDS,
    }, { status: 403 });
  }

  // ─── Obtener intento ───────────────────────────────────────────────────────
  const attempts = await base44.asServiceRole.entities.EvaluationAttempt.filter({ id: attempt_id });
  if (!attempts[0]) return Response.json({ error: 'Attempt not found' }, { status: 404 });
  const attempt = attempts[0];

  if (attempt.type !== 'final_exam') {
    return Response.json({ error: 'Solo se pueden revisar exámenes finales' }, { status: 400 });
  }

  // ─── Verificar lock (bloqueo anti-colisión) ────────────────────────────────
  if (attempt.review_locked_by && attempt.review_locked_by !== user.id) {
    const lockedAt = new Date(attempt.review_locked_at);
    const minutesElapsed = (now - lockedAt) / 60000;
    if (minutesElapsed < LOCK_TIMEOUT_MINUTES) {
      return Response.json({
        error: 'ATTEMPT_LOCKED',
        message: `Este intento está siendo revisado por otro docente. Tiempo restante: ${Math.ceil(LOCK_TIMEOUT_MINUTES - minutesElapsed)} minutos.`,
      }, { status: 409 });
    }
    // Lock expirado: continuar y tomar el intento
  }

  const reviewed_at = now.toISOString();
  const decision = passed ? 'approved' : 'rejected';
  const review_duration_seconds = elapsedSeconds;

  // ─── Construir entrada de historial (inmutable) ────────────────────────────
  const historyEntry = {
    reviewer_id: user.id,
    reviewer_name: user.full_name || user.email,
    reviewer_role: user.role,
    decision,
    feedback: feedback || '',
    reviewed_at,
    review_duration_seconds,
  };
  const prevHistory = Array.isArray(attempt.review_history) ? attempt.review_history : [];

  // ─── Actualizar EvaluationAttempt (limpiar lock al finalizar) ─────────────
  await base44.asServiceRole.entities.EvaluationAttempt.update(attempt_id, {
    score,
    passed,
    requires_manual_review: false,
    reviewed_by: user.email,
    reviewer_id: user.id,
    reviewer_name: user.full_name || user.email,
    reviewer_role: user.role,
    review_decision: decision,
    reviewed_at,
    review_started_at,
    review_duration_seconds,
    feedback: feedback || '',
    review_history: [...prevHistory, historyEntry],
    // Limpiar lock
    review_locked_by: null,
    review_locked_at: null,
  });

  // ─── Actualizar LessonProgress ─────────────────────────────────────────────
  const existingLP = await base44.asServiceRole.entities.LessonProgress.filter({
    user_email: attempt.user_email,
    lesson_id: attempt.lesson_id,
  });
  if (existingLP[0]) {
    await base44.asServiceRole.entities.LessonProgress.update(existingLP[0].id, { score, passed });
  }

  // ─── Obtener SubjectProgress ───────────────────────────────────────────────
  const spArr = await base44.asServiceRole.entities.SubjectProgress.filter({
    user_email: attempt.user_email,
    subject_id: attempt.subject_id,
  });
  const sp = spArr[0];

  if (passed) {
    // ✅ APROBADO
    const spUpdate = {
      test_passed: true,
      completed: true,
      final_grade: score,
      last_activity: reviewed_at,
      final_exam_status: 'approved',
    };
    if (sp) {
      await base44.asServiceRole.entities.SubjectProgress.update(sp.id, spUpdate);
    } else {
      await base44.asServiceRole.entities.SubjectProgress.create({
        user_email: attempt.user_email,
        subject_id: attempt.subject_id,
        progress_percent: 100,
        completed: true,
        test_attempts: 1,
        ...spUpdate,
      });
    }

    // Verificar egreso completo
    try {
      const upList = await base44.asServiceRole.entities.UserProgress.filter({ user_email: attempt.user_email });
      const up = upList[0];
      if (up && !up.course_completed_at) {
        const allSubjects = await base44.asServiceRole.entities.Subject.list();
        const planSubjects = allSubjects.filter(s => s.level >= 1 && s.level <= 6);
        const allSP = await base44.asServiceRole.entities.SubjectProgress.filter({ user_email: attempt.user_email });
        const updatedSP = allSP.map(s => s.subject_id === attempt.subject_id ? { ...s, test_passed: true, completed: true } : s);
        const allCompleted = planSubjects.length > 0 && planSubjects.every(sub => {
          const s = updatedSP.find(p => p.subject_id === sub.id);
          return s && s.completed === true && s.test_passed === true;
        });

        if (allCompleted) {
          await base44.asServiceRole.entities.UserProgress.update(up.id, {
            course_completed_at: reviewed_at,
            graduation_status: 'completed',
          });

          try {
            const userInfo = await base44.asServiceRole.entities.User.filter({ email: attempt.user_email });
            const studentUser = userInfo[0] || {};
            const materias = planSubjects.map(sub => {
              const s = updatedSP.find(p => p.subject_id === sub.id);
              return {
                subject_id: sub.id, subject_name: sub.name, level: sub.level,
                final_grade: s?.final_grade || 0, test_passed: s?.test_passed === true,
                completed_at: s?.last_activity || reviewed_at,
              };
            });
            const grades = materias.filter(m => m.final_grade > 0).map(m => m.final_grade);
            const promedio_final = grades.length > 0
              ? Math.round((grades.reduce((s, g) => s + g, 0) / grades.length) * 100) / 100 : 0;
            const snapshotContent = {
              user_email: attempt.user_email, full_name: studentUser.full_name || '',
              curp: studentUser.curp || null, fecha_inscripcion: studentUser.created_date || null,
              course_completed_at: reviewed_at, promedio_final,
              total_subjects: planSubjects.length,
              subjects_completed: materias.filter(m => m.test_passed).length,
              materias, version: '1.0',
            };
            const encoder = new TextEncoder();
            const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(snapshotContent)));
            const snapshot_hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            await base44.asServiceRole.entities.AcademicRecordSnapshot.create({
              ...snapshotContent, integrity_verified: true, generated_by: 'system', snapshot_hash,
            });
            console.log('AcademicRecordSnapshot CREATED for', attempt.user_email);
          } catch (snapErr) {
            console.error('Snapshot error:', snapErr.message);
          }
        }
      }
    } catch (e) {
      console.error('checkCourseCompletion error:', e.message);
    }

  } else {
    // ❌ RECHAZADO: incrementar test_attempts y evaluar bloqueo
    const currentAttempts = (sp?.test_attempts || 0) + 1;
    const isBlocked = currentAttempts >= 3 && !(sp?.final_exam_unlocked);
    const spUpdate = {
      final_grade: score,
      last_activity: reviewed_at,
      test_attempts: currentAttempts,
      final_exam_status: isBlocked ? 'blocked' : 'rejected',
    };
    if (sp) {
      await base44.asServiceRole.entities.SubjectProgress.update(sp.id, spUpdate);
    } else {
      await base44.asServiceRole.entities.SubjectProgress.create({
        user_email: attempt.user_email, subject_id: attempt.subject_id,
        progress_percent: 0, completed: false, ...spUpdate,
      });
    }
    console.log(`Rechazo: intentos=${currentAttempts}, bloqueado=${isBlocked}`, { attempt_id, student: attempt.user_email });
  }

  console.log('reviewEvaluationAttempt', { attempt_id, decision, reviewer: user.email, reviewer_id: user.id, student: attempt.user_email, review_duration_seconds });

  return Response.json({
    status: 'ok',
    attempt_id, score, passed, decision,
    reviewed_by: user.email, reviewer_id: user.id,
    reviewer_name: user.full_name || user.email,
    reviewer_role: user.role, reviewed_at, review_duration_seconds,
  });
});