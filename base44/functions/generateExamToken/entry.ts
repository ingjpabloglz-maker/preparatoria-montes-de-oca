import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function generateCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O,0,I,1 para evitar confusión
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.role !== 'docente' && user.role !== 'admin') {
    return Response.json({ error: 'Solo docentes y admins pueden generar tokens de examen' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { subject_id, subject_name } = body;

  const now = new Date();
  const expires_at = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(); // +2 horas

  // Generar código único
  let token_code;
  let attempts = 0;
  while (attempts < 10) {
    const candidate = generateCode(6);
    const existing = await base44.asServiceRole.entities.PresentialExamToken.filter({ token_code: candidate, active: true });
    if (existing.length === 0) {
      token_code = candidate;
      break;
    }
    attempts++;
  }

  if (!token_code) {
    return Response.json({ error: 'No se pudo generar un código único, intenta de nuevo' }, { status: 500 });
  }

  const tokenData = {
    token_code,
    created_by: user.id,
    created_by_name: user.full_name,
    created_by_email: user.email,
    expires_at,
    used: false,
    active: true,
  };

  if (subject_id) tokenData.subject_id = subject_id;
  if (subject_name) tokenData.subject_name = subject_name;

  const token = await base44.asServiceRole.entities.PresentialExamToken.create(tokenData);

  console.log('TOKEN GENERATED', { token_code, by: user.email, subject_id, expires_at });

  return Response.json({
    token_code,
    token_id: token.id,
    expires_at,
    subject_id: subject_id || null,
    subject_name: subject_name || null,
  });
});