import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── NORMALIZACIÓN DE RESPUESTAS TEXTO ──────────────────────────────────────
function normalizeAnswer(answer) {
  if (answer === null || answer === undefined) return '';
  return String(answer).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quitar tildes
}

// ─── GRADEAR UNA RESPUESTA ────────────────────────────────────────────────────
function gradeAnswer(activity, user_answer) {
  const gradingType = activity.grading_type || 'auto';
  const points = activity.points || 10;

  // Manual → no se puede calificar automáticamente
  if (gradingType === 'manual' || activity.requires_manual_review) {
    return { correct: null, points_obtained: 0, requires_review: true };
  }

  const correctMain = activity.correct_answer;
  const acceptedList = activity.accepted_answers || [];
  const allValid = [correctMain, ...acceptedList].map(a => normalizeAnswer(a));
  const userNorm = normalizeAnswer(user_answer);

  // Para respuestas numéricas con tolerancia
  const tolerance = activity.tolerance || 0;
  if (tolerance > 0) {
    const userNum = parseFloat(userNorm.replace(',', '.'));
    const correctNum = parseFloat(normalizeAnswer(correctMain).replace(',', '.'));
    if (!isNaN(userNum) && !isNaN(correctNum)) {
      const isCorrect = Math.abs(userNum - correctNum) <= tolerance;
      return { correct: isCorrect, points_obtained: isCorrect ? points : 0, requires_review: false };
    }
  }

  // Comparación directa normalizada
  const isCorrect = allValid.includes(userNorm);

  // hybrid → marca para revisión aunque sea correcto automáticamente
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
    type = 'lesson',      // 'lesson' | 'mini_eval' | 'final_exam' | 'surprise_exam'
    answers = [],         // [{ question_id, user_answer }]
    started_at,
  } = body;

  if (!lesson_id || !subject_id) {
    return Response.json({ error: 'lesson_id and subject_id are required' }, { status: 400 });
  }
  if (!Array.isArray(answers) || answers.length === 0) {
    return Response.json({ error: 'answers array is required' }, { status: 400 });
  }

  const user_email = user.email;
  const submitted_at = new Date().toISOString();

  // ─── 1. OBTENER ACTIVIDADES DE LA LECCIÓN ────────────────────────────────
  const activities = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id });
  if (activities.length === 0) {
    return Response.json({ error: 'No activities found for this lesson' }, { status: 404 });
  }

  // ─── 2. GRADEAR CADA RESPUESTA EN BACKEND ────────────────────────────────
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

  // ─── 3. CALCULAR SCORE ───────────────────────────────────────────────────
  const total_questions = gradedAnswers.length;
  // Score basado en puntos si hay distintos valores, sino en conteo
  const score = total_points > 0
    ? Math.round((earned_points / total_points) * 100)
    : (total_gradeable > 0 ? Math.round((correct_count / total_gradeable) * 100) : 0);

  const passed = requires_any_manual_review ? null : score >= 80;

  // ─── 4. NÚMERO DE INTENTO ────────────────────────────────────────────────
  const existingAttempts = await base44.asServiceRole.entities.EvaluationAttempt.filter({
    user_email, lesson_id,
  });
  const attempt_number = existingAttempts.length + 1;

  // ─── 5. GUARDAR EvaluationAttempt ────────────────────────────────────────
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
    requires_manual_review: requires_any_manual_review,
  });

  // ─── 6. ACTUALIZAR LessonProgress (resumen, para no romper UI actual) ────
  const existingLP = await base44.asServiceRole.entities.LessonProgress.filter({
    user_email, lesson_id,
  });

  const lessonProgressData = {
    user_email,
    lesson_id,
    subject_id,
    score,
    passed: passed === true,
    correct_answers: correct_count,
    total_questions,
    completed: true,
    completed_at: submitted_at,
  };

  if (existingLP[0]) {
    await base44.asServiceRole.entities.LessonProgress.update(existingLP[0].id, lessonProgressData);
  } else {
    // Obtener module_id desde la lección
    const lessons = await base44.asServiceRole.entities.CourseLesson.filter({ id: lesson_id });
    const module_id = lessons[0]?.module_id || '';
    await base44.asServiceRole.entities.LessonProgress.create({ ...lessonProgressData, module_id });
  }

  // ─── 7. ACTUALIZAR SubjectProgress.progress_percent ─────────────────────
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

    const existingSP = await base44.asServiceRole.entities.SubjectProgress.filter({ user_email, subject_id });
    if (existingSP[0]) {
      await base44.asServiceRole.entities.SubjectProgress.update(existingSP[0].id, {
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

  // ─── 8. RESPUESTA ────────────────────────────────────────────────────────
  return Response.json({
    status: 'ok',
    attempt_id: attemptRecord.id,
    attempt_number,
    score,
    passed,
    correct_answers: correct_count,
    total_questions,
    requires_manual_review: requires_any_manual_review,
    graded_answers: gradedAnswers,
  });
});