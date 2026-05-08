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
  return null; // válido
}

Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { lesson_id, lesson_title, lesson_explanation, subject_name, is_mini_eval = false, replace_existing = false } = body;

  if (!lesson_id || !lesson_title) {
    return Response.json({ error: 'lesson_id and lesson_title are required' }, { status: 400 });
  }

  // Determinar cantidad de actividades
  const min = is_mini_eval ? 10 : 7;
  const max = is_mini_eval ? 15 : 11;
  const count = Math.floor(Math.random() * (max - min + 1)) + min;

  // Distribución de dificultad: 40% easy, 40% medium, 20% hard
  const easyCount  = Math.round(count * 0.4);
  const hardCount  = Math.round(count * 0.2);
  const mediumCount = count - easyCount - hardCount;

  // Tipos obligatorios mínimos
  const typeInstructions = is_mini_eval
    ? `Mezcla obligatoria de tipos. Incluye MÍNIMO: 2 multiple_choice, 2 true_false, 1 fill_blank, 2 multiple_select, 1 drag_drop, 1 step_by_step (si aplica al tema), 1 order_steps. Total: ${count} actividades.`
    : `Mezcla obligatoria de tipos. Incluye MÍNIMO: 2 multiple_choice, 1 true_false, 1 fill_blank, 1 multiple_select, 1 drag_drop, 1 step_by_step (si aplica al tema). Total: ${count} actividades.`;

  const prompt = `Eres un experto en diseño instruccional para preparatoria. Genera ${count} actividades de aprendizaje para la lección:

TEMA: "${lesson_title}"
MATERIA: "${subject_name || 'General'}"
CONTENIDO BASE: "${lesson_explanation || ''}"
TIPO DE LECCIÓN: ${is_mini_eval ? 'MINI EVALUACIÓN (evaluativa, más rigurosa)' : 'LECCIÓN NORMAL (formativa, progresiva)'}

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
- order_steps: pasos a ordenar. options = pasos en orden MEZCLADO (no revelar el orden correcto). correct_answer = JSON array de pasos en el ORDEN CORRECTO, ej: '["paso1","paso2","paso3"]'.
- drag_drop: drag_items = items a arrastrar (mezclados). drop_targets = etiquetas de destino. correct_answer = JSON object mapeando target → item, ej: '{"Categoría A":"item1","Categoría B":"item2"}'.
- step_by_step: steps = array de objetos {instruction, answer, hint}. correct_answer = "step_by_step" (se califica por steps).

REQUISITOS DE CALIDAD:
- Cada actividad debe tener objective y explanation (explanation_levels con basic, detailed, example).
- Preguntas claras, sin ambigüedades.
- Para matemáticas usar LaTeX: $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$.
- incorrect_feedback: objeto con feedback para opciones incorrectas (clave = opción, valor = mensaje). Al menos "default".
- hints: array con 1 pista como máximo.
- points: easy=8, medium=10, hard=14.
- order: 1 a ${count} (orden de aparición).

Devuelve un JSON array con exactamente ${count} objetos de actividad.
IMPORTANTE: devuelve SOLO el JSON array, sin texto adicional.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
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
              steps: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    instruction: { type: "string" },
                    answer: { type: "string" },
                    hint: { type: "string" }
                  }
                }
              },
              drag_items: { type: "array", items: { type: "string" } },
              drop_targets: { type: "array", items: { type: "string" } }
            }
          }
        }
      }
    }
  });

  // El LLM puede devolver {activities:[...]} o directamente un array
  let activities = [];
  if (Array.isArray(result)) {
    activities = result;
  } else if (result?.activities && Array.isArray(result.activities)) {
    activities = result.activities;
  } else {
    console.error('Unexpected LLM result shape:', JSON.stringify(result)?.slice(0, 300));
    return Response.json({ error: 'LLM returned unexpected format' }, { status: 500 });
  }

  if (activities.length === 0) {
    return Response.json({ error: 'No activities generated' }, { status: 500 });
  }

  // Validar mínimo de actividades
  if (activities.length < min) {
    return Response.json({
      error: `Generated only ${activities.length} activities, minimum is ${min}`,
      activities
    }, { status: 400 });
  }

  // Validar actividades generadas
  const valid = [];
  const invalid = [];
  for (const act of activities) {
    const err = validateActivity(act);
    if (err) {
      invalid.push({ type: act.type, question: act.question?.slice?.(0, 40), error: err });
    } else {
      valid.push(act);
    }
  }
  console.log(`Validation: ${valid.length} válidas, ${invalid.length} inválidas`, { invalid });

  // Si no hay suficientes válidas, hacer un reintento extra pidiendo solo las faltantes
  if (valid.length < min) {
    const needed = min - valid.length;
    console.log(`Reintentando generar ${needed} actividades adicionales...`);
    const retryPrompt = `${prompt}\n\nNOTA: Solo necesito ${needed} actividades adicionales válidas. Asegúrate de incluir todos los campos requeridos según el tipo.`;
    const retryResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: retryPrompt,
      response_json_schema: {
        type: "object",
        properties: { activities: { type: "array", items: { type: "object" } } }
      }
    });
    const retryActivities = Array.isArray(retryResult) ? retryResult : (retryResult?.activities || []);
    for (const act of retryActivities) {
      if (valid.length >= min) break;
      const err = validateActivity(act);
      if (!err) valid.push(act);
      else console.log('Retry activity también inválida:', err, act.type);
    }
  }

  if (valid.length < min) {
    return Response.json({ error: `Solo se generaron ${valid.length} actividades válidas (mínimo ${min}). Inválidas: ${JSON.stringify(invalid)}` }, { status: 500 });
  }

  // Si replace_existing, eliminar actividades previas
  if (replace_existing) {
    const existing = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id });
    for (const act of existing) {
      await base44.asServiceRole.entities.CourseActivity.delete(act.id);
    }
  }

  // Crear actividades válidas en BD
  const created = [];
  for (let i = 0; i < valid.length; i++) {
    const act = valid[i];
    const actData = {
      lesson_id,
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

  console.log(`Guardadas ${created.length} actividades para lección ${lesson_id}`, {
    lesson_title, is_mini_eval, count_requested: count, valid: valid.length, invalid: invalid.length
  });

  return Response.json({
    status: 'ok',
    lesson_id,
    activities_created: created.length,
    activities: created,
  });
  } catch (e) {
    console.error('generateLessonActivities error:', e.message, e.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
});