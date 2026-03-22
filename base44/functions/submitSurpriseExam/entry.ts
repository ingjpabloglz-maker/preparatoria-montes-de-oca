import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { question_ids, answers } = await req.json();
  if (!question_ids?.length || !answers?.length) {
    return Response.json({ error: 'question_ids and answers are required' }, { status: 400 });
  }

  const user_email = user.email;
  const today = new Date().toISOString().split('T')[0];

  // Obtener respuestas correctas
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
  const xpEarned = Math.round(score * 0.5);

  // Actualizar GamificationProfile
  const gamArr = await base44.asServiceRole.entities.GamificationProfile.filter({ user_email });
  const gam = gamArr[0];

  if (gam) {
    let updatedIds = [...(gam.answered_surprise_questions_ids || []), ...question_ids];
    if (updatedIds.length > 100) updatedIds = updatedIds.slice(-100);

    await base44.asServiceRole.entities.GamificationProfile.update(gam.id, {
      last_surprise_exam_date_normalized: today,
      answered_surprise_questions_ids: updatedIds,
      water_tokens: (gam.water_tokens || 0) + waterEarned,
      xp_points: (gam.xp_points || 0) + xpEarned,
    });
  }

  // Disparar logros de surprise_exam_completed
  const allAchievements = await base44.asServiceRole.entities.Achievement.filter({ condition_key: 'surprise_exam_completed' });
  const userAchs = await base44.asServiceRole.entities.UserAchievement.filter({ user_email });
  const unlockedIds = userAchs.filter(u => u.is_unlocked).map(u => u.achievement_id);
  const nowIso = new Date().toISOString();
  const newlyUnlocked = [];

  for (const ach of allAchievements) {
    if (unlockedIds.includes(ach.id)) continue;
    const existing_ua = userAchs.find(u => u.achievement_id === ach.id);
    const currentProgress = (existing_ua?.progress_current || 0) + 1;
    const target = ach.condition_value || 1;
    const shouldUnlock = currentProgress >= target;

    if (existing_ua) {
      await base44.asServiceRole.entities.UserAchievement.update(existing_ua.id, {
        progress_current: currentProgress,
        progress_target: target,
        is_unlocked: shouldUnlock,
        unlocked_date: shouldUnlock ? nowIso : existing_ua.unlocked_date,
      });
    } else {
      await base44.asServiceRole.entities.UserAchievement.create({
        user_email,
        achievement_id: ach.id,
        progress_current: currentProgress,
        progress_target: target,
        is_unlocked: shouldUnlock,
        unlocked_date: shouldUnlock ? nowIso : undefined,
      });
    }
    if (shouldUnlock) newlyUnlocked.push({ name: ach.name, icon_name: ach.icon_name, rarity: ach.rarity });
  }

  return Response.json({
    score,
    correct_count: correctCount,
    total: question_ids.length,
    water_earned: waterEarned,
    xp_earned: xpEarned,
    results,
  });
});