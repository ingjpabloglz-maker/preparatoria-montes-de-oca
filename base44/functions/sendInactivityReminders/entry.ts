import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const MAX_EMAILS_PER_WEEK = 2;

  const allProfiles = await base44.asServiceRole.entities.GamificationProfile.filter({});
  const activeProfiles = allProfiles.filter(p => p.email_notifications_enabled !== false);

  const templates = await base44.asServiceRole.entities.NotificationTemplate.filter({ active: true });

  let sent = 0;
  let skipped = 0;

  for (const profile of activeProfiles) {
    const { user_email, last_study_date_normalized } = profile;
    if (!last_study_date_normalized) continue;

    // Calcular días inactivo
    const lastDate = new Date(last_study_date_normalized);
    const diffMs = today - lastDate;
    const daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Solo enviar si inactivo 3+ días (primer día → notificación interna, no email)
    if (daysInactive < 3) { skipped++; continue; }

    // Verificar cooldown y límite semanal
    const recentLogs = await base44.asServiceRole.entities.NotificationLog.filter({ user_email });
    const lastLog = recentLogs.sort((a, b) => new Date(b.sent_date) - new Date(a.sent_date))[0];

    if (lastLog?.cooldown_end_date && new Date(lastLog.cooldown_end_date) > today) {
      skipped++; continue;
    }

    // Calcular emails enviados esta semana
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const emailsThisWeek = recentLogs.filter(l => new Date(l.sent_date) > weekAgo).length;
    if (emailsThisWeek >= MAX_EMAILS_PER_WEEK) { skipped++; continue; }

    // Seleccionar plantilla
    let templateType = daysInactive >= 14 ? 'inactivity_14d'
      : daysInactive >= 7 ? 'inactivity_7d'
      : 'inactivity_3d';

    let template = templates.find(t => t.type === templateType);
    if (!template) template = templates.find(t => t.type.startsWith('inactivity'));
    if (!template) { skipped++; continue; }

    // Obtener nombre del usuario
    const users = await base44.asServiceRole.entities.User.filter({ email: user_email });
    const userName = users[0]?.full_name?.split(' ')[0] || 'Estudiante';

    // Sustituir placeholders
    const subject = template.subject.replace('{nombre}', userName);
    const body = template.body_html
      .replace(/{nombre}/g, userName)
      .replace(/{dias_inactivo}/g, daysInactive)
      .replace(/{racha_previa}/g, profile.max_streak || 0);

    // Enviar email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user_email,
      subject,
      body,
    });

    // Registrar en NotificationLog
    const cooldownEnd = new Date(today);
    cooldownEnd.setDate(cooldownEnd.getDate() + 2); // cooldown 2 días

    await base44.asServiceRole.entities.NotificationLog.create({
      user_email,
      template_id: template.template_id,
      sent_date: today.toISOString(),
      status: 'sent',
      cooldown_end_date: cooldownEnd.toISOString(),
      emails_sent_this_week: emailsThisWeek + 1,
    });

    sent++;
  }

  return Response.json({ sent, skipped, total: activeProfiles.length });
});