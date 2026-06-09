import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function requireAdmin(base44) {
  const user = await base44.auth.me();
  if (!user) return { error: 'Unauthorized', status: 401 };
  if (user.role !== 'admin') return { error: 'Forbidden: Admin access required', status: 403 };
  return { user };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const auth = await requireAdmin(base44);
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const {
    role = 'user',
    search = '',
    level = null,
    page = 1,
    limit = 50,
  } = body;

  const q = search.trim().toLowerCase();

  // Fetch en paralelo: UserProfile (entidad personalizada, sin restricciones) + UserProgress
  const [allProfiles, allProgress] = await Promise.all([
    base44.asServiceRole.entities.UserProfile.list(),
    base44.asServiceRole.entities.UserProgress.list(),
  ]);

  // Mapa de progreso por email para acceso O(1)
  const progressMap = {};
  for (const p of allProgress) {
    if (p.user_email) progressMap[p.user_email] = p;
  }

  // Filtrar por rol
  let filtered = role === 'all'
    ? allProfiles
    : allProfiles.filter(u => u.role === role);

  // Enriquecer con progreso académico
  filtered = filtered.map(u => {
    const prog = progressMap[u.user_email] || {};
    return {
      id: u.user_id || u.id,
      email: u.user_email,
      full_name: u.full_name || u.user_email,
      apellido_paterno: u.apellido_paterno || '',
      apellido_materno: u.apellido_materno || '',
      nombres: u.nombres || '',
      role: u.role || 'user',
      status: u.status || 'active',
      current_level: prog.current_level || 1,
      graduation_status: prog.graduation_status || 'enrolled',
      total_progress_percent: prog.total_progress_percent || 0,
      created_date: u.created_date,
    };
  });

  // Filtro texto
  if (q) {
    filtered = filtered.filter(u =>
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }

  // Filtro nivel
  if (level && level !== 'all') {
    const lvl = parseInt(level);
    filtered = filtered.filter(u => u.current_level === lvl);
  }

  // Ordenar: apellido_paterno → apellido_materno → nombres
  filtered.sort((a, b) => {
    const c1 = a.apellido_paterno.localeCompare(b.apellido_paterno, 'es');
    if (c1 !== 0) return c1;
    const c2 = a.apellido_materno.localeCompare(b.apellido_materno, 'es');
    if (c2 !== 0) return c2;
    return a.nombres.localeCompare(b.nombres, 'es');
  });

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginated = filtered.slice(offset, offset + limit);

  // Audit log
  try {
    await base44.asServiceRole.entities.UserReport.create({
      reported_user_email: auth.user.email,
      reported_by: auth.user.email,
      reported_by_role: 'admin',
      reason: 'ADMIN_USERS_LIST_VIEWED',
      description: JSON.stringify({ role, search, level, page, admin_email: auth.user.email, timestamp: new Date().toISOString() }),
      status: 'reviewed',
    });
  } catch (_) { /* audit no-op */ }

  return Response.json({
    status: 'ok',
    users: paginated,
    total,
    total_pages: totalPages,
    page,
    limit,
  });
});