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

// ─── SANITIZACIÓN GLOBAL ROBUSTA: NUNCA rechazar, siempre corregir ─────────────
function sanitizeActivity(raw) {
  const safe = { ...raw };

  // --- TYPE ---
  if (!safe.type || !VALID_TYPES.includes(safe.type)) {
    safe.type = 'multiple_choice';
  }

  // --- QUESTION ---
  if (!safe.question || typeof safe.question !== 'string') {
    safe.question = 'Selecciona la respuesta correcta';
  }

  // --- OPTIONS ---
  if (['multiple_choice', 'multiple_select', 'order_steps'].includes(safe.type)) {
    if (!Array.isArray(safe.options) || safe.options.length < 2) {
      safe.options = ['Opción A', 'Opción B', 'Opción C', 'Opción D'];
    }
  } else {
    safe.options = Array.isArray(safe.options) ? safe.options : [];
  }

  // --- CORRECT ANSWERS (dual field) ---
  if (ARRAY_ANSWER_TYPES.includes(safe.type)) {
    safe.correct_answer = '';
    if (!Array.isArray(safe.correct_answers) || safe.correct_answers.length === 0) {
      if (Array.isArray(safe.correct_answer) && safe.correct_answer.length > 0) {
        safe.correct_answers = safe.correct_answer.map(x => String(x));
      } else if (typeof safe.correct_answer === 'string' && safe.correct_answer.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(safe.correct_answer);
          safe.correct_answers = Array.isArray(parsed) ? parsed.map(x => String(x)) : [safe.options?.[0] || 'Opción A'];
        } catch {
          safe.correct_answers = [safe.options?.[0] || 'Opción A'];
        }
      } else {
        safe.correct_answers = [safe.options?.[0] || 'Opción A'];
      }
    } else {
      safe.correct_answers = safe.correct_answers.map(x => String(x));
    }
  } else {
    safe.correct_answers = [];
    if (!safe.correct_answer || typeof safe.correct_answer !== 'string') {
      safe.correct_answer = safe.options?.[0] || 'Respuesta correcta';
    }
  }

  // --- ACCEPTED ANSWERS ---
  safe.accepted_answers = Array.isArray(safe.accepted_answers) ? safe.accepted_answers.map(a => String(a)) : [];

  // --- HINTS ---
  safe.hints = Array.isArray(safe.hints) ? safe.hints.filter(h => h) : [];

  // --- EXPLANATION & LEVELS ---
  if (!safe.explanation || typeof safe.explanation !== 'string') {
    safe.explanation = safe.question;
  }
  safe.explanation_levels = normalizeExplanationLevels(safe.explanation_levels, safe.question);

  // --- STEPS (step_by_step) ---
  if (safe.type === 'step_by_step') {
    if (!Array.isArray(safe.steps) || safe.steps.length < 2) {
      safe.steps = [{ instruction: 'Paso 1', answer: 'respuesta 1', hint: 'pista 1' }, { instruction: 'Paso 2', answer: 'respuesta 2', hint: 'pista 2' }];
    }
  } else {
    safe.steps = [];
  }

  // --- DRAG/DROP ---
  if (safe.type === 'drag_drop') {
    if (!Array.isArray(safe.drag_items) || safe.drag_items.length < 2) {
      safe.drag_items = ['A', 'B', 'C'];
    }
    if (!Array.isArray(safe.drop_targets) || safe.drop_targets.length < 2) {
      safe.drop_targets = ['1', '2', '3'];
    }
  } else {
    safe.drag_items = [];
    safe.drop_targets = [];
  }

  // --- DIFFICULTY ---
  if (!['easy', 'medium', 'hard'].includes(safe.difficulty)) {
    safe.difficulty = 'medium';
  }

  // --- POINTS ---
  if (typeof safe.points !== 'number' || safe.points < 0) {
    const points = { easy: 8, medium: 10, hard: 14 };
    safe.points = points[safe.difficulty] || 10;
  }

  // --- FEEDBACK ---
  safe.incorrect_feedback = typeof safe.incorrect_feedback === 'object' ? safe.incorrect_feedback : null;

  return safe;
}

// ─── CAPA FINAL: normalizeForPersistence — se ejecuta justo antes de create/update ──
const ARRAY_TYPES = ['multiple_select', 'order_steps'];

function normalizeForPersistence(activity) {
  const a = { ...activity };
  const isArrayType = ARRAY_TYPES.includes(a.type);

  // --- question ---
  if (!a.question || typeof a.question !== 'string') a.question = 'Pregunta no disponible';

  // --- correct_answer ---
  if (isArrayType) {
    a.correct_answer = '';
  } else {
    if (a.correct_answer === null || a.correct_answer === undefined) a.correct_answer = '';
    else if (Array.isArray(a.correct_answer)) a.correct_answer = a.correct_answer.length > 0 ? String(a.correct_answer[0]) : '';
    else if (typeof a.correct_answer === 'object') a.correct_answer = JSON.stringify(a.correct_answer);
    else a.correct_answer = String(a.correct_answer);
  }

  // --- correct_answers ---
  if (isArrayType) {
    if (a.correct_answers === null || a.correct_answers === undefined) a.correct_answers = [];
    else if (typeof a.correct_answers === 'string') a.correct_answers = [a.correct_answers].filter(Boolean);
    else if (typeof a.correct_answers === 'number') a.correct_answers = [String(a.correct_answers)];
    else if (!Array.isArray(a.correct_answers) && typeof a.correct_answers === 'object') a.correct_answers = Object.values(a.correct_answers).map(String).filter(Boolean);
    else if (Array.isArray(a.correct_answers)) a.correct_answers = a.correct_answers.map(String).filter(Boolean);
    else a.correct_answers = [];
  } else {
    a.correct_answers = [];
  }

  // --- explanation_levels ---
  const expl = a.explanation || a.question || 'Explicación no disponible';
  if (!a.explanation_levels || Array.isArray(a.explanation_levels)) {
    a.explanation_levels = { basic: expl, detailed: expl, example: 'Sin ejemplo' };
  } else if (typeof a.explanation_levels === 'string') {
    a.explanation_levels = { basic: a.explanation_levels, detailed: a.explanation_levels, example: 'Sin ejemplo' };
  } else if (typeof a.explanation_levels === 'object') {
    a.explanation_levels = {
      basic: typeof a.explanation_levels.basic === 'string' ? a.explanation_levels.basic : expl,
      detailed: typeof a.explanation_levels.detailed === 'string' ? a.explanation_levels.detailed : expl,
      example: typeof a.explanation_levels.example === 'string' ? a.explanation_levels.example : 'Sin ejemplo',
    };
  } else {
    a.explanation_levels = { basic: expl, detailed: expl, example: 'Sin ejemplo' };
  }

  // --- options ---
  if (!Array.isArray(a.options)) a.options = [];
  else a.options = a.options.map(String).filter(Boolean);

  // --- hints ---
  if (!Array.isArray(a.hints)) a.hints = [];
  else a.hints = a.hints.map(String).filter(Boolean);

  // --- steps ---
  if (!Array.isArray(a.steps)) a.steps = [];

  // --- drag_items / drop_targets ---
  if (!Array.isArray(a.drag_items)) a.drag_items = [];
  else a.drag_items = a.drag_items.map(String).filter(Boolean);
  if (!Array.isArray(a.drop_targets)) a.drop_targets = [];
  else a.drop_targets = a.drop_targets.map(String).filter(Boolean);

  // --- points ---
  if (typeof a.points !== 'number' || isNaN(a.points) || a.points < 0) a.points = 10;

  return a;
}

function assertValidForPersistence(activity) {
  if (typeof activity.correct_answer !== 'string') throw new Error(`correct_answer debe ser string, got: ${typeof activity.correct_answer}`);
  if (!Array.isArray(activity.correct_answers)) throw new Error(`correct_answers debe ser array, got: ${typeof activity.correct_answers}`);
  if (typeof activity.explanation_levels !== 'object' || Array.isArray(activity.explanation_levels) || activity.explanation_levels === null) throw new Error(`explanation_levels debe ser object`);
  if (typeof activity.explanation_levels.basic !== 'string') throw new Error(`explanation_levels.basic debe ser string`);
  if (typeof activity.explanation_levels.detailed !== 'string') throw new Error(`explanation_levels.detailed debe ser string`);
  if (typeof activity.explanation_levels.example !== 'string') throw new Error(`explanation_levels.example debe ser string`);
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

    // SANITIZAR Y VALIDAR
    const valid = [];
    for (const rawAct of rawActivities) {
      let act = sanitizeActivity(rawAct);
      const err = validateActivity(act);
      if (!err) valid.push(act);
    }

    // REINTENTAR SI FALTAN
    let retryAttempts = 0;
    while (valid.length < min && retryAttempts < 3) {
      retryAttempts++;
      const retryResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${prompt}\n\nNOTA: Solo necesito ${min - valid.length} actividades adicionales válidas.`,
        response_json_schema: { type: "object", properties: { activities: { type: "array", items: { type: "object" } } } }
      });
      const retryRaw = Array.isArray(retryResult) ? retryResult : (retryResult?.activities || []);
      for (const rawAct of retryRaw) {
        if (valid.length >= min) break;
        let act = sanitizeActivity(rawAct);
        if (!validateActivity(act)) valid.push(act);
      }
    }

    // FALLBACK: completar con actividades seguras si aún faltan
    if (valid.length < min) {
      const fallbackNeeded = min - valid.length;
      console.log(`Fallback activities generated: ${fallbackNeeded}`);
      const lessonTitleFallback = lesson_title || 'este tema';
      const fallbackTemplates = [
        {
          type: 'multiple_choice',
          question: `¿Cuál de las siguientes opciones está relacionada con "${lessonTitleFallback}"?`,
          options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
          correct_answer: 'Opción A', correct_answers: [],
          explanation: `Esta actividad refuerza el tema: ${lessonTitleFallback}.`,
          hints: ['Revisa el contenido de la lección'],
          difficulty: 'easy', points: 8,
        },
        {
          type: 'true_false',
          question: `El tema "${lessonTitleFallback}" es parte de esta materia.`,
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
          correct_answer: lessonTitleFallback, correct_answers: [],
          accepted_answers: [lessonTitleFallback],
          explanation: `El tema es "${lessonTitleFallback}".`,
          hints: ['Lee el título de la lección'],
          difficulty: 'easy', points: 8,
        },
      ];
      for (let f = 0; valid.length < min; f++) {
        valid.push({ ...fallbackTemplates[f % fallbackTemplates.length] });
      }
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

      const raw = {
        lesson_id,
        type: act.type,
        question: act.question,
        options: act.options || [],
        correct_answer: isArrayType ? '' : act.correct_answer,
        correct_answers: isArrayType ? act.correct_answers : [],
        accepted_answers: act.accepted_answers || [],
        explanation: act.explanation || '',
        explanation_levels: act.explanation_levels,
        incorrect_feedback: act.incorrect_feedback || null,
        hints: act.hints || [],
        difficulty: act.difficulty || 'medium',
        points: act.points || 10,
        order: i + 1,
        grading_type: 'auto',
        steps: act.type === 'step_by_step' ? (act.steps || []) : [],
        drag_items: act.type === 'drag_drop' ? (act.drag_items || []) : [],
        drop_targets: act.type === 'drag_drop' ? (act.drop_targets || []) : [],
      };

      const actData = normalizeForPersistence(raw);
      assertValidForPersistence(actData);

      console.log('FINAL_ACTIVITY_PAYLOAD', {
        type: actData.type,
        correct_answer_type: typeof actData.correct_answer,
        correct_answers_is_array: Array.isArray(actData.correct_answers),
        explanation_levels_type: typeof actData.explanation_levels,
        explanation_levels: actData.explanation_levels,
      });

      const newAct = await base44.asServiceRole.entities.CourseActivity.create(actData);
      created.push(newAct);
    }

    console.log(`Guardadas ${created.length} actividades para lección ${lesson_id}`);

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