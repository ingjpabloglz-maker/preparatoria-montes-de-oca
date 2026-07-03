import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function requireAdmin(base44) {
  const user = await base44.auth.me();
  if (!user) return { error: 'Unauthorized', status: 401 };
  if (user.role !== 'admin') return { error: 'Forbidden: Admin access required', status: 403 };
  return { user };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireAdmin(base44);
    if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));
    const {
      title = '',
      message = '',
      type = 'info',
      link = null,
      target_type = 'global',
      target_emails = [],
    } = body;

    if (!title.trim() || !message.trim()) {
      return Response.json({ error: 'El título y mensaje son obligatorios' }, { status: 400 });
    }

    // Determinar destinatarios
    let recipients = [];
    if (target_type === 'global') {
      const profiles = await base44.asServiceRole.entities.UserProfile.list();
      recipients = profiles
        .filter(p => p.status !== 'blocked' && p.user_email)
        .map(p => p.user_email);
    } else {
      if (!Array.isArray(target_emails) || target_emails.length === 0) {
        return Response.json({ error: 'Debes seleccionar al menos un alumno' }, { status: 400 });
      }
      recipients = target_emails.map(e => e.trim().toLowerCase()).filter(Boolean);
    }

    if (recipients.length === 0) {
      return Response.json({ error: 'No hay destinatarios válidos' }, { status: 400 });
    }

    // Crear registros de notificación (bulk, en lotes de 500)
    const records = recipients.map(email => ({
      user_email: email,
      title: title.trim(),
      message: message.trim(),
      type,
      link,
      is_read: false,
      sent_by: auth.user.email,
      is_global: target_type === 'global',
    }));

    let created = 0;
    for (let i = 0; i < records.length; i += 500) {
      const batch = records.slice(i, i + 500);
      await base44.asServiceRole.entities.UserNotification.bulkCreate(batch);
      created += batch.length;
    }

    return Response.json({
      status: 'ok',
      created,
      target_type,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});