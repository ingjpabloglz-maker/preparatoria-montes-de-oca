import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

    const { session_id, updates } = await req.json();
    // updates: [{ activity_id: string, user_answer: string, flagged?: boolean }]
    if (!session_id) return Response.json({ error: 'session_id requerido' }, { status: 400 });

    // ── Cargar sesión ──
    const sessions = await base44.asServiceRole.entities.FinalExamSession.filter({ id: session_id });
    const session = sessions[0];
    if (!session) return Response.json({ error: 'Sesión no encontrada' }, { status: 404 });

    // ── Validaciones de seguridad ──
    if (session.user_email !== user.email) return Response.json({ error: 'Acceso denegado' }, { status: 403 });
    if (session.is_locked) return Response.json({ error: 'Esta sesión ya está finalizada.' }, { status: 409 });
    if (session.status !== 'in_progress') return Response.json({ error: 'Sesión no activa.' }, { status: 409 });

    // ── Validar que no haya expirado ──
    const now = new Date();
    if (now > new Date(session.expires_at)) {
      await base44.asServiceRole.entities.FinalExamSession.update(session_id, {
        status: 'expired', is_locked: true
      });
      return Response.json({ error: 'El examen expiró.', expired: true }, { status: 410 });
    }

    // ── Aplicar updates ──
    if (Array.isArray(updates) && updates.length > 0) {
      const updatesMap = {};
      for (const u of updates) {
        if (u.activity_id) updatesMap[u.activity_id] = u;
      }

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

    await base44.asServiceRole.entities.FinalExamSession.update(session_id, {
      questions: session.questions,
      last_activity_at: now.toISOString(),
    });

    return Response.json({ success: true, saved_at: now.toISOString() });

  } catch (e) {
    console.error('[saveFinalExamProgress]', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});