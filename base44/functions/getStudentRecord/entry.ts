import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin' && user.role !== 'teacher') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { user_email } = body;
  if (!user_email) return Response.json({ error: 'user_email required' }, { status: 400 });

  // Fetch all data in parallel
  const [
    allUsers,
    userProgressList,
    subjectProgressList,
    evaluationAttempts,
    subjects,
    lessons,
    modules,
    units,
  ] = await Promise.all([
    base44.asServiceRole.entities.User.list(),
    base44.asServiceRole.entities.UserProgress.filter({ user_email }),
    base44.asServiceRole.entities.SubjectProgress.filter({ user_email }),
    base44.asServiceRole.entities.EvaluationAttempt.filter({ user_email }, '-submitted_at', 1000),
    base44.asServiceRole.entities.Subject.list(),
    base44.asServiceRole.entities.CourseLesson.list(),
    base44.asServiceRole.entities.CourseModule.list(),
    base44.asServiceRole.entities.CourseUnit.list(),
  ]);

  // Student info
  const studentUser = allUsers.find(u => u.email === user_email);
  if (!studentUser) return Response.json({ error: 'Student not found' }, { status: 404 });

  const apellidoP = studentUser.apellido_paterno || '';
  const apellidoM = studentUser.apellido_materno || '';
  const nombres = studentUser.nombres || '';
  const nameParts = [apellidoP, apellidoM, nombres].filter(Boolean);
  const full_name = nameParts.length > 0 ? nameParts.join(' ') : (studentUser.full_name || studentUser.email);

  const userProgress = userProgressList[0] || {};

  // Build lookup maps
  const subjectMap = {};
  for (const s of subjects) subjectMap[s.id] = s;

  const lessonMap = {};
  for (const l of lessons) lessonMap[l.id] = l;

  const moduleMap = {};
  for (const m of modules) moduleMap[m.id] = m;

  const unitMap = {};
  for (const u of units) unitMap[u.id] = u;

  // SubjectProgress map
  const subjectProgressMap = {};
  for (const sp of subjectProgressList) subjectProgressMap[sp.subject_id] = sp;

  // Group attempts by subject
  const attemptsBySubject = {};
  for (const a of evaluationAttempts) {
    if (!attemptsBySubject[a.subject_id]) attemptsBySubject[a.subject_id] = [];
    const lesson = lessonMap[a.lesson_id] || {};
    const mod = moduleMap[lesson.module_id] || {};
    const unit = unitMap[mod.unit_id] || {};
    attemptsBySubject[a.subject_id].push({
      ...a,
      lesson_title: lesson.title || null,
      module_title: mod.title || null,
      unit_title: unit.title || null,
      subject_title: subjectMap[a.subject_id]?.name || a.subject_id,
    });
  }

  // Build subjects array with nested structure
  const subjectsResult = subjects.map(sub => {
    const sp = subjectProgressMap[sub.id];
    if (!sp && !attemptsBySubject[sub.id]) return null;

    const subAttempts = attemptsBySubject[sub.id] || [];

    // Group by module
    const moduleGroups = {};
    for (const a of subAttempts) {
      const lesson = lessonMap[a.lesson_id] || {};
      const modId = lesson.module_id;
      if (!modId) continue;
      if (!moduleGroups[modId]) {
        const mod = moduleMap[modId] || {};
        const unit = unitMap[mod.unit_id] || {};
        moduleGroups[modId] = {
          module_id: modId,
          module_title: mod.title || modId,
          unit_title: unit.title || null,
          lessons: {},
        };
      }
      const lessonId = a.lesson_id;
      if (!moduleGroups[modId].lessons[lessonId]) {
        moduleGroups[modId].lessons[lessonId] = {
          lesson_id: lessonId,
          lesson_title: lessonMap[lessonId]?.title || lessonId,
          is_mini_eval: lessonMap[lessonId]?.is_mini_eval || false,
          attempts: [],
        };
      }
      moduleGroups[modId].lessons[lessonId].attempts.push(a);
    }

    // Convert to arrays
    const modulesArr = Object.values(moduleGroups).map(m => ({
      ...m,
      lessons: Object.values(m.lessons),
    }));

    return {
      subject_id: sub.id,
      subject_title: sub.name,
      progress: sp?.progress_percent ?? 0,
      final_grade: sp?.final_grade ?? null,
      test_passed: sp?.test_passed ?? false,
      test_attempts: sp?.test_attempts ?? 0,
      completed: sp?.completed ?? false,
      requires_reinforcement: sp?.requires_reinforcement ?? false,
      last_activity: sp?.last_activity ?? null,
      modules: modulesArr,
      attempts_count: subAttempts.length,
    };
  }).filter(Boolean);

  // Summary
  const completedSubjects = subjectsResult.filter(s => s.completed).length;
  const gradesWithValue = subjectsResult.filter(s => s.final_grade !== null).map(s => s.final_grade);
  const average_grade = gradesWithValue.length > 0
    ? Math.round(gradesWithValue.reduce((a, b) => a + b, 0) / gradesWithValue.length * 10) / 10
    : null;

  const allDates = evaluationAttempts.map(a => a.submitted_at).filter(Boolean).sort().reverse();
  const last_activity = allDates[0] || null;

  // Full evaluation history (enriched, for the history tab)
  const evaluation_history = evaluationAttempts.map(a => {
    const lesson = lessonMap[a.lesson_id] || {};
    const mod = moduleMap[lesson.module_id] || {};
    const unit = unitMap[mod.unit_id] || {};
    return {
      ...a,
      lesson_title: lesson.title || null,
      module_title: mod.title || null,
      unit_title: unit.title || null,
      subject_title: subjectMap[a.subject_id]?.name || a.subject_id,
    };
  });

  return Response.json({
    status: 'ok',
    student: {
      full_name,
      email: user_email,
      curp: studentUser.curp || null,
      status: studentUser.status || 'active',
      fecha_inscripcion: studentUser.created_date || null,
      enrollment_date: studentUser.created_date || null, // backward compat
      current_level: userProgress.current_level ?? null,
      course_completed_at: userProgress.course_completed_at || null,
      graduation_status: userProgress.graduation_status || 'enrolled',
      certificate_validated_at: userProgress.certificate_validated_at || null,
      certificate_validated_by_school: userProgress.certificate_validated_by_school || false,
    },
    summary: {
      total_progress: userProgress.total_progress_percent ?? 0,
      subjects_completed: completedSubjects,
      total_subjects: subjectsResult.length,
      average_grade,
      last_activity,
    },
    subjects: subjectsResult,
    evaluation_history,
  });
});