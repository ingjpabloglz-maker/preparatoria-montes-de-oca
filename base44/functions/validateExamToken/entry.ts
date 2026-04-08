import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function generateSessionToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 48; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { token_code, subject_id } = body;

  if (!token_code) {
    return Response.json({ error: 'token_code requerido' }, { status: 400 });
  }

  const tokens = await base44.asServiceRole.entities.PresentialExamToken.filter({
    token_code: token_code.toUpperCase().trim(),
  });

  if (tokens.length === 0) {
    return Response.json({ error: 'TOKEN_NOT_FOUND', message: 'Código de examen no encontrado' }, { status: 404 });
  }

  const token = tokens[0];

  if (!token.active) {
    return Response.json({ error: 'TOKEN_INACTIVE', message: 'Este código ha sido desactivado' }, { status: 403 });
  }

  if (token.used) {
    return Response.json({ error: 'TOKEN_ALREADY_USED', message: 'Este código ya fue utilizado' }, { status: 403 });
  }

  const now = new Date();
  if (now > new Date(token.expires_at)) {
    return Response.json({ error: 'TOKEN_EXPIRED', message: 'El código ha expirado. Solicita uno nuevo al docente.' }, { status: 403 });
  }

  // Validar coincidencia de materia (si el token tiene subject_id)
  if (token.subject_id && subject_id && token.subject_id !== subject_id) {
    return Response.json({
      error: 'TOKEN_SUBJECT_MISMATCH',
      message: 'Este código no corresponde a esta materia',
    }, { status: 403 });
  }

  // Generar session_token válido por 1 hora
  const session_token = generateSessionToken();
  const session_expires_at = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // +1 hora

  // Marcar token como usado
  await base44.asServiceRole.entities.PresentialExamToken.update(token.id, {
    used: true,
    used_by: user.email,
    used_by_name: user.full_name,
    used_at: now.toISOString(),
    session_token,
    session_expires_at,
  });

  console.log('TOKEN VALIDATED', {
    token_code,
    used_by: user.email,
    subject_id: token.subject_id || subject_id,
  });

  return Response.json({
    valid: true,
    session_token,
    session_expires_at,
    subject_id: token.subject_id || subject_id,
    generated_by: token.created_by_name,
  });
});