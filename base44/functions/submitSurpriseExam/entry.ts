import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Este endpoint SOLO evalúa las respuestas y devuelve el score.
// La actualización de gamificación (XP, water, streak, logros) la maneja handleUserEvent
// con event_type: "surprise_exam_completed".
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { question_ids, answers } = body;
  if (!question_ids?.length || !answers?.length) {
    return Response.json({ error: 'question_ids and answers are required' }, { status: 400 });
  }

  // Validar que no haya completado el desafío hoy
  const today = new Date().toISOString().split('T')[0];
  const existing = await base44.asServiceRole.entities.SurpriseExamAttempt.filter({ user_email: user.email, date: today });
  if (existing.length > 0) {
    return Response.json({ error: 'already_completed_today', message: 'Ya completaste el desafío de hoy' }, { status: 400 });
  }

  const results = [];
  let correctCount = 0;

  for (let i = 0; i < question_ids.length; i++) {
    const acts = await base44.asServiceRole.entities.CourseActivity.filter({ id: question_ids[i] });
    const activity = acts[0];
    if (!activity) continue;

    const normalize = (s) => s?.toString().toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';

    const userAnswer = normalize(answers[i] || '');
    const correct = normalize(activity.correct_answer);
    const isCorrect = userAnswer === correct ||
      normalize(userAnswer.replace(/^[a-d]\)\s*/i, '')) === normalize(correct.replace(/^[a-d]\)\s*/i, ''));

    if (isCorrect) correctCount++;
    results.push({ question_id: question_ids[i], is_correct: isCorrect, correct_answer: activity.correct_answer });
  }

  const score = Math.round((correctCount / question_ids.length) * 100);
  const waterEarned = Math.floor(score / 20); // 0-5 tokens según puntaje
  const xpEarned = Math.round(score * 0.5);   // se informa al frontend para mostrar en UI

  // Guardar intento del día
  await base44.asServiceRole.entities.SurpriseExamAttempt.create({
    user_email: user.email,
    date: today,
    score,
    xp_earned: xpEarned,
    created_at: new Date().toISOString(),
  });

  return Response.json({
    score,
    correct_count: correctCount,
    total: question_ids.length,
    water_earned: waterEarned,
    xp_earned: xpEarned,
    results,
  });
});