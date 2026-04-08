import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Endpoint para que docentes revisen intentos de examen final manualmente
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Solo docentes y admins pueden revisar
  const allowedRoles = ['admin', 'docente'];
  if (!allowedRoles.includes(user.role)) {
    return Response.json({ error: 'Forbidden: exam.review permission required' }, { status: 403 });
  }

  const body = await req.json();
  const { attempt_id, score, passed, feedback } = body;

  if (!attempt_id || score === undefined || passed === undefined) {
    return Response.json({ error: 'attempt_id, score and passed are required' }, { status: 400 });
  }
  if (score < 0 || score > 100) {
    return Response.json({ error: 'score must be between 0 and 100' }, { status: 400 });
  }

  const reviewed_at = new Date().toISOString();
  const decision = passed ? 'approved' : 'rejected';

  // Obtener intento
  const attempts = await base44.asServiceRole.entities.EvaluationAttempt.filter({ id: attempt_id });
  if (!attempts[0]) {
    return Response.json({ error: 'Attempt not found' }, { status: 404 });
  }
  const attempt = attempts[0];

  // Solo se pueden revisar exámenes finales
  if (attempt.type !== 'final_exam') {
    return Response.json({ error: 'Solo se pueden revisar exámenes finales' }, { status: 400 });
  }

  // Guardar revisión con datos completos del docente
  await base44.asServiceRole.entities.EvaluationAttempt.update(attempt_id, {
    score,
    passed,
    requires_manual_review: false,
    reviewed_by: user.email,
    reviewed_at,
    feedback: feedback || '',
    // Campos adicionales de auditoría de revisión docente
    review_decision: decision,
    reviewer_name: user.full_name || user.email,
  });

  // Actualizar LessonProgress
  const existingLP = await base44.asServiceRole.entities.LessonProgress.filter({
    user_email: attempt.user_email,
    lesson_id: attempt.lesson_id,
  });
  if (existingLP[0]) {
    await base44.asServiceRole.entities.LessonProgress.update(existingLP[0].id, { score, passed });
  }

  // ─── ACTUALIZAR SubjectProgress según decisión docente ────────────────────
  const spArr = await base44.asServiceRole.entities.SubjectProgress.filter({
    user_email: attempt.user_email,
    subject_id: attempt.subject_id,
  });
  const sp = spArr[0];

  if (passed) {
    // ✅ APROBADO: desbloquear avance del alumno
    const spUpdate = {
      test_passed: true,
      completed: true,
      final_grade: score,
      last_activity: reviewed_at,
    };
    if (sp) {
      await base44.asServiceRole.entities.SubjectProgress.update(sp.id, spUpdate);
    } else {
      await base44.asServiceRole.entities.SubjectProgress.create({
        user_email: attempt.user_email,
        subject_id: attempt.subject_id,
        progress_percent: 100,
        completed: true,
        ...spUpdate,
      });
    }

    // Verificar si el alumno completó todo el curso
    try {
      const upList = await base44.asServiceRole.entities.UserProgress.filter({ user_email: attempt.user_email });
      const up = upList[0];
      if (up && !up.course_completed_at) {
        const allSubjects = await base44.asServiceRole.entities.Subject.list();
        const planSubjects = allSubjects.filter(s => s.level >= 1 && s.level <= 6);
        const allSP = await base44.asServiceRole.entities.SubjectProgress.filter({ user_email: attempt.user_email });
        
        // Incluir la materia recién aprobada en la verificación
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

          // Crear snapshot inmutable del expediente académico
          try {
            const userInfo = await base44.asServiceRole.entities.User.filter({ email: attempt.user_email });
            const studentUser = userInfo[0] || {};
            const materias = planSubjects.map(sub => {
              const s = updatedSP.find(p => p.subject_id === sub.id);
              return {
                subject_id: sub.id,
                subject_name: sub.name,
                level: sub.level,
                final_grade: s?.final_grade || 0,
                test_passed: s?.test_passed === true,
                completed_at: s?.last_activity || reviewed_at,
              };
            });
            const grades = materias.filter(m => m.final_grade > 0).map(m => m.final_grade);
            const promedio_final = grades.length > 0
              ? Math.round((grades.reduce((s, g) => s + g, 0) / grades.length) * 100) / 100
              : 0;
            const snapshotContent = {
              user_email: attempt.user_email,
              full_name: studentUser.full_name || '',
              curp: studentUser.curp || null,
              fecha_inscripcion: studentUser.created_date || null,
              course_completed_at: reviewed_at,
              promedio_final,
              total_subjects: planSubjects.length,
              subjects_completed: materias.filter(m => m.test_passed).length,
              materias,
              version: '1.0',
            };
            const hashContent = JSON.stringify(snapshotContent);
            const encoder = new TextEncoder();
            const data = encoder.encode(hashContent);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const snapshot_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            await base44.asServiceRole.entities.AcademicRecordSnapshot.create({
              ...snapshotContent,
              integrity_verified: true,
              generated_by: 'system',
              snapshot_hash,
            });
            console.log('AcademicRecordSnapshot CREATED for', attempt.user_email);
          } catch (snapErr) {
            console.error('Snapshot creation error:', snapErr.message);
          }
        }
      }
    } catch (e) {
      console.error('checkCourseCompletion error:', e.message);
    }
  } else {
    // ❌ RECHAZADO: incrementar intentos, no desbloquear
    if (sp) {
      await base44.asServiceRole.entities.SubjectProgress.update(sp.id, {
        final_grade: score,
        last_activity: reviewed_at,
      });
    }
  }

  console.log('reviewEvaluationAttempt', { attempt_id, decision, reviewer: user.email, student: attempt.user_email });

  return Response.json({
    status: 'ok',
    attempt_id,
    score,
    passed,
    decision,
    reviewed_by: user.email,
    reviewer_name: user.full_name || user.email,
    reviewed_at,
  });
});