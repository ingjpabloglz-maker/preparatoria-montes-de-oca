import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_TYPES = ['multiple_choice','true_false','fill_blank','solve','order_steps','multiple_select','drag_drop','step_by_step'];
const ARRAY_ANSWER_TYPES = ['multiple_select', 'order_steps'];

// ─── NORMALIZACIÓN: explanation_levels siempre válido ─────────────────────────
function normalizeExplanationLevels(raw, question) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      basic: `La respuesta correcta es: ${question}`,
      detailed: `Se resuelve aplicando el concepto correspondiente.`,
      example: `Ejemplo: aplica el mismo procedimiento en un caso similar.`
    };
  }
  return {
    basic: typeof raw.basic === 'string' && raw.basic.trim() ? raw.basic : `Respuesta correcta.`,
    detailed: typeof raw.detailed === 'string' && raw.detailed.trim() ? raw.detailed : `Explicación paso a paso del procedimiento.`,
    example: typeof raw.example === 'string' && raw.example.trim() ? raw.example : `Ejemplo similar aplicado.`
  };
}

// ─── SANITIZACIÓN ESTRICTA: solo un campo tiene valor según el tipo ───────────
function sanitizeActivity(raw) {
  const isArrayType = ARRAY_ANSWER_TYPES.includes(raw.type);
  let correct_answer = '';
  let correct_answers = [];

  if (isArrayType) {
    if (Array.isArray(raw.correct_answers) && raw.correct_answers.length > 0) {
      correct_answers = raw.correct_answers.map(x => String(x));
    } else if (Array.isArray(raw.correct_answer) && raw.correct_answer.length > 0) {
      correct_answers = raw.correct_answer.map(x => String(x));
    } else if (typeof raw.correct_answer === 'string' && raw.correct_answer.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(raw.correct_answer);
        if (Array.isArray(parsed)) correct_answers = parsed.map(x => String(x));
      } catch { /* dejará vacío → validación rechazará */ }
    }
    correct_answer = ''; // SIEMPRE vacío para tipos array
  } else {
    if (typeof raw.correct_answer === 'string') {
      correct_answer = raw.correct_answer;
    } else if (raw.correct_answer !== null && raw.correct_answer !== undefined) {
      correct_answer = String(raw.correct_answer);
    }
    correct_answers = []; // SIEMPRE vacío para tipos string
  }

  return {
    ...raw,
    correct_answer,
    correct_answers,
    options: Array.isArray(raw.options) ? raw.options : [],
    accepted_answers: Array.isArray(raw.accepted_answers) ? raw.accepted_answers.map(a => String(a)) : [],
    hints: Array.isArray(raw.hints) ? raw.hints : raw.hints ? [String(raw.hints)] : [],
    drag_items: Array.isArray(raw.drag_items) ? raw.drag_items : [],
    drop_targets: Array.isArray(raw.drop_targets) ? raw.drop_targets : [],
    steps: Array.isArray(raw.steps) ? raw.steps : [],
  };
}

// ─── VALIDACIÓN ESTRICTA ──────────────────────────────────────────────────────
function validateActivity(act) {
  if (!act.question?.toString().trim()) return 'question vacío';
  if (!VALID_TYPES.includes(act.type)) return `tipo inválido: ${act.type}`;

  const isArrayType = ARRAY_ANSWER_TYPES.includes(act.type);

  // Rechazar si ambos campos están llenos
  if (isArrayType && act.correct_answer && act.correct_answer.trim() !== '') {
    return `Invalid activity: wrong answer field for type ${act.type} — correct_answer debe estar vacío`;
  }
  if (!isArrayType && Array.isArray(act.correct_answers) && act.correct_answers.length > 0) {
    return `Invalid activity: wrong answer field for type ${act.type} — correct_answers debe estar vacío`;
  }

  if (act.type === 'multiple_choice') {
    if (!Array.isArray(act.options) || act.options.length < 2) return 'options insuficientes';
    if (typeof act.correct_answer !== 'string' || act.correct_answer.trim() === '') return 'correct_answer debe ser string no vacío';
  }
  if (act.type === 'multiple_select') {
    if (!Array.isArray(act.options) || act.options.length < 2) return 'options insuficientes';
    if (!Array.isArray(act.correct_answers) || act.correct_answers.length === 0) return 'Invalid activity: wrong answer field for type multiple_select — correct_answers vacío';
  }
  if (act.type === 'order_steps') {
    if (!Array.isArray(act.options) || act.options.length < 2) return 'options insuficientes';
    if (!Array.isArray(act.correct_answers) || act.correct_answers.length === 0) return 'Invalid activity: wrong answer field for type order_steps — correct_answers vacío';
  }
  if (act.type === 'true_false') {
    const ca = act.correct_answer?.toString().toLowerCase();
    if (!['verdadero','falso','true','false'].includes(ca)) return `correct_answer inválido: ${ca}`;
  }
  if (act.type === 'fill_blank' || act.type === 'solve') {
    if (!act.correct_answer && (!Array.isArray(act.accepted_answers) || act.accepted_answers.length === 0))
      return 'correct_answer requerido';
  }
  if (act.type === 'drag_drop') {
    if (!Array.isArray(act.drag_items) || !act.drag_items.length) return 'drag_items vacío';
    if (!Array.isArray(act.drop_targets) || !act.drop_targets.length) return 'drop_targets vacío';
  }
  if (act.type === 'step_by_step') {
    if (!Array.isArray(act.steps) || act.steps.length < 2) return 'steps requiere mínimo 2';
  }
  return null;
}

// ─── Helper: actualizar progreso en la entidad ────────────────────────────────
async function updateProgress(base44, genId, patch) {
  try {
    const records = await base44.asServiceRole.entities.CurriculumGeneration.filter({ generation_id: genId });
    if (records[0]) {
      await base44.asServiceRole.entities.CurriculumGeneration.update(records[0].id, patch);
    }
  } catch (e) {
    console.warn('updateProgress error:', e.message);
  }
}

async function appendLog(base44, genId, currentLogs, message) {
  const logs = [...(currentLogs || []), `[${new Date().toISOString()}] ${message}`].slice(-50);
  await updateProgress(base44, genId, { logs });
  console.log(message);
  return logs;
}

// ─── Generar lección + actividades (lógica inline) ───────────────────────────
async function generateLessonBlock(base44, { module_id, subject_id, subject_name, topic, is_mini_eval, lesson_order, difficulty = 'medium', keywords = [] }) {
  const keywordsHint = keywords.length ? `\nPalabras clave a incluir: ${keywords.join(', ')}` : '';
  const difficultyHint = { easy: 'introductoria y accesible', medium: 'intermedia con ejemplos aplicados', hard: 'avanzada con razonamiento profundo' }[difficulty] || 'intermedia';

  const lessonResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Eres un experto en diseño instruccional para preparatoria mexicana. Crea el contenido teórico completo para una lección.

TEMA: "${topic}"
MATERIA: "${subject_name}"
TIPO: ${is_mini_eval ? 'MINI EVALUACIÓN (resumen y refuerzo)' : 'LECCIÓN NORMAL (enseñanza nueva)'}
NIVEL DE DIFICULTAD: ${difficultyHint}${keywordsHint}

Genera:
- title: título claro y específico (máximo 8 palabras)
- explanation: explicación teórica clara (máximo 150 palabras). Para matemáticas usa LaTeX: $x^2$, $\\frac{a}{b}$, $\\mathbb{N}$.

Devuelve SOLO JSON: { "title": "...", "explanation": "..." }`,
    response_json_schema: {
      type: "object",
      properties: { title: { type: "string" }, explanation: { type: "string" } },
      required: ["title", "explanation"]
    }
  });

  if (!lessonResult?.title || !lessonResult?.explanation) throw new Error('LLM no generó contenido válido para la lección');

  const lesson = await base44.asServiceRole.entities.CourseLesson.create({
    module_id,
    subject_id,
    title: lessonResult.title,
    explanation: lessonResult.explanation,
    order: lesson_order,
    is_mini_eval,
  });

  // Actividades
  const min = is_mini_eval ? 10 : 7;
  const max = is_mini_eval ? 15 : 11;
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const easyCount = Math.round(count * 0.4);
  const hardCount = Math.round(count * 0.2);
  const mediumCount = count - easyCount - hardCount;

  const typeInstructions = is_mini_eval
    ? `MÍNIMO: 2 multiple_choice, 2 true_false, 1 fill_blank, 2 multiple_select, 1 drag_drop, 1 step_by_step, 1 order_steps.`
    : `MÍNIMO: 2 multiple_choice, 1 true_false, 1 fill_blank, 1 multiple_select, 1 drag_drop, 1 step_by_step.`;

  const activitiesPrompt = `Eres un experto en diseño instruccional. Genera ${count} actividades para:
TEMA: "${lesson.title}"
MATERIA: "${subject_name}"
CONTENIDO: "${lesson.explanation}"
TIPO: ${is_mini_eval ? 'MINI EVALUACIÓN' : 'LECCIÓN NORMAL'}
${typeInstructions}
DIFICULTAD: ${easyCount} easy, ${mediumCount} medium, ${hardCount} hard.
TIPOS: multiple_choice, true_false, fill_blank, solve, order_steps, multiple_select, drag_drop, step_by_step.
REGLAS:
- multiple_choice: 4 opciones, correct_answer = texto exacto de opción correcta.
- true_false: options=["Verdadero","Falso"], correct_answer="Verdadero" o "Falso".
- fill_blank: pregunta con ___, correct_answer = texto.
- multiple_select: correct_answers = ARRAY de textos correctos, ej: ["op1","op3"]. NO usar correct_answer.
  - order_steps: options=pasos MEZCLADOS, correct_answers=ARRAY en ORDEN CORRECTO. NO usar correct_answer.
- drag_drop: drag_items=items mezclados, drop_targets=etiquetas, correct_answer=JSON object target→item.
- step_by_step: steps=[{instruction,answer,hint}], correct_answer="step_by_step".
CALIDAD: explanation_levels {basic,detailed,example}, incorrect_feedback {default:...}, hints (max 1), points: easy=8, medium=10, hard=14.
  Matemáticas: usa LaTeX dentro de $...$.
  REGLA CRÍTICA: NUNCA incluir ambos campos correct_answer y correct_answers en la misma actividad.
  Devuelve SOLO JSON con campo "activities": array de ${count} objetos.`;

  const activitiesResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: activitiesPrompt,
    response_json_schema: {
      type: "object",
      properties: {
        activities: { type: "array", items: { type: "object" } }
      }
    }
  });

  let rawActivities = Array.isArray(activitiesResult) ? activitiesResult : (activitiesResult?.activities || []);
  const valid = [];
  for (const rawAct of rawActivities) {
    const act = sanitizeActivity(rawAct);
    const err = validateActivity(act);
    if (err) {
      console.warn(`Invalid activity rejected: ${err}`, { type: act.type, q: act.question?.slice(0, 60) });
    } else {
      valid.push(act);
    }
  }

  // Reintento si faltan
  if (valid.length < min) {
    const needed = min - valid.length;
    const retry = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${activitiesPrompt}\n\nNecesito SOLO ${needed} actividades adicionales válidas. Devuelve JSON con "activities": [...]`,
      response_json_schema: { type: "object", properties: { activities: { type: "array", items: { type: "object" } } } }
    });
    const retryRaw = Array.isArray(retry) ? retry : (retry?.activities || []);
    for (const rawAct of retryRaw) {
      if (valid.length >= min) break;
      const act = sanitizeActivity(rawAct);
      const err = validateActivity(act);
      if (!err) valid.push(act);
      else console.warn(`Retry rejected: ${err}`, { type: act.type });
    }
  }

  // FALLBACK: si aún faltan, completar con actividades seguras predefinidas
  if (valid.length < min) {
    const fallbackNeeded = min - valid.length;
    console.log(`Fallback activities generated: ${fallbackNeeded} (lección preservada sin eliminar)`);
    const fallbackTemplates = [
      {
        type: 'multiple_choice',
        question: `¿Cuál de las siguientes opciones está relacionada con "${lesson.title}"?`,
        options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
        correct_answer: 'Opción A', correct_answers: [],
        explanation: `Esta actividad refuerza el tema: ${lesson.title}.`,
        hints: ['Revisa el contenido de la lección'],
        difficulty: 'easy', points: 8,
      },
      {
        type: 'true_false',
        question: `El tema "${lesson.title}" es parte de la materia ${subject_name}.`,
        options: ['Verdadero', 'Falso'],
        correct_answer: 'Verdadero', correct_answers: [],
        explanation: 'Esta lección pertenece al temario de la materia.',
        hints: ['Piensa en el contexto de la lección'],
        difficulty: 'easy', points: 8,
      },
      {
        type: 'fill_blank',
        question: `El tema principal de esta lección es ___.`,
        options: [],
        correct_answer: lesson.title, correct_answers: [],
        accepted_answers: [lesson.title],
        explanation: `El tema es "${lesson.title}".`,
        hints: ['Lee el título de la lección'],
        difficulty: 'easy', points: 8,
      },
    ];
    for (let f = 0; valid.length < min; f++) {
      valid.push({ ...fallbackTemplates[f % fallbackTemplates.length] });
    }
  }

  // Guardar actividades con campo dual estricto
  let activitiesCreated = 0;
  for (let i = 0; i < valid.length; i++) {
    const act = valid[i];
    const isArrayType = ARRAY_ANSWER_TYPES.includes(act.type);
    const actData = {
      lesson_id: lesson.id,
      type: act.type,
      question: act.question.trim(),
      options: act.options || [],
      correct_answer: isArrayType ? '' : (act.correct_answer || ''),
      correct_answers: isArrayType ? (act.correct_answers || []) : [],
      accepted_answers: act.accepted_answers || [],
      explanation: act.explanation || '',
      explanation_levels: normalizeExplanationLevels(act.explanation_levels, act.question),
      incorrect_feedback: act.incorrect_feedback || null,
      hints: act.hints || [],
      difficulty: act.difficulty || 'medium',
      points: act.points || 10,
      order: i + 1,
      grading_type: 'auto',
    };
    if (act.type === 'step_by_step') actData.steps = act.steps;
    if (act.type === 'drag_drop') { actData.drag_items = act.drag_items; actData.drop_targets = act.drop_targets; }
    await base44.asServiceRole.entities.CourseActivity.create(actData);
    activitiesCreated++;
  }

  return { lesson, activities_count: activitiesCreated };
}

// ─── HANDLER PRINCIPAL ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { subject_id, overwrite = false } = body;
    if (!subject_id) return Response.json({ error: 'subject_id requerido' }, { status: 400 });

    // Obtener materia
    const subjects = await base44.asServiceRole.entities.Subject.filter({ id: subject_id });
    const subject = subjects[0];
    if (!subject) return Response.json({ error: 'Materia no encontrada' }, { status: 404 });

    // Verificar que existe temario activo
    const syllabuses = await base44.asServiceRole.entities.SubjectSyllabus.filter({ subject_id, is_active: true });
    const syllabus = syllabuses[0];
    if (!syllabus || !syllabus.units?.length) {
      return Response.json({
        error: 'Esta materia no tiene un temario activo. Define el temario primero desde el panel de administración.',
        no_syllabus: true
      }, { status: 422 });
    }

    // Verificar contenido existente si no overwrite
    if (!overwrite) {
      const existingUnits = await base44.asServiceRole.entities.CourseUnit.filter({ subject_id });
      if (existingUnits.length > 0) {
        return Response.json({
          error: `La materia ya tiene ${existingUnits.length} unidades. Usa overwrite=true para sobreescribir.`,
          has_content: true
        }, { status: 409 });
      }
    }

    // Crear registro de generación
    const genId = crypto.randomUUID();
    const genRecord = await base44.asServiceRole.entities.CurriculumGeneration.create({
      generation_id: genId,
      subject_id,
      subject_name: subject.name,
      status: 'in_progress',
      progress_percent: 0,
      total_steps: 1,
      completed_steps: 0,
      current_module: '',
      current_lesson: '',
      logs: [],
      started_by: user.email,
      overwrite,
      units_created: 0,
      modules_created: 0,
      lessons_created: 0,
      activities_created: 0,
    });

    // Responder inmediatamente con el generation_id para que el frontend pueda hacer polling
    const responsePayload = { success: true, generation_id: genId, record_id: genRecord.id };

    // Ejecutar generación en background (fire and forget)
    (async () => {
      let logs = [];
      const log = async (msg) => { logs = await appendLog(base44, genId, logs, msg); };

      try {
        await log(`🚀 Iniciando generación de currículo para "${subject.name}" (Nivel ${subject.level})`);

        // ── FASE 0: Usar temario como blueprint ──────────────────────────────
        await log(`📋 Usando temario v${syllabus.version} como base`);
        await updateProgress(base44, genId, { current_module: 'Leyendo temario...', progress_percent: 2 });

        const blueprint = { units: syllabus.units };

        // Calcular total de pasos
        let totalLessons = 0;
        for (const unit of blueprint.units) {
          for (const mod of (unit.modules || [])) {
            totalLessons += (mod.lessons || []).length;
          }
        }
        const totalSteps = totalLessons;

        await updateProgress(base44, genId, {
          blueprint,
          total_steps: totalSteps,
          progress_percent: 5,
        });
        await log(`✅ Blueprint listo: ${blueprint.units.length} unidades, ${totalLessons} lecciones planificadas`);

        // Si overwrite, limpiar contenido existente
        if (overwrite) {
          await log('🗑️ Limpiando contenido existente...');
          const existingUnits = await base44.asServiceRole.entities.CourseUnit.filter({ subject_id });
          for (const u of existingUnits) {
            const mods = await base44.asServiceRole.entities.CourseModule.filter({ unit_id: u.id });
            for (const m of mods) {
              const lsns = await base44.asServiceRole.entities.CourseLesson.filter({ module_id: m.id });
              for (const l of lsns) {
                const acts = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id: l.id });
                for (const a of acts) await base44.asServiceRole.entities.CourseActivity.delete(a.id);
                await base44.asServiceRole.entities.CourseLesson.delete(l.id);
              }
              await base44.asServiceRole.entities.CourseModule.delete(m.id);
            }
            await base44.asServiceRole.entities.CourseUnit.delete(u.id);
          }
          await log('✅ Contenido anterior eliminado');
        }

        // ── FASES 1-4: Crear estructura y generar contenido ──────────────────
        let completedSteps = 0;
        let totalUnitsCreated = 0;
        let totalModulesCreated = 0;
        let totalLessonsCreated = 0;
        let totalActivitiesCreated = 0;

        for (const unitBlueprint of blueprint.units) {
          await log(`📦 Creando Unidad ${unitBlueprint.order}: "${unitBlueprint.title}"`);
          await updateProgress(base44, genId, { current_module: `Unidad: ${unitBlueprint.title}` });

          // Crear unidad
          const unit = await base44.asServiceRole.entities.CourseUnit.create({
            subject_id,
            title: unitBlueprint.title,
            order: unitBlueprint.order,
          });
          totalUnitsCreated++;

          for (const modBlueprint of (unitBlueprint.modules || [])) {
            await log(`  📁 Módulo ${modBlueprint.order}: "${modBlueprint.title}"`);
            await updateProgress(base44, genId, {
              current_module: modBlueprint.title,
              current_lesson: '',
            });

            // Crear módulo
            const module = await base44.asServiceRole.entities.CourseModule.create({
              unit_id: unit.id,
              subject_id,
              title: modBlueprint.title,
              order: modBlueprint.order,
            });
            totalModulesCreated++;

            let moduleOk = true;
            for (const lessonBlueprint of (modBlueprint.lessons || [])) {
              await updateProgress(base44, genId, {
                current_lesson: lessonBlueprint.topic,
                completed_steps: completedSteps,
                progress_percent: Math.round(5 + (completedSteps / totalSteps) * 90),
                lessons_created: totalLessonsCreated,
                activities_created: totalActivitiesCreated,
                modules_created: totalModulesCreated,
                units_created: totalUnitsCreated,
              });

              try {
                await log(`    📝 Lección ${lessonBlueprint.order}: "${lessonBlueprint.topic}" ${lessonBlueprint.is_mini_eval ? '(mini-eval)' : ''}`);

                const { lesson, activities_count } = await generateLessonBlock(base44, {
                  module_id: module.id,
                  subject_id,
                  subject_name: subject.name,
                  topic: lessonBlueprint.topic,
                  is_mini_eval: lessonBlueprint.is_mini_eval || false,
                  lesson_order: lessonBlueprint.order,
                  difficulty: lessonBlueprint.difficulty || 'medium',
                  keywords: lessonBlueprint.keywords || [],
                });

                totalLessonsCreated++;
                totalActivitiesCreated += activities_count;
                completedSteps++;
                await log(`    ✅ "${lesson.title}" — ${activities_count} actividades`);

              } catch (lessonErr) {
                await log(`    ❌ Error en lección "${lessonBlueprint.topic}": ${lessonErr.message}`);
                moduleOk = false;
                completedSteps++;
              }
            }

            // Fase 4: Validación por módulo — si falla y hay 0 lecciones, reportar
            if (!moduleOk) {
              await log(`  ⚠️ Módulo "${modBlueprint.title}" completado con errores parciales`);
            } else {
              await log(`  ✅ Módulo "${modBlueprint.title}" completado`);
            }
          }
        }

        // Completado
        await updateProgress(base44, genId, {
          status: 'completed',
          progress_percent: 100,
          completed_steps: completedSteps,
          total_steps: totalSteps,
          current_module: '',
          current_lesson: '',
          units_created: totalUnitsCreated,
          modules_created: totalModulesCreated,
          lessons_created: totalLessonsCreated,
          activities_created: totalActivitiesCreated,
        });
        await log(`🎉 Currículo completo: ${totalUnitsCreated} unidades, ${totalModulesCreated} módulos, ${totalLessonsCreated} lecciones, ${totalActivitiesCreated} actividades`);

      } catch (bgErr) {
        console.error('Background generation error:', bgErr.message);
        await updateProgress(base44, genId, {
          status: 'failed',
          error_message: bgErr.message,
        });
        await appendLog(base44, genId, logs, `💥 Error fatal: ${bgErr.message}`);
      }
    })();

    return Response.json(responsePayload);

  } catch (e) {
    console.error('generateSubjectCurriculum error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});