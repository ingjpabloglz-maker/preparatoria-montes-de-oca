import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Migra correct_answer de formato legacy (JSON string) a tipos nativos.
 * - multiple_select con correct_answer tipo '["a","b"]' → ["a", "b"] (array real)
 * - order_steps con correct_answer tipo '["paso1","paso2"]' → ["paso1", "paso2"] (array real)
 * Solo modifica registros que necesitan migración.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin required' }, { status: 403 });

    const TYPES_WITH_ARRAY_ANSWER = ['multiple_select', 'order_steps'];
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const errorLog = [];

    // Procesar por tipo
    for (const actType of TYPES_WITH_ARRAY_ANSWER) {
      let page = 0;
      const pageSize = 50;

      while (true) {
        const activities = await base44.asServiceRole.entities.CourseActivity.filter(
          { type: actType },
          'created_date',
          pageSize,
          page * pageSize
        );

        if (!activities || activities.length === 0) break;

        for (const act of activities) {
          const ca = act.correct_answer;

          // Ya es array nativo → formato correcto, saltar
          if (Array.isArray(ca)) {
            skipped++;
            continue;
          }

          if (typeof ca === 'string') {
            let newArr = null;

            if (ca.trim().startsWith('[')) {
              // JSON string → parsear a array
              try {
                const parsed = JSON.parse(ca);
                newArr = Array.isArray(parsed) ? parsed.map(x => String(x)) : [ca];
              } catch {
                newArr = [ca]; // fallback: envolver en array
              }
            } else {
              // String simple → envolver en array de un elemento
              newArr = [ca];
            }

            await base44.asServiceRole.entities.CourseActivity.update(act.id, {
              correct_answer: newArr
            });
            migrated++;
            console.log(`Migrated ${act.id} (${actType}): "${ca}" → ${JSON.stringify(newArr)}`);
          } else {
            // null/undefined/otro tipo → registrar error
            errors++;
            errorLog.push({ id: act.id, type: actType, correct_answer: ca, error: 'unexpected type: ' + typeof ca });
          }
        }

        if (activities.length < pageSize) break;
        page++;
      }
    }

    console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);

    return Response.json({
      status: 'completed',
      migrated,
      skipped,
      errors,
      error_details: errorLog,
    });

  } catch (e) {
    console.error('migrateCorrectAnswerFormat error:', e.message, e.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
});