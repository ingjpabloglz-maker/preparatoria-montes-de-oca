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

    // 5. Pagos
    await deleteAll('Payment', { user_email });

    // 6. Foro — primero dependencias, luego hilos
    await deleteAll('ForumPost', { author_email: user_email });
    await deleteAll('ForumLike', { user_email });
    await deleteAll('ForumReport', { reported_by: user_email });
    await deleteAll('ForumPenalty', { user_email });
    await deleteAll('ForumThread', { author_email: user_email });

    // 7. Evaluaciones y registros académicos
    await deleteAll('EvaluationAttempt', { user_email });
    await deleteAll('AcademicRecordSnapshot', { user_email });
    await deleteAll('SurpriseExamAttempt', { user_email });
    await deleteAll('AssistantBehavior', { user_email });
    await deleteAll('AssistantState', { user_email });
    await deleteAll('UserReport', { reported_by: user_email });
    await deleteAll('AssistantDecisionLog', { user_email });

    // 8. Finalmente eliminar usuario
    const users = await base44.asServiceRole.entities.User.filter({ email: user_email });
    if (users.length > 0) {
      await base44.asServiceRole.entities.User.delete(users[0].id);
    }

    // 9. Recalcular stats automáticamente
    try {
      await base44.asServiceRole.functions.invoke('recalculatePlatformStats', {});
    } catch (e) {
      console.warn('No se pudo recalcular stats:', e.message);
    }

    return Response.json({ success: true, deleted_email: user_email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});