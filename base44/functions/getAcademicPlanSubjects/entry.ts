import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Obtener las materias correctas del plan académico (por nivel de usuario)
// NO usar Subject.list() sin filtro — eso incluye materias fuera del plan

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { user_email } = body;

  if (!user_email) {
    return Response.json({ error: 'user_email is required' }, { status: 400 });
  }

  try {
    // Obtener nivel actual del usuario
    const upList = await base44.asServiceRole.entities.UserProgress.filter({ user_email });
    if (upList.length === 0) {
      return Response.json({ error: 'User progress not found' }, { status: 404 });
    }

    const userProgress = upList[0];
    const userLevel = userProgress.current_level;

    // Obtener SOLO las materias del plan acad del usuario (su nivel actual)
    // Se asume que el plan incluye todos los niveles 1...userLevel
    const planSubjects = await base44.asServiceRole.entities.Subject.filter({
      level: { $lte: userLevel },
    });

    // Ordenar por nivel y orden
    planSubjects.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return (a.order || 0) - (b.order || 0);
    });

    // Obtener progreso del usuario en estas materias
    const userProgress_list = await base44.asServiceRole.entities.SubjectProgress.filter({
      user_email,
    });

    const subjectsWithProgress = planSubjects.map(sub => {
      const sp = userProgress_list.find(p => p.subject_id === sub.id);
      return {
        subject_id: sub.id,
        name: sub.name,
        level: sub.level,
        completed: sp?.completed === true,
        test_passed: sp?.test_passed === true,
        final_grade: sp?.final_grade || null,
      };
    });

    return Response.json({
      status: 'ok',
      user_email,
      user_level: userLevel,
      total_plan_subjects: subjectsWithProgress.length,
      subjects: subjectsWithProgress,
    });
  } catch (e) {
    console.error('getAcademicPlanSubjects error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});