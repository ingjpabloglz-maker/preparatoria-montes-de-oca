import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_TYPES = ['multiple_choice','true_false','fill_blank','solve','order_steps','multiple_select','drag_drop','step_by_step'];

function validateActivity(act) {
  const q = act.question?.toString().trim();
  if (!q) return 'question vacío';
  if (!VALID_TYPES.includes(act.type)) return `tipo inválido: ${act.type}`;
  if ((act.type === 'multiple_choice' || act.type === 'multiple_select') && (!Array.isArray(act.options) || act.options.length < 2)) return 'options insuficientes';
  if (act.type === 'true_false') {
    const ca = act.correct_answer?.toString().toLowerCase();
    if (!['verdadero','falso','true','false'].includes(ca)) return `correct_answer inválido: ${ca}`;
  }
  if ((act.type === 'fill_blank' || act.type === 'solve') && !act.correct_answer && (!Array.isArray(act.accepted_answers) || !act.accepted_answers.length)) return 'correct_answer requerido';
  if (act.type === 'drag_drop' && (!Array.isArray(act.drag_items) || !act.drag_items.length || !Array.isArray(act.drop_targets) || !act.drop_targets.length)) return 'drag_items/drop_targets vacíos';
  if (act.type === 'step_by_step' && (!Array.isArray(act.steps) || act.steps.length < 2)) return 'steps requiere mínimo 2 pasos';
  return null;
}

async function generateActivities(base44, lesson, subjectName) {
  const is_mini_eval = lesson.is_mini_eval || false;
  const min = is_mini_eval ? 10 : 7;
  const max = is_mini_eval ? 15 : 11;
  const count = Math.floor(Math.random() * (max - min + 1)) + min;

  const easyCount = Math.round(count * 0.4);
  const hardCount = Math.round(count * 0.2);
  const mediumCount = count - easyCount - hardCount;

  const typeInstructions = is_mini_eval
    ? `Mezcla obligatoria. Incluye MÍNIMO: 2 multiple_choice, 2 true_false, 1 fill_blank, 2 multiple_select, 1 drag_drop, 1 step_by_step, 1 order_steps. Total: ${count}.`
    : `Mezcla obligatoria. Incluye MÍNIMO: 2 multiple_choice, 1 true_false, 1 fill_blank, 1 multiple_select, 1 drag_drop, 1 step_by_step. Total: ${count}.`;

  const prompt = `Eres un experto en diseño instruccional para preparatoria. Genera ${count} actividades de aprendizaje para la lección:

TEMA: "${lesson.title}"
MATERIA: "${subjectName || 'General'}"
CONTENIDO BASE: "${lesson.explanation || ''}"
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
- drag_drop: drag_items = items a arrastrar. drop_targets = etiquetas de destino. correct_answer = JSON object mapeando target→item.
- step_by_step: steps = array de objetos {instruction, answer, hint}. correct_answer = "step_by_step".

REQUISITOS:
- explanation_levels con basic, detailed, example.
- incorrect_feedback con al menos clave "default".
- hints: máximo 1 pista.
- points: easy=8, medium=10, hard=14.
- Para matemáticas usar LaTeX: $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$.

Devuelve un JSON con campo "activities" que sea un array de exactamente ${count} objetos.`;

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
              explanation_levels: { type: "object" },
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

  const raw = Array.isArray(result) ? result : (result?.activities || []);

  const valid = [];
  const invalid = [];
  for (const act of raw) {
    const err = validateActivity(act);
    if (err) invalid.push({ type: act.type, error: err });
    else valid.push(act);
  }

  console.log(`LLM generó ${raw.length} actividades: ${valid.length} válidas, ${invalid.length} inválidas`, { invalid });
  return { valid, min };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { lesson_id } = body;
    if (!lesson_id) return Response.json({ error: 'lesson_id requerido' }, { status: 400 });

    // 1. Verificar si ya existen actividades
    const existing = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id }, 'order');
    if (existing.length > 0) {
      console.log(`Lección ${lesson_id}: usando ${existing.length} actividades existentes`);
      return Response.json({ status: 'existing', activities: existing, activities_count: existing.length });
    }

    // 2. Cargar la lección
    const lessons = await base44.asServiceRole.entities.CourseLesson.filter({ id: lesson_id });
    const lesson = lessons[0];
    if (!lesson) return Response.json({ error: 'Lección no encontrada' }, { status: 404 });

    // 3. Cargar nombre de la materia (opcional, para prompt)
    let subjectName = '';
    if (lesson.subject_id) {
      const subjects = await base44.asServiceRole.entities.Subject.filter({ id: lesson.subject_id });
      subjectName = subjects[0]?.name || '';
    }

    // 4. Generar actividades
    let { valid, min } = await generateActivities(base44, lesson, subjectName);

    // 5. Reintento si no hay suficientes
    if (valid.length < min) {
      console.log(`Solo ${valid.length} válidas, reintentando...`);
      const retry = await generateActivities(base44, lesson, subjectName);
      valid = [...valid, ...retry.valid];
    }

    if (valid.length < min) {
      return Response.json({ error: `Solo se generaron ${valid.length} actividades válidas (mínimo ${min})` }, { status: 500 });
    }

    // 6. Guardar en BD
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
      if (act.type === 'drag_drop') { actData.drag_items = act.drag_items; actData.drop_targets = act.drop_targets; }

      const newAct = await base44.asServiceRole.entities.CourseActivity.create(actData);
      created.push(newAct);
    }

    console.log(`Lección ${lesson_id}: creadas ${created.length} actividades nuevas`);
    return Response.json({ status: 'created', activities: created, activities_count: created.length });

  } catch (e) {
    console.error('getOrCreateLessonActivities error:', e.message, e.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
});