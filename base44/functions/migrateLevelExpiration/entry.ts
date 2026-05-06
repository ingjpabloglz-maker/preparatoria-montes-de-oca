import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Duración de cada nivel en días — fuente de verdad única
const LEVEL_DURATION_DAYS = 100;

/**
 * Migración de datos: calcula expires_at para todos los UserProgress existentes
 * que no tengan ese campo, basándose en level_start_date + 100 días.
 * También sincroniza blocked_due_to_time según la nueva lógica.
 *
 * Solo puede ejecutarse por un administrador.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const sa = base44.asServiceRole;
    const allProgress = await sa.entities.UserProgress.list();

    const now = new Date();
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const details = [];

    for (const progress of allProgress) {
      // Saltar registros sin level_start_date (no hay inicio registrado)
      if (!progress.level_start_date) {
        skipped++;
        details.push({ email: progress.user_email, status: 'skipped', reason: 'sin level_start_date' });
        continue;
      }

      // Calcular expires_at a partir de level_start_date
      const startDate = new Date(progress.level_start_date);
      const expiresAt = new Date(startDate);
      expiresAt.setDate(expiresAt.getDate() + LEVEL_DURATION_DAYS);

      const isExpired = now > expiresAt;

      try {
        await sa.entities.UserProgress.update(progress.id, {
          expires_at: expiresAt.toISOString(),
          blocked_due_to_time: isExpired,
        });

        migrated++;
        details.push({
          email: progress.user_email,
          level: progress.current_level,
          level_start_date: progress.level_start_date,
          expires_at: expiresAt.toISOString(),
          blocked_due_to_time: isExpired,
          status: 'migrated',
        });
      } catch (err) {
        errors++;
        details.push({ email: progress.user_email, status: 'error', error: err.message });
      }
    }

    return Response.json({
      success: true,
      summary: {
        total: allProgress.length,
        migrated,
        skipped,
        errors,
        level_duration_days: LEVEL_DURATION_DAYS,
      },
      details,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});