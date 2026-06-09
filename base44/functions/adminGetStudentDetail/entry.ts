import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function requireAdmin(base44) {
  const user = await base44.auth.me();
  if (!user) return { error: 'Unauthorized', status: 401 };
  if (user.role !== 'admin') return { error: 'Forbidden: Admin access required', status: 403 };
  return { user };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const auth = await requireAdmin(base44);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const { user_email } = body;
  if (!user_email) return Response.json({ error: 'user_email required' }, { status: 400 });

  // Fetch todo en paralelo usando asServiceRole
  const [
    allUsers,
    progressList,
    subjectProgressList,
    paymentPlans,
    subjects,
  ] = await Promise.all([
    base44.asServiceRole.entities.User.list(),
    base44.asServiceRole.entities.UserProgress.filter({ user_email }),
    base44.asServiceRole.entities.SubjectProgress.filter({ user_email }),
    base44.asServiceRole.entities.LevelPaymentPlan.filter({ user_email }),
    base44.asServiceRole.entities.Subject.list('level'),
  ]);

  const studentUser = allUsers.find(u => u.email === user_email);
  if (!studentUser) return Response.json({ error: 'Student not found' }, { status: 404 });

  const parts = [studentUser.apellido_paterno, studentUser.apellido_materno, studentUser.nombres].filter(Boolean);
  const display_name = parts.length > 0 ? parts.join(' ') : (studentUser.full_name || studentUser.email);

  const progress = progressList[0] || {};

  // Audit log
  try {
    await base44.asServiceRole.entities.UserReport.create({
      reported_user_email: user_email,
      reported_by: auth.user.email,
      reported_by_role: 'admin',
      reason: 'ADMIN_STUDENT_DETAIL_VIEWED',
      description: JSON.stringify({ admin_email: auth.user.email, target_student: user_email, timestamp: new Date().toISOString() }),
      status: 'reviewed',
    });
  } catch (_) { /* audit no-op */ }

  return Response.json({
    status: 'ok',
    student: {
      id: studentUser.id,
      email: user_email,
      full_name: display_name,
      apellido_paterno: studentUser.apellido_paterno || '',
      apellido_materno: studentUser.apellido_materno || '',
      nombres: studentUser.nombres || '',
      curp: studentUser.curp || '',
      telefono: studentUser.telefono || '',
      domicilio: studentUser.domicilio || '',
      fecha_nacimiento: studentUser.fecha_nacimiento || '',
      status: studentUser.status || 'active',
      role: studentUser.role,
      created_date: studentUser.created_date,
    },
    progress: {
      current_level: progress.current_level || 1,
      total_progress_percent: progress.total_progress_percent || 0,
      graduation_status: progress.graduation_status || 'enrolled',
      blocked_due_to_time: progress.blocked_due_to_time || false,
      expires_at: progress.expires_at || null,
      course_completed_at: progress.course_completed_at || null,
      certificate_validated_by_school: progress.certificate_validated_by_school || false,
      certificate_validated_at: progress.certificate_validated_at || null,
    },
    subjects,
    subject_progress: subjectProgressList,
    payment_plans: paymentPlans,
  });
});