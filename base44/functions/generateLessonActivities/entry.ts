import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_TYPES = ['multiple_choice','true_false','fill_blank','solve','order_steps','multiple_select','drag_drop','step_by_step'];
const ARRAY_ANSWER_TYPES = ['multiple_select', 'order_steps'];

// ─── SANITIZACIÓN ESTRICTA ────────────────────────────────────────────────────
// Garantiza que SOLO el campo correcto esté lleno según el tipo.
function sanitizeActivity(raw) {
  const isArrayType = ARRAY_ANSWER_TYPES.includes(raw.type);

  let correct_answer = '';
  let correct_answers = [];

  if (isArrayType) {
    // correct_answers debe ser array de strings no vacío
    if (Array.isArray(raw.correct_answers) && raw.correct_answers.length > 0) {
      correct_answers = raw.correct_answers.map(x => String(x));
    } else if (Array.isArray(raw.correct_answer) && raw.correct_answer.length > 0) {
      // LLM puso el array en correct_answer → mover
      correct_answers = raw.correct_answer.map(x => String(x));
    } else if (typeof raw.correct_answer === 'string' && raw.correct_answer.trim().startsWith('[')) {
      // LLM serializó el array como string JSON → parsear
      try {
        const parsed = JSON.parse(raw.correct_answer);
        if (Array.isArray(parsed)) correct_answers = parsed.map(x => String(x));
      } catch { /* quedará vacío → validación lo rechazará */ }
    }
    // correct_answer SIEMPRE vacío para estos tipos
    correct_answer = '';
  } else {
    // correct_answer debe ser string; correct_answers SIEMPRE vacío
    if (typeof raw.correct_answer === 'string') {
      correct_answer = raw.correct_answer;
    } else if (raw.correct_answer !== null && raw.correct_answer !== undefined) {
      correct_answer = String(raw.correct_answer);
    }
    correct_answers = [];
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
  const q = act.question?.toString().trim();
  if (!q) return 'question vacío';
  if (!VALID_TYPES.includes(act.type)) return `tipo inválido: ${act.type}`;

  const isArrayType = ARRAY_ANSWER_TYPES.includes(act.type);

  // Rechazo si ambos campos están llenos
  if (isArrayType && act.correct_answer && act.correct_answer.trim() !== '') {
    return `Invalid activity: wrong answer field for type ${act.type} — correct_answer debe estar vacío`;
  }
  if (!isArrayType && Array.isArray(act.correct_answers) && act.correct_answers.length > 0) {
    return `Invalid activity: wrong answer field for type ${act.type} — correct_answers debe estar vacío`;
  }

  switch (act.type) {
    case 'multiple_choice':
      if (!Array.isArray(act.options) || act.options.length < 3) return 'options insuficientes (mínimo 3)';
      if (typeof act.correct_answer !== 'string' || act.correct_answer.trim() === '') return 'correct_answer debe ser string no vacío';
      break;
    case 'multiple_select':
      if (!Array.isArray(act.options) || act.options.length < 2) return 'options insuficientes';
      if (!Array.isArray(act.correct_answers) || act.correct_answers.length === 0) return 'Invalid activity: wrong answer field for type multiple_select — correct_answers debe ser array no vacío';
      break;
    case 'order_steps':
      if (!Array.isArray(act.options) || act.options.length < 2) return 'options insuficientes para order_steps';
      if (!Array.isArray(act.correct_answers) || act.correct_answers.length === 0) return 'Invalid activity: wrong answer field for type order_steps — correct_answers debe ser array no vacío';
      break;
    case 'true_false': {
      const ca = act.correct_answer?.toString().toLowerCase().trim();
      if (!['verdadero','falso','true','false'].includes(ca)) return `correct_answer inválido para true_false: ${ca}`;
      break;
    }
    case 'fill_blank':
      if (!act.correct_answer && act.accepted_answers.length === 0) return 'accepted_answers o correct_answer requerido';
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

    const min = is_mini_eval ? 10 : 7;
    const generateCount = is_mini_eval ? 16 : 12;
    const easyCount   = Math.round(generateCount * 0.4);
    const hardCount   = Math.round(generateCount * 0.2);
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

REGLAS POR TIPO — SEGUIR AL PIE DE LA LETRA:
- multiple_choice: options mínimo 3. correct_answer = string EXACTO de una opción. NO incluir correct_answers.
- multiple_select: options mínimo 4. correct_answers = ARRAY de strings correctos, ej: ["op1","op3"]. NO incluir correct_answer.
- true_false: correct_answer = "Verdadero" o "Falso". NO incluir correct_answers.
- fill_blank: pregunta con ___. correct_answer = string con respuesta principal. accepted_answers = array. NO incluir correct_answers.
- drag_drop: drag_items y drop_targets obligatorios (mínimo 2 cada uno). correct_answer = objeto JSON como string mapeando target→item. NO incluir correct_answers.
- step_by_step: steps = array [{instruction,answer,hint}] mínimo 3 pasos. correct_answer = "step_by_step". NO incluir correct_answers.
- order_steps: options = pasos MEZCLADOS. correct_answers = ARRAY en ORDEN CORRECTO, ej: ["paso1","paso2"]. NO incluir correct_answer.
- solve: correct_answer = resultado como string. NO incluir correct_answers.

REGLA CRÍTICA: NUNCA incluir ambos campos correct_answer y correct_answers en la misma actividad.
- Si el tipo usa correct_answers → NO escribir correct_answer.
- Si el tipo usa correct_answer → NO escribir correct_answers.

CALIDAD PEDAGÓGICA:
- Preguntas claras, sin ambigüedad.
- Para matemáticas usar LaTeX dentro de $...$: $x^2$, $\\frac{a}{b}$.
- hints: array con máximo 1 pista (string).
- explanation: string con la explicación de la respuesta correcta.
- explanation_levels: objeto con basic, detailed, example.
- incorrect_feedback: objeto con al menos clave "default".
- points: easy=8, medium=10, hard=14.

EJEMPLOS CORRECTOS:
{"type":"multiple_choice","question":"¿Cuánto es 3+5?","options":["6","7","8","9"],"correct_answer":"8","hints":["Suma paso a paso"],"explanation":"3+5=8","difficulty":"easy","points":8}
{"type":"multiple_select","question":"Selecciona los primos","options":["2","3","4","5"],"correct_answers":["2","3","5"],"hints":["Solo divisibles por 1 y sí mismos"],"explanation":"2,3,5 son primos","difficulty":"medium","points":10}
{"type":"order_steps","question":"Ordena para resolver $2x=8$","options":["Verificar","Dividir entre 2","Plantear la ecuación"],"correct_answers":["Plantear la ecuación","Dividir entre 2","Verificar"],"explanation":"Este es el orden correcto","difficulty":"medium","points":10}
{"type":"true_false","question":"5 es par","correct_answer":"Falso","hints":["Divisible entre 2?"],"explanation":"5 no es divisible entre 2","difficulty":"easy","points":8}
{"type":"fill_blank","question":"7 + 3 = ___","correct_answer":"10","accepted_answers":["10"],"hints":["Suma"],"explanation":"7+3=10","difficulty":"easy","points":8}

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
                correct_answer: { type: "string" },
                correct_answers: { type: "array", items: { type: "string" } },
                accepted_answers: { type: "array", items: { type: "string" } },
                explanation: { type: "string" },
                explanation_levels: { type: "object" },
                incorrect_feedback: { type: "object" },
                hints: { type: "array", items: { type: "string" } },
                difficulty: { type: "string" },
                points: { type: "number" },
                steps: { type: "array", items: { type: "object" } },
                drag_items: { type: "array", items: { type: "string" } },
                drop_targets: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    });

    let rawActivities = [];
    if (Array.isArray(result)) {
      rawActivities = result;
    } else if (result?.activities && Array.isArray(result.activities)) {
      rawActivities = result.activities;
    } else {
      console.error('Unexpected LLM result shape:', JSON.stringify(result)?.slice(0, 300));
      return Response.json({ error: 'LLM returned unexpected format' }, { status: 500 });
    }

    if (rawActivities.length === 0) {
      return Response.json({ error: 'No activities generated' }, { status: 500 });
    }

    // Sanitizar y validar
    const valid = [];
    const invalid = [];
    for (const rawAct of rawActivities) {
      const act = sanitizeActivity(rawAct);
      const err = validateActivity(act);
      if (err) {
        console.warn(`Invalid activity rejected: ${err}`, { type: act.type, q: act.question?.slice(0, 60) });
        invalid.push({ type: act.type, question: act.question?.slice(0, 40), error: err });
      } else {
        valid.push(act);
      }
    }
    console.log(`Validation: ${valid.length} válidas, ${invalid.length} inválidas`, invalid);

    // Reintentar si faltan
    let retryAttempts = 0;
    while (valid.length < min && retryAttempts < 3) {
      retryAttempts++;
      const needed = min - valid.length;
      console.log(`Reintento ${retryAttempts}: generando ${needed} actividades adicionales...`);
      const retryResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${prompt}\n\nNOTA: Solo necesito ${needed} actividades adicionales válidas.`,
        response_json_schema: { type: "object", properties: { activities: { type: "array", items: { type: "object" } } } }
      });
      const retryRaw = Array.isArray(retryResult) ? retryResult : (retryResult?.activities || []);
      for (const rawAct of retryRaw) {
        if (valid.length >= min) break;
        const act = sanitizeActivity(rawAct);
        const err = validateActivity(act);
        if (!err) {
          valid.push(act);
        } else {
          console.warn(`Invalid activity rejected (retry ${retryAttempts}): ${err}`, { type: act.type });
        }
      }
    }

    if (valid.length < min) {
      return Response.json({
        error: `Solo se generaron ${valid.length} actividades válidas (mínimo ${min}).`,
        invalid_details: invalid
      }, { status: 500 });
    }

    if (replace_existing) {
      const existing = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id });
      for (const act of existing) {
        await base44.asServiceRole.entities.CourseActivity.delete(act.id);
      }
    }

    const created = [];
    for (let i = 0; i < valid.length; i++) {
      const act = valid[i];
      const isArrayType = ARRAY_ANSWER_TYPES.includes(act.type);

      const actData = {
        lesson_id,
        type: act.type,
        question: act.question.trim(),
        options: act.options || [],
        // Campo dual: solo uno tiene valor, el otro siempre vacío
        correct_answer: isArrayType ? '' : act.correct_answer,
        correct_answers: isArrayType ? act.correct_answers : [],
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
      lesson_title, is_mini_eval, valid: valid.length, invalid: invalid.length
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