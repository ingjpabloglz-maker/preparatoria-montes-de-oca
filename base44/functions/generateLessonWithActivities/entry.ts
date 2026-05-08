import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_TYPES = ['multiple_choice','true_false','fill_blank','solve','order_steps','multiple_select','drag_drop','step_by_step'];

function validateActivity(act) {
  const q = act.question?.toString().trim();
  if (!q) return 'question vacío';
  if (!VALID_TYPES.includes(act.type)) return `tipo inválido: ${act.type}`;
  if (act.type === 'multiple_choice' || act.type === 'multiple_select') {
    if (!Array.isArray(act.options) || act.options.length < 2) return 'options insuficientes';
    if (!act.correct_answer) return 'correct_answer faltante';
  }
  if (act.type === 'true_false') {
    const ca = act.correct_answer?.toString().toLowerCase();
    if (!['verdadero','falso','true','false'].includes(ca)) return `correct_answer inválido para true_false: ${ca}`;
  }
  if (act.type === 'fill_blank' || act.type === 'solve') {
    if (!act.correct_answer && (!Array.isArray(act.accepted_answers) || act.accepted_answers.length === 0))
      return 'correct_answer o accepted_answers requerido';
  }
  if (act.type === 'drag_drop') {
    if (!Array.isArray(act.drag_items) || act.drag_items.length === 0) return 'drag_items vacío';
    if (!Array.isArray(act.drop_targets) || act.drop_targets.length === 0) return 'drop_targets vacío';
  }
  if (act.type === 'step_by_step') {
    if (!Array.isArray(act.steps) || act.steps.length < 2) return 'steps requiere mínimo 2 pasos';
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { module_id, subject_id, subject_name, topic, is_mini_eval = false, lesson_order = 1 } = body;

    if (!module_id || !topic) {
      return Response.json({ error: 'module_id y topic son requeridos' }, { status: 400 });
    }

    // ── PASO 1: Generar contenido de la lección ──────────────────────────────
    const lessonPrompt = `Eres un experto en diseño instruccional para preparatoria mexicana. Crea el contenido teórico completo para una lección.

MÓDULO ID: ${module_id}
TEMA: "${topic}"
MATERIA: "${subject_name || 'General'}"
TIPO: ${is_mini_eval ? 'MINI EVALUACIÓN (resumen y refuerzo del módulo)' : 'LECCIÓN NORMAL (enseñanza nueva)'}

Genera:
- title: título claro y específico de la lección (máximo 8 palabras)
- explanation: explicación teórica clara y didáctica (máximo 150 palabras). Incluye definiciones clave, propiedades importantes y contexto. Para matemáticas usa LaTeX dentro de $...$: por ejemplo $\\mathbb{N}$, $x^2$, $\\frac{a}{b}$.

Devuelve SOLO un objeto JSON con: { "title": "...", "explanation": "..." }`;

    const lessonResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: lessonPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          explanation: { type: "string" }
        },
        required: ["title", "explanation"]
      }
    });

    if (!lessonResult?.title || !lessonResult?.explanation) {
      return Response.json({ error: 'El LLM no generó contenido válido para la lección' }, { status: 500 });
    }

    // Guardar la lección
    const lesson = await base44.asServiceRole.entities.CourseLesson.create({
      module_id,
      subject_id: subject_id || '',
      title: lessonResult.title,
      explanation: lessonResult.explanation,
      order: lesson_order,
      is_mini_eval,
    });

    console.log(`Lección creada: ${lesson.id} — "${lesson.title}"`);

    // ── PASO 2: Generar actividades basadas en la lección ────────────────────
    const min = is_mini_eval ? 10 : 7;
    const max = is_mini_eval ? 15 : 11;
    const count = Math.floor(Math.random() * (max - min + 1)) + min;

    const easyCount  = Math.round(count * 0.4);
    const hardCount  = Math.round(count * 0.2);
    const mediumCount = count - easyCount - hardCount;

    const typeInstructions = is_mini_eval
      ? `Mezcla obligatoria: MÍNIMO 2 multiple_choice, 2 true_false, 1 fill_blank, 2 multiple_select, 1 drag_drop, 1 step_by_step, 1 order_steps. Total: ${count} actividades.`
      : `Mezcla obligatoria: MÍNIMO 2 multiple_choice, 1 true_false, 1 fill_blank, 1 multiple_select, 1 drag_drop, 1 step_by_step. Total: ${count} actividades.`;

    const activitiesPrompt = `Eres un experto en diseño instruccional. Genera ${count} actividades de aprendizaje para esta lección:

TEMA: "${lesson.title}"
MATERIA: "${subject_name || 'General'}"
CONTENIDO BASE: "${lesson.explanation}"
TIPO: ${is_mini_eval ? 'MINI EVALUACIÓN (evaluativa, rigurosa)' : 'LECCIÓN NORMAL (formativa, progresiva)'}

${typeInstructions}

DISTRIBUCIÓN DE DIFICULTAD:
- ${easyCount} actividades: difficulty = "easy"
- ${mediumCount} actividades: difficulty = "medium"
- ${hardCount} actividades: difficulty = "hard"

TIPOS DISPONIBLES: multiple_choice, true_false, fill_blank, solve, order_steps, multiple_select, drag_drop, step_by_step

REGLAS POR TIPO:
- multiple_choice: 4 opciones, 1 correcta. correct_answer = texto exacto de la opción correcta.
- true_false: options = ["Verdadero","Falso"], correct_answer = "Verdadero" o "Falso".
- fill_blank: pregunta con ___ para completar. correct_answer = texto para llenar.
- solve: problema a resolver. correct_answer = resultado numérico o expresión.
- multiple_select: varias opciones, varias correctas. correct_answer = JSON array de textos correctos, ej: '["op1","op3"]'. options = array de strings.
- order_steps: pasos a ordenar. options = pasos en orden MEZCLADO. correct_answer = JSON array en ORDEN CORRECTO.
- drag_drop: drag_items = items a arrastrar (mezclados). drop_targets = etiquetas de destino. correct_answer = JSON object mapeando target → item.
- step_by_step: steps = array de objetos {instruction, answer, hint}. correct_answer = "step_by_step".

REQUISITOS DE CALIDAD:
- explanation_levels con basic, detailed, example para cada actividad.
- Para matemáticas SIEMPRE usar LaTeX dentro de $...$: $\\mathbb{N}$, $x^2$, $\\frac{a}{b}$, $\\{1,2,3\\}$.
- incorrect_feedback: objeto con al menos clave "default".
- hints: array con máximo 1 pista.
- points: easy=8, medium=10, hard=14.
- order: 1 a ${count}.

Devuelve SOLO el JSON array con exactamente ${count} objetos de actividad.`;

    const activitiesResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: activitiesPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          activities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                question: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correct_answer: { type: "string" },
                accepted_answers: { type: "array", items: { type: "string" } },
                explanation: { type: "string" },
                explanation_levels: {
                  type: "object",
                  properties: {
                    basic: { type: "string" },
                    detailed: { type: "string" },
                    example: { type: "string" }
                  }
                },
                incorrect_feedback: { type: "object" },
                hints: { type: "array", items: { type: "string" } },
                difficulty: { type: "string" },
                points: { type: "number" },
                order: { type: "number" },
                steps: { type: "array", items: { type: "object" } },
                drag_items: { type: "array", items: { type: "string" } },
                drop_targets: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    });

    let activities = Array.isArray(activitiesResult)
      ? activitiesResult
      : (activitiesResult?.activities || []);

    // Validar actividades
    const valid = [];
    const invalid = [];
    for (const act of activities) {
      const err = validateActivity(act);
      if (err) invalid.push({ type: act.type, error: err });
      else valid.push(act);
    }
    console.log(`Actividades: ${valid.length} válidas, ${invalid.length} inválidas`);

    // Reintento si faltan
    if (valid.length < min) {
      const needed = min - valid.length;
      const retryResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${activitiesPrompt}\n\nNOTA: Solo necesito ${needed} actividades adicionales válidas.`,
        response_json_schema: {
          type: "object",
          properties: { activities: { type: "array", items: { type: "object" } } }
        }
      });
      const retryActivities = Array.isArray(retryResult) ? retryResult : (retryResult?.activities || []);
      for (const act of retryActivities) {
        if (valid.length >= min) break;
        if (!validateActivity(act)) valid.push(act);
      }
    }

    if (valid.length < min) {
      // Si fallaron las actividades, eliminar la lección para no dejar huérfana
      await base44.asServiceRole.entities.CourseLesson.delete(lesson.id);
      return Response.json({
        error: `Solo se generaron ${valid.length} actividades válidas (mínimo ${min}). Lección eliminada para mantener consistencia.`
      }, { status: 500 });
    }

    // ── PASO 3: Guardar actividades vinculadas a la lección ──────────────────
    const created = [];
    for (let i = 0; i < valid.length; i++) {
      const act = valid[i];
      const actData = {
        lesson_id: lesson.id,
        type: act.type,
        question: act.question.trim(),
        options: act.options || [],
        correct_answer: act.correct_answer || '',
        accepted_answers: act.accepted_answers || [],
        explanation: act.explanation || '',
        explanation_levels: act.explanation_levels || null,
        incorrect_feedback: act.incorrect_feedback || null,
        hints: act.hints || [],
        difficulty: act.difficulty || 'medium',
        points: act.points || 10,
        order: i + 1,
        grading_type: 'auto',
      };
      if (act.type === 'step_by_step') actData.steps = act.steps;
      if (act.type === 'drag_drop') {
        actData.drag_items = act.drag_items;
        actData.drop_targets = act.drop_targets;
      }
      const newAct = await base44.asServiceRole.entities.CourseActivity.create(actData);
      created.push(newAct);
    }

    console.log(`✅ Lección "${lesson.title}" + ${created.length} actividades creadas para módulo ${module_id}`);

    return Response.json({
      success: true,
      lesson,
      activities_count: created.length,
    });

  } catch (e) {
    console.error('generateLessonWithActivities error:', e.message, e.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
});