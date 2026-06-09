import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * cleanupWeeklyGoalSessions
 *
 * Responsabilidades:
 * A. Transicionar sesiones expiradas activas → failed
 * B. Archivar sesiones rewarded/failed/completed antiguas
 * C. Detectar y corregir corrupción (múltiples activas por usuario)
 * D. Compactar registros con más de 180 días
 *
 * Solo puede ser invocada por admin o por el scheduler automatizado.
 * Log de auditoría estructurado para cada acción.
 */

function auditLog(event, fields) {
  console.log(JSON.stringify({ event, ...fields, timestamp: new Date().toISOString() }));
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const nowIso = new Date().toISOString();
  const now = new Date();

  // Permitir ejecución desde scheduler (sin user) o desde admin
  let isScheduler = false;
  try {
    const user = await base44.auth.me();
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
  } catch {
    // Sin auth → asumimos que viene del scheduler
    isScheduler = true;
  }

  const stats = {
    failed_transitioned: 0,
    archived: 0,
    corruption_fixed: 0,
    compacted: 0,
    errors: 0,
  };

  // ── A. Obtener TODAS las sesiones no archivadas ───────────────────────────
  const allActive = await base44.asServiceRole.entities.WeeklyGoalSession.filter({
    archived: false,
  });

  // ── B. Transicionar expiradas activas → failed ────────────────────────────
  for (const session of allActive) {
    if (session.status !== 'active') continue;
    const expiresAt = new Date(session.expires_at);
    if (now >= expiresAt) {
      await base44.asServiceRole.entities.WeeklyGoalSession.update(session.id, {
        status: 'failed',
        archived: true,
        failed_at: nowIso,
        archived_at: nowIso,
      });
      stats.failed_transitioned++;
      auditLog('WEEKLY_GOAL_FAILED', {
        user_email: session.user_email,
        session_id: session.id,
        target: session.target,
        progress: session.progress,
        goal_number_in_cycle: session.goal_number_in_cycle,
        started_at: session.started_at,
        expires_at: session.expires_at,
        reason: 'expired_during_cleanup',
      });
    }
  }

  // ── C. Archivar sesiones rewarded/completed/failed ya cerradas ────────────
  // (pueden quedar sin archived=true si hubo transición parcial)
  for (const session of allActive) {
    if (['rewarded', 'completed', 'failed'].includes(session.status) && !session.archived) {
      await base44.asServiceRole.entities.WeeklyGoalSession.update(session.id, {
        archived: true,
        archived_at: nowIso,
      });
      stats.archived++;
      auditLog('WEEKLY_GOAL_ARCHIVED', {
        user_email: session.user_email,
        session_id: session.id,
        status: session.status,
        target: session.target,
        progress: session.progress,
        goal_number_in_cycle: session.goal_number_in_cycle,
      });
    }
  }

  // ── D. Detectar y corregir múltiples sesiones activas por usuario ─────────
  const activeByUser = {};
  for (const session of allActive) {
    if (session.status !== 'active') continue;
    if (!activeByUser[session.user_email]) activeByUser[session.user_email] = [];
    activeByUser[session.user_email].push(session);
  }

  for (const [userEmail, sessions] of Object.entries(activeByUser)) {
    if (sessions.length <= 1) continue;

    // Corrupción detectada: múltiples activas
    auditLog('WEEKLY_GOAL_CORRUPTION_FIXED', {
      user_email: userEmail,
      issue: 'multiple_active_sessions',
      count: sessions.length,
      session_ids: sessions.map(s => s.id),
    });

    // Ordenar por started_at desc → conservar la más reciente
    sessions.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
    const toKeep = sessions[0];
    const toFail = sessions.slice(1);

    for (const s of toFail) {
      const isExpired = new Date(s.expires_at) <= now;
      await base44.asServiceRole.entities.WeeklyGoalSession.update(s.id, {
        status: isExpired ? 'failed' : 'archived',
        archived: true,
        failed_at: isExpired ? nowIso : undefined,
        archived_at: nowIso,
      });
      stats.corruption_fixed++;
    }

    auditLog('WEEKLY_GOAL_CORRUPTION_FIXED', {
      user_email: userEmail,
      action: 'kept_most_recent',
      kept_session_id: toKeep.id,
      resolved_count: toFail.length,
    });
  }

  // ── E. Compactar registros de más de 180 días (solo marcar archived) ──────
  const ARCHIVE_CUTOFF_MS = 180 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - ARCHIVE_CUTOFF_MS);

  const allSessions = await base44.asServiceRole.entities.WeeklyGoalSession.list('-created_date', 500);
  for (const session of allSessions) {
    const startedAt = new Date(session.started_at);
    if (startedAt < cutoffDate && !session.archived) {
      await base44.asServiceRole.entities.WeeklyGoalSession.update(session.id, {
        status: 'archived',
        archived: true,
        archived_at: nowIso,
      });
      stats.compacted++;
      auditLog('WEEKLY_GOAL_ARCHIVED', {
        user_email: session.user_email,
        session_id: session.id,
        reason: 'compaction_180d',
        started_at: session.started_at,
        status: session.status,
        target: session.target,
        progress: session.progress,
      });
    }
  }

  auditLog('WEEKLY_GOAL_CLEANUP_COMPLETE', {
    is_scheduler: isScheduler,
    ...stats,
  });

  return Response.json({
    status: 'ok',
    stats,
    timestamp: nowIso,
  });
});