import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── NORMALIZACIÓN ────────────────────────────────────────────────────────────
function normalizeAnswer(answer) {
  if (answer === null || answer === undefined) return '';
  return String(answer).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─── GRADEAR UNA RESPUESTA ────────────────────────────────────────────────────
function gradeAnswer(activity, user_answer) {
  const gradingType = activity.grading_type || 'auto';
  const points = activity.points || 10;

  if (gradingType === 'manual' || activity.requires_manual_review) {
    return { correct: null, points_obtained: 0, requires_review: true };
  }

  const correctMain = activity.correct_answer;
  const acceptedList = activity.accepted_answers || [];
  const allValid = [correctMain, ...acceptedList].map(a => normalizeAnswer(a));
  const userNorm = normalizeAnswer(user_answer);

  const tolerance = activity.tolerance || 0;
  if (tolerance > 0) {
    const userNum = parseFloat(userNorm.replace(',', '.'));
    const correctNum = parseFloat(normalizeAnswer(correctMain).replace(',', '.'));
    if (!isNaN(userNum) && !isNaN(correctNum)) {
      const isCorrect = Math.abs(userNum - correctNum) <= tolerance;
      return { correct: isCorrect, points_obtained: isCorrect ? points : 0, requires_review: false };
    }
  }

  const isCorrect = allValid.includes(userNorm);
  const requiresReview = gradingType === 'hybrid';
  return { correct: isCorrect, points_obtained: isCorrect ? points : 0, requires_review: requiresReview };
}

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
   lesson_id,
   subject_id,
   type = 'lesson',   // 'lesson' | 'mini_eval' | 'final_exam' | 'surprise_exam'
   answers = [],
   started_at,
   exam_started_at,  // Nuevo: timestamp real cuando alumno inicia examen
   session_token,
  } = body;

  // Ignorar score/correct_answers del frontend — nunca confiar
  if (!lesson_id || !subject_id) {
    return Response.json({ error: 'lesson_id and subject_id are required' }, { status: 400 });
  }
  if (!Array.isArray(answers) || answers.length === 0) {
    return Response.json({ error: 'answers array is required' }, { status: 400 });
  }

  const user_email = user.email;
  const submitted_at = new Date().toISOString();

  // ─── 0.A VALIDACIÓN DE TOKEN PRESENCIAL (solo final_exam) ───────────────────
  let tokenRecord = null;
  if (type === 'final_exam') {
    if (!session_token) {
      return Response.json({
        error: 'PRESENTIAL_TOKEN_REQUIRED',
        message: 'El examen final requiere un código de acceso presencial generado por el docente.',
        is_blocked: true,
      }, { status: 403 });
    }

    // Buscar el token por session_token
    const tokenRecords = await base44.asServiceRole.entities.PresentialExamToken.filter({
      session_token,
    });

    if (tokenRecords.length === 0) {
      return Response.json({
        error: 'INVALID_SESSION_TOKEN',
        message: 'Sesión de examen no válida. Solicita un nuevo código al docente.',
        is_blocked: true,
      }, { status: 403 });
    }

    tokenRecord = tokenRecords[0];
    
    // Validar expiración de session_token
    if (new Date() > new Date(tokenRecord.session_expires_at)) {
      return Response.json({
        error: 'SESSION_TOKEN_EXPIRED',
        message: 'Tu sesión de examen ha expirado. Solicita un nuevo código.',
        is_blocked: true,
      }, { status: 403 });
    }

    // ✅ VALIDACIÓN 1: Verificar que la materia coincida
    if (tokenRecord.subject_id && tokenRecord.subject_id !== subject_id) {
      return Response.json({
        error: 'INVALID_SUBJECT_FOR_TOKEN',
        message: 'Este código de examen no es válido para esta materia.',
        is_blocked: true,
      }, { status: 403 });
    }

    // ✅ VALIDACIÓN 2: Evitar reutilización indirecta del token
    // Buscar intentos COMPLETADOS (submitted) con este MISMO token
    const prevAttempts = await base44.asServiceRole.entities.EvaluationAttempt.filter({
      user_email,
      subject_id,
      presential_token_id: tokenRecord.id,
    });
    // Si hay un intento previo aprobado O que fue enviado: BLOQUEAR
    if (prevAttempts.length > 0) {
      const prevApprovedOrSubmitted = prevAttempts.some(a => a.passed === true || a.submitted_at);
      if (prevApprovedOrSubmitted) {
        return Response.json({
          error: 'FINAL_EXAM_ALREADY_SUBMITTED_WITH_TOKEN',
          message: 'Ya has enviado un examen con este código. Solicita uno nuevo al docente.',
          is_blocked: true,
        }, { status: 403 });
      }
    }
  }

  // ─── 0. BLOQUEO GLOBAL POST-EGRESO ─────────────────────────────────────────
  const upCheck = await base44.asServiceRole.entities.UserProgress.filter({ user_email });
  if (upCheck[0]?.graduation_status === 'completed' || upCheck[0]?.graduation_status === 'certified') {
    return Response.json({
      error: 'GRADUATION_LOCKED',
      message: 'El alumno ya egresó. No se permiten más evaluaciones.',
      is_blocked: true,
    }, { status: 403 });
  }

  // ─── 1. CONTROL DE INTENTOS POR TIPO ────────────────────────────────────────
  const existingAttempts = await base44.asServiceRole.entities.EvaluationAttempt.filter({
    user_email, lesson_id,
  });
  const attempt_number = existingAttempts.length + 1;

  // final_exam: máximo 3 intentos → BLOQUEO DURO, requiere folio extraordinario
  if (type === 'final_exam') {
    const spArr = await base44.asServiceRole.entities.SubjectProgress.filter({ user_email, subject_id });
    const sp = spArr[0];
    const testAttempts = sp?.test_attempts || 0;
    const testPassed = sp?.test_passed || false;
    const finalExamUnlocked = sp?.final_exam_unlocked || false;

    if (!testPassed && testAttempts >= 3 && !finalExamUnlocked) {
      return Response.json({
        error: 'FINAL_EXAM_BLOCKED',
        message: 'Has agotado los 3 intentos. Necesitas un folio extraordinario para continuar.',
        is_blocked: true,
      }, { status: 403 });
    }
  }

  // ─── 2. OBTENER ACTIVIDADES DE LA LECCIÓN ────────────────────────────────────
  const activities = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id });
  if (activities.length === 0) {
    return Response.json({ error: 'No activities found for this lesson' }, { status: 404 });
  }

  // ─── 3. GRADEAR CADA RESPUESTA EN BACKEND ────────────────────────────────────
  let correct_count = 0;
  let total_gradeable = 0;
  let requires_any_manual_review = false;
  let total_points = 0;
  let earned_points = 0;

  const gradedAnswers = answers.map(({ question_id, user_answer }) => {
    const activity = activities.find(a => a.id === question_id);
    if (!activity) {
      return { question_id, user_answer, correct: false, points_obtained: 0 };
    }
    const { correct, points_obtained, requires_review } = gradeAnswer(activity, user_answer);
    if (requires_review) requires_any_manual_review = true;
    const actPoints = activity.points || 10;
    total_points += actPoints;
    earned_points += points_obtained;
    if (correct === true) correct_count++;
    if (correct !== null) total_gradeable++;
    return { question_id, user_answer, correct, points_obtained };
  });

  // ─── 4. CALCULAR SCORE (servidor es fuente de verdad) ────────────────────────
  const total_questions = gradedAnswers.length;
  const score = total_points > 0
    ? Math.round((earned_points / total_points) * 100)
    : (total_gradeable > 0 ? Math.round((correct_count / total_gradeable) * 100) : 0);

  // ─── LÓGICA CRÍTICA: final_exam SIEMPRE requiere revisión docente ─────────────
  // El docente aprueba/rechaza manualmente — nunca automático
  const isFinalExam = type === 'final_exam';
  const passThreshold = type === 'final_exam' ? 70 : 80;
  
  let passed;
  let requiresManualReview;

  if (isFinalExam) {
    // Examen final: SIEMPRE pendiente de revisión docente
    passed = null;
    requiresManualReview = true;
  } else {
    // Lecciones y mini-evals: aprobación automática normal
    passed = requires_any_manual_review ? null : score >= passThreshold;
    requiresManualReview = requires_any_manual_review;
  }

  // ─── 5. GUARDAR EvaluationAttempt (registro auditable) ──────────────────────
  console.log("EvaluationAttempt CREATED", { user_email, lesson_id, type, score, requiresManualReview });

  // ✅ Preparar datos de auditoría presencial si aplica (final_exam)
  let auditData = {};
  let duration_seconds = null;

  if (isFinalExam && tokenRecord) {
   // NUEVO: Calcular duración real del examen
   if (exam_started_at && submitted_at) {
     duration_seconds = Math.round((new Date(submitted_at).getTime() - new Date(exam_started_at).getTime()) / 1000);
   }

   auditData = {
     presential_token_id: tokenRecord.id,
     token_code: tokenRecord.token_code,
     validated_by: tokenRecord.created_by,
     validated_by_name: tokenRecord.created_by_name,
     validation_method: 'token',
     token_validated_at: tokenRecord.validated_at || new Date().toISOString(),
     exam_started_at: exam_started_at || submitted_at,  // Nuevo: registro real de inicio
     duration_seconds,  // Nuevo: duración calculada
     ip_address: tokenRecord.ip_address || null,  // Nuevo: auditoría soft
     device_info: tokenRecord.device_info || null,  // Nuevo: auditoría soft
   };
  }

  const attemptRecord = await base44.asServiceRole.entities.EvaluationAttempt.create({
    user_email,
    subject_id,
    lesson_id,
    type,
    answers: gradedAnswers,
    score,
    passed,
    started_at: started_at || submitted_at,
    submitted_at,
    attempt_number,
    requires_manual_review: requiresManualReview,
    ...auditData,
  });

  // ─── 6. ACTUALIZAR LessonProgress (resumen UI) ────────────────────────────────
  const existingLP = await base44.asServiceRole.entities.LessonProgress.filter({ user_email, lesson_id });
  const lessonProgressData = {
    user_email, lesson_id, subject_id, score,
    passed: passed === true, correct_answers: correct_count,
    total_questions, completed: true, completed_at: submitted_at,
  };

  if (existingLP[0]) {
    await base44.asServiceRole.entities.LessonProgress.update(existingLP[0].id, lessonProgressData);
  } else {
    const lessons = await base44.asServiceRole.entities.CourseLesson.filter({ id: lesson_id });
    const module_id = lessons[0]?.module_id || '';
    await base44.asServiceRole.entities.LessonProgress.create({ ...lessonProgressData, module_id });
  }

  // ─── 7. RECALCULAR progress_percent (solo para lecciones/mini-eval, NO final_exam) ─
  if (!isFinalExam) {
    const [allLessons, completedLessons] = await Promise.all([
      base44.asServiceRole.entities.CourseLesson.filter({ subject_id }),
      base44.asServiceRole.entities.LessonProgress.filter({ user_email, subject_id, completed: true }),
    ]);
    const totalCount = allLessons.filter(l => !l.is_mini_eval).length;
    if (totalCount > 0) {
      const completedCount = completedLessons.filter(lp => {
        const lesson = allLessons.find(l => l.id === lp.lesson_id);
        return lesson && !lesson.is_mini_eval;
      }).length;
      const progress_percent = Math.round((completedCount / totalCount) * 100);

      const spFresh = await base44.asServiceRole.entities.SubjectProgress.filter({ user_email, subject_id });
      if (spFresh[0]) {
        await base44.asServiceRole.entities.SubjectProgress.update(spFresh[0].id, {
          progress_percent,
          last_activity: submitted_at,
        });
      } else {
        await base44.asServiceRole.entities.SubjectProgress.create({
          user_email, subject_id, progress_percent,
          completed: false, last_activity: submitted_at,
        });
      }
    }
  }

  // ─── 8. ACTUALIZAR SubjectProgress según tipo ─────────────────────────────────
  const spArr = await base44.asServiceRole.entities.SubjectProgress.filter({ user_email, subject_id });
  const sp = spArr[0];

  if (isFinalExam) {
    // ⚠️ CRÍTICO: final_exam NO actualiza test_passed ni completed
    // Eso lo hace reviewEvaluationAttempt cuando el docente aprueba
    // test_attempts se controla SOLO desde backend (no confiar en frontend)
    const currentAttempts = sp?.test_attempts || 0;
    const newTestAttempts = currentAttempts + 1;
    const spUpdate = {
      test_attempts: newTestAttempts,
      final_grade: score,
      last_activity: submitted_at,
      final_exam_unlocked: false, // consumir unlock tras cada intento
      final_exam_status: 'pending_review',
      // test_passed y completed NO se tocan — el docente decide
    };

    if (sp) {
      await base44.asServiceRole.entities.SubjectProgress.update(sp.id, spUpdate);
    } else {
      await base44.asServiceRole.entities.SubjectProgress.create({
        user_email, subject_id, progress_percent: 0, completed: false, ...spUpdate,
      });
    }

    // ✅ CONSUMIR TOKEN: Marcar como usado SOLO cuando el examen es enviado
     if (tokenRecord) {
       await base44.asServiceRole.entities.PresentialExamToken.update(tokenRecord.id, {
         used: true,
         used_by: user_email,
         used_by_name: user.full_name,
         used_at: submitted_at,
         session_status: 'completed',  // Marcar sesión como completada
       });
       console.log('TOKEN CONSUMED', {
         token_code: tokenRecord.token_code,
         used_by: user_email,
         exam_duration: duration_seconds,
         attempt_id: attemptRecord.id,
       });
     }
  } else if (type === 'mini_eval') {
    // Señal de refuerzo
    const failedMiniEvals = existingAttempts.filter(a => a.type === 'mini_eval' && a.passed === false);
    const requiresReinforcement = !passed && failedMiniEvals.length >= 2;

    if (requiresReinforcement && sp) {
      const miniUpdate = { requires_reinforcement: true, last_activity: submitted_at };
      const lessonArr = await base44.asServiceRole.entities.CourseLesson.filter({ id: lesson_id });
      if (lessonArr[0]?.title) {
        const prevErrors = sp.errors_noted || [];
        if (!prevErrors.includes(lessonArr[0].title)) {
          miniUpdate.errors_noted = [...prevErrors, lessonArr[0].title];
        }
      }
      await base44.asServiceRole.entities.SubjectProgress.update(sp.id, miniUpdate);
    }
  }

  // ─── 9. VERIFICACIÓN DE FINALIZACIÓN DE CURSO (solo si aprobación automática) ─
  // Para final_exam esto se maneja en reviewEvaluationAttempt
  if (!isFinalExam && passed === true) {
    // No aplica para final_exam — se delega al flujo de revisión docente
  }

  // ─── 10. RESPUESTA ────────────────────────────────────────────────────────────
  return Response.json({
    status: 'ok',
    attempt_id: attemptRecord.id,
    attempt_number,
    score,
    passed,
    correct_answers: correct_count,
    total_questions,
    requires_manual_review: requiresManualReview,
    pending_teacher_review: isFinalExam,  // flag explícito para UI del alumno
    graded_answers: gradedAnswers,
    calculated_score: score,
  });
});