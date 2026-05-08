import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_TYPES = ['multiple_choice','true_false','fill_blank','solve','order_steps','multiple_select','drag_drop','step_by_step'];

// CAPA 2: Sanitización antes de validar
function sanitizeActivity(activity) {
  let correct_answer = activity.correct_answer;
  if (activity.type === 'multiple_select') {
    // Normalizar a array real de strings
    if (Array.isArray(correct_answer)) {
      correct_answer = correct_answer.map(x => String(x));
    } else if (typeof correct_answer === 'string') {
      // Compatibilidad con datos legacy serializados como JSON string
      if (correct_answer.startsWith('[')) {
        try { correct_answer = JSON.parse(correct_answer).map(x => String(x)); } catch { correct_answer = [correct_answer]; }
      } else {
        correct_answer = [correct_answer];
      }
    } else {
      correct_answer = [];
    }
  } else {
    correct_answer = correct_answer !== undefined ? String(correct_answer) : "";
  }

  return {
    ...activity,
    correct_answer,
    hints: Array.isArray(activity.hints)
      ? activity.hints
      : activity.hints ? [String(activity.hints)] : [],
    accepted_answers: Array.isArray(activity.accepted_answers)
      ? activity.accepted_answers.map(a => String(a))
      : activity.accepted_answers ? [String(activity.accepted_answers)] : [],
    options: Array.isArray(activity.options) ? activity.options : [],
    drag_items: Array.isArray(activity.drag_items) ? activity.drag_items : [],
    drop_targets: Array.isArray(activity.drop_targets) ? activity.drop_targets : [],
    steps: Array.isArray(activity.steps) ? activity.steps : [],
  };
}

// CAPA 4: Validador inteligente por tipo
function validateActivity(act) {
  const q = act.question?.toString().trim();
  if (!q) return 'question vacío';
  if (!VALID_TYPES.includes(act.type)) return `tipo inválido: ${act.type}`;

  switch (act.type) {
    case 'multiple_choice':
      if (!Array.isArray(act.options) || act.options.length < 3) return 'options insuficientes (mínimo 3)';
      if (!act.correct_answer) return 'correct_answer faltante';
      break;
    case 'multiple_select':
      if (!Array.isArray(act.options) || act.options.length < 2) return 'options insuficientes';
      if (!Array.isArray(act.correct_answer) || act.correct_answer.length === 0) return 'correct_answer debe ser array no vacío';
      break;
    case 'true_false': {
      const ca = act.correct_answer?.toString().toLowerCase().trim();
      if (!['verdadero','falso','true','false'].includes(ca)) return `correct_answer inválido para true_false: ${ca}`;
      break;
    }
    case 'fill_blank':
      if (act.accepted_answers.length === 0 && !act.correct_answer) return 'accepted_answers o correct_answer requerido';
      break;
    case 'solve':
      if (!act.correct_answer && act.accepted_answers.length === 0) return 'correct_answer o accepted_answers requerido';
      break;
    case 'drag_drop':
      if (act.drag_items.length === 0) return 'drag_items vacío';
      if (act.drop_targets.length === 0) return 'drop_targets vacío';
      break;
    case 'step_by_step':
      if (act.steps.length < 2) return 'steps requiere mínimo 2 pasos';
      break;
    case 'order_steps':
      if (!Array.isArray(act.options) || act.options.length < 2) return 'options insuficientes para order_steps';
      break;
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
  const { lesson_id, lesson_title, lesson_explanation, subject_name, is_mini_eval = false, replace_existing = false } = body;

  if (!lesson_id || !lesson_title) {
    return Response.json({ error: 'lesson_id and lesson_title are required' }, { status: 400 });
  }

  // Generar MÁS de lo necesario para permitir filtrado (Regla 1)
  const min = is_mini_eval ? 10 : 7;
  const generateCount = is_mini_eval ? 16 : 12; // Siempre generar más

  const easyCount  = Math.round(generateCount * 0.4);
  const hardCount  = Math.round(generateCount * 0.2);
  const mediumCount = generateCount - easyCount - hardCount;

  const prompt = `Eres un experto en diseño instruccional para preparatoria. Genera actividades educativas en formato JSON válido.

CONTEXTO:
- Tema: "${lesson_title}"
- Materia: "${subject_name || 'General'}"
- Contenido base: "${lesson_explanation || ''}"
- Tipo: ${is_mini_eval ? 'mini_eval (evaluativa, rigurosa)' : 'lesson (formativa, progresiva)'}

REGLAS GENERALES (OBLIGATORIAS):
1. Responde SOLO con JSON válido (sin texto adicional).
2. Cada actividad debe cumplir exactamente el esquema.
3. NO generar campos vacíos, null o undefined.
4. Tipos de datos estrictos: strings entre comillas, arrays con [].
5. Si no puedes generar un tipo correctamente, NO lo incluyas.
6. Genera exactamente ${generateCount} actividades.

DISTRIBUCIÓN DE DIFICULTAD:
- ${easyCount} actividades: difficulty = "easy"
- ${mediumCount} actividades: difficulty = "medium"
- ${hardCount} actividades: difficulty = "hard"

TIPOS OBLIGATORIOS (incluir todos):
- multiple_choice, multiple_select, true_false, fill_blank, drag_drop, step_by_step

REGLAS POR TIPO:
- multiple_choice: options mínimo 3. correct_answer = string EXACTO de una opción.
- multiple_select: options mínimo 4. correct_answer = ARRAY REAL de strings correctos, ej: ["op1","op3"] (NO string serializado).
- true_false: correct_answer = "true" o "false" (en minúsculas).
- fill_blank: pregunta con ___. accepted_answers = array con mínimo 1 respuesta. correct_answer = string con la respuesta principal.
- drag_drop: drag_items y drop_targets obligatorios (mínimo 2 cada uno). correct_answer = JSON object mapeando target→item.
- step_by_step: steps = array de objetos {instruction, answer, hint} con mínimo 3 pasos. correct_answer = "step_by_step".
- order_steps: options = pasos MEZCLADOS. correct_answer = ARRAY REAL en ORDEN CORRECTO (NO string serializado).
- solve: correct_answer = resultado numérico o expresión como string.

CALIDAD PEDAGÓGICA:
- Preguntas claras, sin ambigüedad.
- Para matemáticas usar LaTeX dentro de $...$: $x^2$, $\\frac{a}{b}$, $\\mathbb{N}$, $\\{1,2,3\\}$.
- hints: array con máximo 1 pista (string).
- explanation: string con la explicación de la respuesta correcta.
- explanation_levels: objeto con basic, detailed, example.
- incorrect_feedback: objeto con al menos clave "default".
- points: easy=8, medium=10, hard=14.

EJEMPLOS DE REFERENCIA:
{"type":"multiple_choice","question":"¿Cuánto es 3 + 5?","options":["6","7","8","9"],"correct_answer":"8","hints":["Suma los números paso a paso"],"explanation":"3 + 5 = 8","difficulty":"easy","points":8}
{"type":"multiple_select","question":"Selecciona los números primos","options":["2","3","4","5"],"correct_answer":["2","3","5"],"hints":["Un número primo tiene solo dos divisores"],"explanation":"2, 3 y 5 son primos","difficulty":"medium","points":10}
{"type":"true_false","question":"5 es un número par","correct_answer":"false","hints":["Revisa si es divisible entre 2"],"explanation":"5 no es divisible entre 2","difficulty":"easy","points":8}
{"type":"fill_blank","question":"Completa: 7 + 3 = ___","accepted_answers":["10"],"hints":["Suma los dos números"],"explanation":"7 + 3 = 10","difficulty":"easy","points":8}
{"type":"drag_drop","question":"Relaciona cada número con su tipo","drag_items":["2","-3","1/2"],"drop_targets":["Natural","Entero","Racional"],"correct_answer":"{\\"Natural\\":\\"2\\",\\"Entero\\":\\"-3\\",\\"Racional\\":\\"1/2\\"}","hints":["Clasifica según su tipo"],"explanation":"2 es natural, -3 es entero, 1/2 es racional","difficulty":"medium","points":10}
{"type":"step_by_step","question":"Resuelve: 2 + 3 × 4","steps":[{"instruction":"Multiplica 3 × 4","answer":"12","hint":"Primero multiplicación"},{"instruction":"Suma 2 + 12","answer":"14","hint":"Ahora la suma"}],"correct_answer":"step_by_step","hints":["Recuerda la jerarquía de operaciones"],"explanation":"Resultado: 14","difficulty":"medium","points":10}

FORMATO FINAL: Responder SOLO con { "activities": [ ... ] }`;

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
              correct_answer: {},
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

  // CAPA 2+3: Sanitizar, validar y reintentar hasta tener suficientes
  const valid = [];
  const invalid = [];
  for (const rawAct of activities) {
    const act = sanitizeActivity(rawAct);
    const err = validateActivity(act);
    if (err) {
      invalid.push({ type: act.type, question: act.question?.slice?.(0, 40), error: err });
    } else {
      valid.push(act);
    }
  }
  console.log(`Validation: ${valid.length} válidas, ${invalid.length} inválidas`, { invalid });

  // CAPA 3: Reintentar mientras falten actividades (no destructivo)
  let retryAttempts = 0;
  while (valid.length < min && retryAttempts < 3) {
    retryAttempts++;
    const needed = min - valid.length;
    console.log(`Reintento ${retryAttempts}: generando ${needed} actividades adicionales...`);
    const retryPrompt = `${prompt}\n\nNOTA: Solo necesito ${needed} actividades adicionales válidas. Asegúrate de incluir todos los campos requeridos según el tipo.`;
    const retryResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: retryPrompt,
      response_json_schema: {
        type: "object",
        properties: { activities: { type: "array", items: { type: "object" } } }
      }
    });
    const retryActivities = Array.isArray(retryResult) ? retryResult : (retryResult?.activities || []);
    for (const rawAct of retryActivities) {
      if (valid.length >= min) break;
      const act = sanitizeActivity(rawAct);
      const err = validateActivity(act);
      if (!err) valid.push(act);
      else console.log('Retry activity inválida:', err, act.type);
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
      correct_answer: act.correct_answer ?? '',
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
    lesson_title, is_mini_eval, count_requested: generateCount, valid: valid.length, invalid: invalid.length
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