import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const adminUser = await base44.auth.me();

    if (!adminUser || adminUser.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { user_email } = await req.json();
    if (!user_email) {
      return Response.json({ error: 'user_email is required' }, { status: 400 });
    }

    const deleteAll = async (entityName, query) => {
      try {
        const records = await base44.asServiceRole.entities[entityName].filter(query);
        await Promise.all(records.map(r => base44.asServiceRole.entities[entityName].delete(r.id)));
      } catch (e) {
        console.warn(`Error eliminando ${entityName}:`, e.message);
      }
    };

    // 1. Gamificación
    await deleteAll('GamificationProfile', { user_email });
    await deleteAll('UserAchievement', { user_email });
    await deleteAll('UserMetrics', { user_email });
    await deleteAll('ProcessedEvent', { user_email });

    // 2. Progreso académico
    await deleteAll('UserProgress', { user_email });
    await deleteAll('LessonProgress', { user_email });
    await deleteAll('SubjectProgress', { user_email });

    // 3. IA
    await deleteAll('AiTutorSession', { user_email });

    // 4. Notificaciones
    await deleteAll('NotificationLog', { user_email });

    // 5. Foro
    await deleteAll('ForumThread', { author_email: user_email });
    await deleteAll('ForumPost', { author_email: user_email });
    await deleteAll('ForumLike', { user_email });
    await deleteAll('ForumReport', { reported_by: user_email });
    await deleteAll('ForumPenalty', { user_email });

    // 6. Finalmente eliminar usuario
    const users = await base44.asServiceRole.entities.User.filter({ email: user_email });
    if (users.length > 0) {
      await base44.asServiceRole.entities.User.delete(users[0].id);
    }

    return Response.json({ success: true, deleted_email: user_email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});