import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const sa = base44.asServiceRole;
    const allUsers = await sa.entities.User.list();
    const validEmails = new Set(allUsers.map(u => u.email));

    const ENTITIES_BY_EMAIL = [
      'UserProgress', 'SubjectProgress', 'LessonProgress',
      'EvaluationAttempt', 'AcademicRecordSnapshot', 'SurpriseExamAttempt',
      'GamificationProfile', 'UserAchievement', 'UserMetrics', 'ProcessedEvent',
      'AiTutorSession', 'NotificationLog', 'AssistantBehavior',
      'AssistantState', 'AssistantDecisionLog',
    ];

    const summary = {};

    for (const entityName of ENTITIES_BY_EMAIL) {
      try {
        const records = await sa.entities[entityName].list();
        const orphans = records.filter(r => r.user_email && !validEmails.has(r.user_email));
        await Promise.all(orphans.map(r => sa.entities[entityName].delete(r.id)));
        summary[entityName] = orphans.length;
      } catch (e) {
        console.warn(`Error en ${entityName}:`, e.message);
        summary[entityName] = 'error';
      }
    }

    // Huérfanos con campo author_email (foro)
    for (const [entityName, field] of [['ForumPost', 'author_email'], ['ForumThread', 'author_email']]) {
      try {
        const records = await sa.entities[entityName].list();
        const orphans = records.filter(r => r[field] && !validEmails.has(r[field]));
        await Promise.all(orphans.map(r => sa.entities[entityName].delete(r.id)));
        summary[entityName] = orphans.length;
      } catch (e) {
        summary[entityName] = 'error';
      }
    }

    // Recalcular stats
    await sa.functions.invoke('recalculatePlatformStats', {});

    return Response.json({ success: true, orphans_deleted: summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});