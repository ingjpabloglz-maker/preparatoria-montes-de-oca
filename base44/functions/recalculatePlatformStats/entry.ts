import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permitir llamadas desde scheduler (sin usuario) o desde admin
    let isScheduled = false;
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    } catch (_) {
      // Sin sesión → llamada desde scheduler, permitida
      isScheduled = true;
    }

    const sa = base44.asServiceRole;

    // Cargar datos base
    const [allUsers, allProgress, allSubjectProgress, allPayments] = await Promise.all([
      sa.entities.User.list(),
      sa.entities.UserProgress.list(),
      sa.entities.SubjectProgress.list(),
      sa.entities.Payment.list(),
    ]);

    const students = allUsers.filter(u => u.role === 'user');
    const studentEmails = new Set(students.map(u => u.email));
    const total_students = students.length;

    // Activos: tienen UserProgress (han ingresado al menos al dashboard)
    // Bloqueados: blocked_due_to_time === true
    let active_students = 0;
    let blocked_students = 0;

    // Distribución por nivel y progreso promedio
    const levelCountMap = {};
    const levelProgressSumMap = {};
    const levelProgressCountMap = {};

    for (const prog of allProgress.filter(p => studentEmails.has(p.user_email))) {
      const lvl = String(prog.current_level || 1);
      levelCountMap[lvl] = (levelCountMap[lvl] || 0) + 1;

      if (prog.blocked_due_to_time) {
        blocked_students++;
      } else {
        active_students++;
      }

      // Progreso por nivel: calcular promedio de total_progress_percent
      if (prog.total_progress_percent != null) {
        levelProgressSumMap[lvl] = (levelProgressSumMap[lvl] || 0) + prog.total_progress_percent;
        levelProgressCountMap[lvl] = (levelProgressCountMap[lvl] || 0) + 1;
      }
    }

    const students_per_level = levelCountMap;

    const progress_per_level = {};
    for (const lvl of Object.keys(levelProgressSumMap)) {
      progress_per_level[lvl] = Math.round(levelProgressSumMap[lvl] / levelProgressCountMap[lvl]);
    }

    // Materias completadas totales (solo alumnos)
    const studentSubjectEmails = studentEmails;
    const completed_subjects_count = allSubjectProgress.filter(sp => sp.test_passed === true && studentSubjectEmails.has(sp.user_email)).length;

    // Folios
    const used_folios = allPayments.filter(p => p.status === 'used').length;
    const available_folios = allPayments.filter(p => p.status === 'available').length;

    const statsPayload = {
      total_students,
      active_students,
      blocked_students,
      students_per_level,
      progress_per_level,
      completed_subjects_count,
      used_folios,
      available_folios,
      last_updated: new Date().toISOString(),
    };

    // Upsert: buscar si ya existe un registro y actualizar, si no crear
    const existing = await sa.entities.PlatformStats.list();
    if (existing.length > 0) {
      await sa.entities.PlatformStats.update(existing[0].id, statsPayload);
    } else {
      await sa.entities.PlatformStats.create(statsPayload);
    }

    return Response.json({ success: true, stats: statsPayload });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});