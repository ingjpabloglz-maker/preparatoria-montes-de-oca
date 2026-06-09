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

  // Fetch todo en paralelo usando UserProfile (entidad personalizada, sin restricciones)
  const [
    profiles,
    progressList,
    subjectProgressList,
    paymentPlans,
    subjects,
  ] = await Promise.all([
    base44.asServiceRole.entities.UserProfile.filter({ user_email }),
    base44.asServiceRole.entities.UserProgress.filter({ user_email }),
    base44.asServiceRole.entities.SubjectProgress.filter({ user_email }),
    base44.asServiceRole.entities.LevelPaymentPlan.filter({ user_email }),
    base44.asServiceRole.entities.Subject.list('level'),
  ]);

  const studentProfile = profiles[0];
  if (!studentProfile) return Response.json({ error: 'Student not found' }, { status: 404 });

  const parts = [studentProfile.apellido_paterno, studentProfile.apellido_materno, studentProfile.nombres].filter(Boolean);
  const display_name = parts.length > 0 ? parts.join(' ') : (studentProfile.full_name || studentProfile.user_email);

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
      id: studentProfile.user_id || studentProfile.id,
      email: user_email,
      full_name: display_name,
      apellido_paterno: studentProfile.apellido_paterno || '',
      apellido_materno: studentProfile.apellido_materno || '',
      nombres: studentProfile.nombres || '',
      curp: studentProfile.curp || '',
      telefono: studentProfile.telefono_personal || '',
      domicilio: studentProfile.domicilio || '',
      fecha_nacimiento: studentProfile.fecha_nacimiento || '',
      status: studentProfile.status || 'active',
      role: studentProfile.role || 'user',
      created_date: studentProfile.created_date,
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