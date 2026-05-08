import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Migra CourseActivity al modelo dual estricto:
 * - multiple_select / order_steps → correct_answers (array), correct_answer = ''
 * - todos los demás tipos       → correct_answer (string), correct_answers = []
 * 
 * Limpia cualquier actividad que tenga ambos campos llenos o el campo incorrecto.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin required' }, { status: 403 });

    const ARRAY_TYPES = ['multiple_select', 'order_steps'];

    let migratedToArray = 0;   // tipos array que tenían correct_answer → movido a correct_answers
    let migratedToString = 0;  // tipos string que tenían correct_answers lleno → limpiado
    let alreadyOk = 0;
    let errors = 0;
    const errorLog = [];

    const pageSize = 50;

    // ── Procesar tipos que deben usar correct_answers ────────────────────────
    for (const actType of ARRAY_TYPES) {
      let page = 0;
      while (true) {
        const activities = await base44.asServiceRole.entities.CourseActivity.filter(
          { type: actType }, 'created_date', pageSize, page * pageSize
        );
        if (!activities || activities.length === 0) break;

        for (const act of activities) {
          const hasCorrectAnswers = Array.isArray(act.correct_answers) && act.correct_answers.length > 0;
          const hasCorrectAnswer  = typeof act.correct_answer === 'string' && act.correct_answer.trim() !== '';
          const hasBothFilled     = hasCorrectAnswers && hasCorrectAnswer;

          // Ya correcto: correct_answers lleno y correct_answer vacío
          if (hasCorrectAnswers && !hasCorrectAnswer && !hasBothFilled) {
            alreadyOk++;
            continue;
          }

          let newArr = null;

          if (hasCorrectAnswers) {
            // correct_answers ya tiene datos → solo limpiar correct_answer si está lleno
            newArr = act.correct_answers.map(x => String(x));
          } else if (typeof act.correct_answer === 'string') {
            const ca = act.correct_answer.trim();
            if (ca.startsWith('[')) {
              try {
                const parsed = JSON.parse(ca);
                newArr = Array.isArray(parsed) ? parsed.map(x => String(x)) : [ca];
              } catch { newArr = [ca]; }
            } else if (ca !== '') {
              newArr = [ca];
            } else {
              errors++;
              errorLog.push({ id: act.id, type: actType, error: 'ambos campos vacíos' });
              continue;
            }
          } else if (Array.isArray(act.correct_answer)) {
            newArr = act.correct_answer.map(x => String(x));
          } else {
            errors++;
            errorLog.push({ id: act.id, type: actType, correct_answer: act.correct_answer, error: 'tipo inesperado' });
            continue;
          }

          await base44.asServiceRole.entities.CourseActivity.update(act.id, {
            correct_answers: newArr,
            correct_answer: '',
          });
          migratedToArray++;
          console.log(`[ARRAY] Migrated ${act.id} (${actType}) → correct_answers: ${JSON.stringify(newArr)}`);
        }

        if (activities.length < pageSize) break;
        page++;
      }
    }

    // ── Procesar todos los demás tipos: limpiar correct_answers si está lleno ─
    const STRING_TYPES = ['multiple_choice', 'true_false', 'fill_blank', 'solve', 'drag_drop', 'step_by_step'];
    for (const actType of STRING_TYPES) {
      let page = 0;
      while (true) {
        const activities = await base44.asServiceRole.entities.CourseActivity.filter(
          { type: actType }, 'created_date', pageSize, page * pageSize
        );
        if (!activities || activities.length === 0) break;

        for (const act of activities) {
          const hasCorrectAnswers = Array.isArray(act.correct_answers) && act.correct_answers.length > 0;
          if (!hasCorrectAnswers) {
            alreadyOk++;
            continue;
          }
          // Tiene correct_answers lleno pero no debería → limpiar
          await base44.asServiceRole.entities.CourseActivity.update(act.id, {
            correct_answers: [],
          });
          migratedToString++;
          console.log(`[STRING] Cleaned correct_answers for ${act.id} (${actType})`);
        }

        if (activities.length < pageSize) break;
        page++;
      }
    }

    console.log(`Migration complete: toArray=${migratedToArray}, toString=${migratedToString}, alreadyOk=${alreadyOk}, errors=${errors}`);

    return Response.json({
      status: 'completed',
      migrated_to_array: migratedToArray,
      migrated_to_string: migratedToString,
      already_ok: alreadyOk,
      errors,
      error_details: errorLog,
    });

  } catch (e) {
    console.error('migrateCorrectAnswersSplit error:', e.message, e.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
});