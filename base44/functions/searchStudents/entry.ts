import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin' && user.role !== 'teacher') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { query = '' } = body;
  const q = query.trim().toLowerCase();

  const users = await base44.asServiceRole.entities.User.list();

  const results = users
    .filter(u => u.role !== 'admin' && u.role !== 'teacher')
    .map(u => {
      const apellidoP = u.apellido_paterno || '';
      const apellidoM = u.apellido_materno || '';
      const nombres = u.nombres || '';
      const parts = [apellidoP, apellidoM, nombres].filter(Boolean);
      const full_name = parts.length > 0 ? parts.join(' ') : (u.full_name || u.email);
      return { user_email: u.email, full_name, apellido_paterno: apellidoP, apellido_materno: apellidoM, nombres };
    })
    .filter(u => {
      if (!q) return true;
      return u.full_name.toLowerCase().includes(q) || u.user_email.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const cmp1 = a.apellido_paterno.localeCompare(b.apellido_paterno, 'es');
      if (cmp1 !== 0) return cmp1;
      const cmp2 = a.apellido_materno.localeCompare(b.apellido_materno, 'es');
      if (cmp2 !== 0) return cmp2;
      return a.nombres.localeCompare(b.nombres, 'es');
    })
    .slice(0, 15)
    .map(({ user_email, full_name }) => ({ user_email, full_name }));

  return Response.json({ status: 'ok', students: results });
});