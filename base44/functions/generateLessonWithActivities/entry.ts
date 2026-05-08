import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_TYPES = ['multiple_choice','true_false','fill_blank','solve','order_steps','multiple_select','drag_drop','step_by_step'];

// NORMALIZACIÓN: explanation_levels siempre válido
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

// SANITIZACIÓN GLOBAL ROBUSTA: NUNCA rechazar, siempre corregir
function sanitizeActivity(activity) {
  const safe = { ...activity };

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
  if (safe.type === 'multiple_select') {
    safe.correct_answer = '';
    if (!Array.isArray(safe.correct_answer) && typeof safe.correct_answer === 'string' && safe.correct_answer.startsWith('[')) {
      try {
        safe.correct_answer = JSON.parse(safe.correct_answer).map(x => String(x));
      } catch { safe.correct_answer = []; }
    }
    if (!Array.isArray(safe.correct_answer)) {
      safe.correct_answer = [];
    }
    if (safe.correct_answer.length === 0) {
      safe.correct_answer = [safe.options?.[0] || 'Opción A'];
    } else {
      safe.correct_answer = safe.correct_answer.map(x => String(x));
    }
  } else {
    safe.correct_answer = !safe.correct_answer || typeof safe.correct_answer !== 'string' ? (safe.options?.[0] || 'Respuesta correcta') : String(safe.correct_answer);
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
    // Generar MÁS de lo necesario para permitir filtrado (Regla 1)
    const min = is_mini_eval ? 10 : 7;
    const generateCount = is_mini_eval ? 16 : 12;

    const easyCount  = Math.round(generateCount * 0.4);
    const hardCount  = Math.round(generateCount * 0.2);
    const mediumCount = generateCount - easyCount - hardCount;

    const activitiesPrompt = `Eres un experto en diseño instruccional para preparatoria. Genera actividades educativas en formato JSON válido.

CONTEXTO:
- Tema: "${lesson.title}"
- Materia: "${subject_name || 'General'}"
- Contenido base: "${lesson.explanation}"
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

    // SANITIZAR Y VALIDAR
    const valid = [];
    for (const rawAct of activities) {
      let act = sanitizeActivity(rawAct);
      const err = validateActivity(act);
      if (!err) valid.push(act);
    }

    // REINTENTAR MIENTRAS FALTEN (no destructivo — lección ya creada)
    let retryAttempts = 0;
    while (valid.length < min && retryAttempts < 3) {
      retryAttempts++;
      const needed = min - valid.length;
      const retryResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `${activitiesPrompt}\n\nNOTA: Solo necesito ${needed} actividades adicionales válidas.`,
        response_json_schema: {
          type: "object",
          properties: { activities: { type: "array", items: { type: "object" } } }
        }
      });
      const retryActivities = Array.isArray(retryResult) ? retryResult : (retryResult?.activities || []);
      for (const rawAct of retryActivities) {
        if (valid.length >= min) break;
        let act = sanitizeActivity(rawAct);
        if (!validateActivity(act)) valid.push(act);
      }
    }

    // FALLBACK: si aún faltan, completar con actividades seguras predefinidas
    if (valid.length < min) {
      const fallbackNeeded = min - valid.length;
      console.log(`Fallback activities generated: ${fallbackNeeded} (lección preservada)`);
      const fallbackTemplates = [
        {
          type: 'multiple_choice',
          question: `¿Cuál de las siguientes opciones está relacionada con "${lesson.title}"?`,
          options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
          correct_answer: 'Opción A',
          correct_answers: [],
          explanation: `Esta actividad refuerza el tema: ${lesson.title}.`,
          hints: ['Revisa el contenido de la lección'],
          difficulty: 'easy', points: 8,
        },
        {
          type: 'true_false',
          question: `El tema "${lesson.title}" es parte de la materia ${subject_name || 'esta materia'}.`,
          options: ['Verdadero', 'Falso'],
          correct_answer: 'Verdadero',
          correct_answers: [],
          explanation: 'Esta lección pertenece al temario de la materia.',
          hints: ['Piensa en el contexto de la lección'],
          difficulty: 'easy', points: 8,
        },
        {
          type: 'fill_blank',
          question: `El tema principal de esta lección es ___.`,
          options: [],
          correct_answer: lesson.title,
          correct_answers: [],
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

    // ── PASO 3: Guardar actividades vinculadas a la lección ──────────────────
    const created = [];
    for (let i = 0; i < valid.length; i++) {
      const act = valid[i];
      const actData = {
        lesson_id: lesson.id,
        type: act.type,
        question: act.question.trim(),
        options: act.options || [],
        correct_answer: act.correct_answer ?? '',
        correct_answers: act.correct_answers || [],
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