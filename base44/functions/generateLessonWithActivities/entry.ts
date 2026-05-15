import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_TYPES = ['multiple_choice','true_false','fill_blank','solve','order_steps','multiple_select','drag_drop','step_by_step'];

// NORMALIZACIÓN: explanation_levels — solo basic, detailed/example on-demand
function normalizeExplanationLevels(raw, question) {
  const basicFallback = `La respuesta correcta es la indicada.`;
  const basic = (raw && typeof raw === 'object' && !Array.isArray(raw) && typeof raw.basic === 'string' && raw.basic.trim())
    ? raw.basic
    : (typeof raw === 'string' && raw.trim() ? raw : basicFallback);
  return { basic, detailed: '', example: '' };
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

  // --- HINTS — vacío por defecto, se generan on-demand ---
  safe.hints = [];

  // --- EXPLANATION & LEVELS — solo basic, detailed/example on-demand ---
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

  // --- FEEDBACK — on-demand, no se pregena ---
  safe.incorrect_feedback = null;

  return safe;
}

// ─── CAPA FINAL: normalizeForPersistence ─────────────────────────────────────
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

  // --- explanation_levels — solo basic, detailed/example on-demand ---
  const expl = a.explanation || a.question || 'Explicación no disponible';
  if (!a.explanation_levels || Array.isArray(a.explanation_levels)) {
    a.explanation_levels = { basic: expl, detailed: '', example: '' };
  } else if (typeof a.explanation_levels === 'string') {
    a.explanation_levels = { basic: a.explanation_levels, detailed: '', example: '' };
  } else if (typeof a.explanation_levels === 'object') {
    a.explanation_levels = {
      basic: typeof a.explanation_levels.basic === 'string' && a.explanation_levels.basic.trim() ? a.explanation_levels.basic : expl,
      detailed: '',
      example: '',
    };
  } else {
    a.explanation_levels = { basic: expl, detailed: '', example: '' };
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

    // ─── Tipos de visual_blocks permitidos ───────────────────────────────────
    const VALID_VB_TYPES = ['table', 'comparison', 'steps', 'equation', 'flow', 'timeline', 'map'];
    function normalizeVisualBlock(vb) {
      if (!vb || typeof vb !== 'object' || !VALID_VB_TYPES.includes(vb.type)) return null;
      const b = { type: vb.type, title: String(vb.title || '') };
      if (vb.type === 'table') {
        if (!Array.isArray(vb.headers) || !Array.isArray(vb.rows)) return null;
        b.headers = vb.headers.map(String);
        b.rows = vb.rows.filter(Array.isArray).map(r => r.map(String));
      } else if (vb.type === 'comparison') {
        if (!Array.isArray(vb.left_items) || !Array.isArray(vb.right_items)) return null;
        b.left_title = String(vb.left_title || ''); b.right_title = String(vb.right_title || '');
        b.left_items = vb.left_items.map(String); b.right_items = vb.right_items.map(String);
      } else if (vb.type === 'steps') {
        if (!Array.isArray(vb.items) || vb.items.length < 2) return null;
        b.items = vb.items.map(String);
      } else if (vb.type === 'equation') {
        if (!Array.isArray(vb.equations) || vb.equations.length === 0) return null;
        b.equations = vb.equations.map(String);
      } else if (vb.type === 'flow') {
        if (!Array.isArray(vb.steps) || vb.steps.length < 2) return null;
        b.steps = vb.steps.map(String);
      } else if (vb.type === 'timeline') {
        if (!Array.isArray(vb.events) || vb.events.length === 0) return null;
        b.events = vb.events.map(e => ({ year: String(e.year || ''), event: String(e.event || '') }));
      } else if (vb.type === 'map') {
        if (!Array.isArray(vb.nodes) || vb.nodes.length === 0) return null;
        b.nodes = vb.nodes.map(n => ({ label: String(n.label || ''), connects_to: Array.isArray(n.connects_to) ? n.connects_to.map(String) : [] }));
      }
      return b;
    }

    // ── PASO 1: Generar contenido de la lección ──────────────────────────────
    const lessonPrompt = `Eres un experto en diseño instruccional para preparatoria mexicana. Crea el contenido teórico completo para una lección.

MÓDULO ID: ${module_id}
TEMA: "${topic}"
MATERIA: "${subject_name || 'General'}"
TIPO: ${is_mini_eval ? 'MINI EVALUACIÓN (resumen y refuerzo del módulo)' : 'LECCIÓN NORMAL (enseñanza nueva)'}

Genera un JSON con la siguiente estructura:
{
  "title": "Título claro y específico (máximo 8 palabras)",
  "explanation": {
    "intro": "Introducción breve de 1-2 oraciones.",
    "key_points": [
      { "title": "Subtema", "content": "Explicación clara.", "example": "Ejemplo corto." }
    ],
    "examples": [
      { "question": "Ejercicio práctico", "solution": "Resolución." }
    ],
    "visual_blocks": [],
    "summary": "Resumen final de 1-2 oraciones."
  }
}

REGLAS:
- key_points: 3 a 6 elementos con title, content y example.
- Para matemáticas/física usa LaTeX dentro de $...$: $x^2$, $\\frac{a}{b}$, $\\mathbb{N}$.
- visual_blocks: OPCIONAL. Máximo 2. SOLO si aportan valor pedagógico real. Array vacío [] si no aplica.
  Tipos permitidos: table, comparison, steps, equation, flow, timeline, map.
  Adaptar al tipo de materia: matemáticas→equation/steps, historia→timeline/comparison, química/biología→flow/table, economía→comparison/table.
  Formatos:
  - table: {"type":"table","title":"...","headers":["col1","col2"],"rows":[["v1","v2"]]}
  - comparison: {"type":"comparison","title":"...","left_title":"...","right_title":"...","left_items":["..."],"right_items":["..."]}
  - steps: {"type":"steps","title":"...","items":["paso 1","paso 2"]}
  - equation: {"type":"equation","title":"...","equations":["2x+5=15","x=5"]}
  - flow: {"type":"flow","title":"...","steps":["Entrada","Proceso","Resultado"]}
  - timeline: {"type":"timeline","title":"...","events":[{"year":"1800","event":"..."}]}
  - map: {"type":"map","title":"...","nodes":[{"label":"...","connects_to":["..."]}]}
- Solo JSON válido. Sin HTML, markdown ni texto extra.`;

    const lessonResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: lessonPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          explanation: {
            type: "object",
            properties: {
              intro: { type: "string" },
              key_points: { type: "array", items: { type: "object" } },
              examples: { type: "array", items: { type: "object" } },
              visual_blocks: { type: "array", items: { type: "object" } },
              summary: { type: "string" }
            }
          }
        },
        required: ["title", "explanation"]
      }
    });

    if (!lessonResult?.title || !lessonResult?.explanation) {
      return Response.json({ error: 'El LLM no generó contenido válido para la lección' }, { status: 500 });
    }

    // Normalizar explanation con visual_blocks validados
    const rawExpl = lessonResult.explanation;
    const explanation = {
      intro: String(rawExpl.intro || ''),
      key_points: Array.isArray(rawExpl.key_points) ? rawExpl.key_points.map(kp => ({
        title: String(kp.title || ''), content: String(kp.content || ''), example: String(kp.example || ''),
      })) : [],
      examples: Array.isArray(rawExpl.examples) ? rawExpl.examples.map(ex => ({
        question: String(ex.question || ''), solution: String(ex.solution || ''),
      })) : [],
      visual_blocks: Array.isArray(rawExpl.visual_blocks)
        ? rawExpl.visual_blocks.map(normalizeVisualBlock).filter(Boolean).slice(0, 2)
        : [],
      summary: String(rawExpl.summary || ''),
    };

    // Guardar la lección
    const lesson = await base44.asServiceRole.entities.CourseLesson.create({
      module_id,
      subject_id: subject_id || '',
      title: lessonResult.title,
      explanation,
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
- explanation: string corto con la explicación básica (1-2 oraciones).
- explanation_levels: SOLO incluir {basic: "..."} — NO generar detailed ni example.
- NO incluir hints ni incorrect_feedback.
- points: easy=8, medium=10, hard=14.

EJEMPLOS DE REFERENCIA:
{"type":"multiple_choice","question":"¿Cuánto es 3 + 5?","options":["6","7","8","9"],"correct_answer":"8","explanation":"3 + 5 = 8","explanation_levels":{"basic":"Al sumar 3 y 5 obtenemos 8."},"difficulty":"easy","points":8}
{"type":"multiple_select","question":"Selecciona los números primos","options":["2","3","4","5"],"correct_answer":["2","3","5"],"explanation":"2, 3 y 5 son primos","explanation_levels":{"basic":"Un número primo solo es divisible entre 1 y sí mismo."},"difficulty":"medium","points":10}
{"type":"true_false","question":"5 es un número par","correct_answer":"false","explanation":"5 no es divisible entre 2","explanation_levels":{"basic":"Los números pares son divisibles entre 2. El 5 no lo es."},"difficulty":"easy","points":8}
{"type":"fill_blank","question":"Completa: 7 + 3 = ___","accepted_answers":["10"],"explanation":"7 + 3 = 10","explanation_levels":{"basic":"Al sumar 7 y 3 el resultado es 10."},"difficulty":"easy","points":8}
{"type":"drag_drop","question":"Relaciona cada número con su tipo","drag_items":["2","-3","1/2"],"drop_targets":["Natural","Entero","Racional"],"correct_answer":"{\\"Natural\\":\\"2\\",\\"Entero\\":\\"-3\\",\\"Racional\\":\\"1/2\\"}","explanation":"2 es natural, -3 es entero, 1/2 es racional","explanation_levels":{"basic":"Cada número pertenece a un conjunto específico según sus características."},"difficulty":"medium","points":10}
{"type":"step_by_step","question":"Resuelve: 2 + 3 × 4","steps":[{"instruction":"Multiplica 3 × 4","answer":"12","hint":"Primero multiplicación"},{"instruction":"Suma 2 + 12","answer":"14","hint":"Ahora la suma"}],"correct_answer":"step_by_step","explanation":"Resultado: 14","explanation_levels":{"basic":"Se resuelve siguiendo la jerarquía de operaciones: primero multiplicación, luego suma."},"difficulty":"medium","points":10}

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
      const isArrayType = ARRAY_TYPES.includes(act.type);
      const raw = {
        lesson_id: lesson.id,
        type: act.type,
        question: act.question,
        options: act.options || [],
        correct_answer: isArrayType ? '' : (act.correct_answer ?? ''),
        correct_answers: isArrayType ? (act.correct_answers || []) : [],
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