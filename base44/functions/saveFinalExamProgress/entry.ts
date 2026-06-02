import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function logEvent(event, data = {}) {
  console.log(JSON.stringify({ event, timestamp: new Date().toISOString(), ...data }));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const { session_id, updates } = await req.json();
    if (!session_id) return Response.json({ error: 'session_id requerido' }, { status: 400 });

    // ── Cargar sesión ──
    const sessions = await base44.asServiceRole.entities.FinalExamSession.filter({ id: session_id });
    const session = sessions[0];
    if (!session) return Response.json({ error: 'Sesión no encontrada' }, { status: 404 });

    // ── Validaciones de seguridad ──
    if (session.user_email !== user.email) return Response.json({ error: 'Acceso denegado' }, { status: 403 });

    if (session.is_locked) {
      logEvent('EXAM_AUTOSAVE_REJECTED', { session_id, user_email: user.email, reason: 'session_locked', status: session.status });
      return Response.json({ error: 'Esta sesión ya está finalizada.', locked: true }, { status: 409 });
    }

    if (session.status !== 'in_progress') {
      return Response.json({ error: 'Sesión no activa.' }, { status: 409 });
    }

    // ── Validar expiración backend ──
    const now = new Date();
    if (now > new Date(session.expires_at)) {
      await base44.asServiceRole.entities.FinalExamSession.update(session_id, {
        status: 'expired', is_locked: true
      });
      logEvent('EXAM_EXPIRED', { session_id, user_email: user.email, subject_id: session.subject_id, reason: 'detected_on_autosave' });
      return Response.json({ error: 'El examen expiró.', expired: true }, { status: 410 });
    }

    // ── Aplicar updates con validación de ownership ──
    const answeredBefore = session.questions.filter(q => q.user_answer).length;

    if (Array.isArray(updates) && updates.length > 0) {
      const sessionActivityIds = new Set(session.questions.map(q => q.activity_id));
      const updatesMap = {};
      for (const u of updates) {
        if (u.activity_id && sessionActivityIds.has(u.activity_id)) {
          updatesMap[u.activity_id] = u;
        }
      }

      if (Object.keys(updatesMap).length > 0) {
        session.questions = session.questions.map(q => {
          const upd = updatesMap[q.activity_id];
          if (!upd) return q;
          return {
            ...q,
            user_answer: upd.user_answer !== undefined ? upd.user_answer : q.user_answer,
            flagged: upd.flagged !== undefined ? upd.flagged : q.flagged,
          };
        });
      }
    }

    const autosave_count = (session.autosave_count || 0) + 1;
    const answeredAfter = session.questions.filter(q => q.user_answer).length;

    await base44.asServiceRole.entities.FinalExamSession.update(session_id, {
      questions: session.questions,
      last_activity_at: now.toISOString(),
      autosave_count,
    });

    logEvent('EXAM_AUTOSAVED', {
      session_id, user_email: user.email, subject_id: session.subject_id,
      autosave_count, answered_count: answeredAfter,
      newly_answered: answeredAfter - answeredBefore,
      time_remaining_seconds: Math.max(0, Math.floor((new Date(session.expires_at) - now) / 1000)),
    });

    return Response.json({ success: true, saved_at: now.toISOString(), autosave_count });

  } catch (e) {
    console.error('[saveFinalExamProgress]', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});