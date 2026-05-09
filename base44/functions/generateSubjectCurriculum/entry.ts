import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_TYPES = ['multiple_choice','true_false','fill_blank','solve','order_steps','multiple_select','drag_drop','step_by_step'];
const ARRAY_ANSWER_TYPES = ['multiple_select', 'order_steps'];
// Tipos seguros para fallback (sin drag_drop, step_by_step, multiple_select)
const FALLBACK_TYPES = ['multiple_choice', 'true_false', 'fill_blank'];

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

// ─── SANITIZACIÓN GLOBAL ROBUSTA ─────────────────────────────────────────────
function sanitizeActivity(activity) {
  const safe = { ...activity };

  if (!safe.type || !VALID_TYPES.includes(safe.type)) safe.type = 'multiple_choice';
  if (!safe.question || typeof safe.question !== 'string') safe.question = 'Selecciona la respuesta correcta';

  if (['multiple_choice', 'multiple_select', 'order_steps'].includes(safe.type)) {
    if (!Array.isArray(safe.options) || safe.options.length < 2) safe.options = ['Opción A', 'Opción B', 'Opción C', 'Opción D'];
  } else {
    safe.options = Array.isArray(safe.options) ? safe.options : [];
  }

  if (ARRAY_ANSWER_TYPES.includes(safe.type)) {
    safe.correct_answer = '';
    if (!Array.isArray(safe.correct_answers) || safe.correct_answers.length === 0) {
      safe.correct_answers = [safe.options?.[0] || 'Opción A'];
    } else {
      safe.correct_answers = safe.correct_answers.map(x => String(x));
    }
  } else {
    safe.correct_answers = [];
    if (!safe.correct_answer || typeof safe.correct_answer !== 'string') {
      safe.correct_answer = safe.options?.[0] || 'Respuesta correcta';
    }
  }

  safe.accepted_answers = Array.isArray(safe.accepted_answers) ? safe.accepted_answers.map(a => String(a)) : [];
  safe.hints = Array.isArray(safe.hints) ? safe.hints.filter(h => h) : [];

  if (!safe.explanation || typeof safe.explanation !== 'string') safe.explanation = safe.question;
  safe.explanation_levels = normalizeExplanationLevels(safe.explanation_levels, safe.question);

  if (safe.type === 'step_by_step') {
    if (!Array.isArray(safe.steps) || safe.steps.length < 2) {
      safe.steps = [{ instruction: 'Paso 1', answer: 'respuesta 1', hint: 'pista 1' }, { instruction: 'Paso 2', answer: 'respuesta 2', hint: 'pista 2' }];
    }
  } else {
    safe.steps = [];
  }

  if (safe.type === 'drag_drop') {
    if (!Array.isArray(safe.drag_items) || safe.drag_items.length < 2) safe.drag_items = ['A', 'B', 'C'];
    if (!Array.isArray(safe.drop_targets) || safe.drop_targets.length < 2) safe.drop_targets = ['1', '2', '3'];
  } else {
    safe.drag_items = [];
    safe.drop_targets = [];
  }

  if (!['easy', 'medium', 'hard'].includes(safe.difficulty)) safe.difficulty = 'medium';
  if (typeof safe.points !== 'number' || safe.points < 0) {
    safe.points = { easy: 8, medium: 10, hard: 14 }[safe.difficulty] || 10;
  }
  safe.incorrect_feedback = typeof safe.incorrect_feedback === 'object' ? safe.incorrect_feedback : null;

  return safe;
}

// ─── NORMALIZACIÓN PARA PERSISTENCIA ─────────────────────────────────────────
function normalizeForPersistence(activity) {
  const a = { ...activity };
  const isArrayType = ARRAY_ANSWER_TYPES.includes(a.type);

  if (!a.question || typeof a.question !== 'string') a.question = 'Pregunta no disponible';

  if (isArrayType) {
    a.correct_answer = '';
  } else {
    if (a.correct_answer === null || a.correct_answer === undefined) a.correct_answer = '';
    else if (Array.isArray(a.correct_answer)) a.correct_answer = a.correct_answer.length > 0 ? String(a.correct_answer[0]) : '';
    else if (typeof a.correct_answer === 'object') a.correct_answer = JSON.stringify(a.correct_answer);
    else a.correct_answer = String(a.correct_answer);
  }

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

  if (!Array.isArray(a.options)) a.options = [];
  else a.options = a.options.map(String).filter(Boolean);

  if (!Array.isArray(a.hints)) a.hints = [];
  else a.hints = a.hints.map(String).filter(Boolean);

  if (!Array.isArray(a.steps)) a.steps = [];
  if (!Array.isArray(a.drag_items)) a.drag_items = [];
  else a.drag_items = a.drag_items.map(String).filter(Boolean);
  if (!Array.isArray(a.drop_targets)) a.drop_targets = [];
  else a.drop_targets = a.drop_targets.map(String).filter(Boolean);

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

function validateActivity(act) {
  if (!act.question?.toString().trim()) return 'question vacío';
  if (!VALID_TYPES.includes(act.type)) return `tipo inválido: ${act.type}`;

  const isArrayType = ARRAY_ANSWER_TYPES.includes(act.type);
  if (isArrayType && act.correct_answer && act.correct_answer.trim() !== '') return `correct_answer debe estar vacío para tipo ${act.type}`;
  if (!isArrayType && Array.isArray(act.correct_answers) && act.correct_answers.length > 0) return `correct_answers debe estar vacío para tipo ${act.type}`;

  if (act.type === 'multiple_choice') {
    if (!Array.isArray(act.options) || act.options.length < 2) return 'options insuficientes';
    if (typeof act.correct_answer !== 'string' || act.correct_answer.trim() === '') return 'correct_answer debe ser string no vacío';
  }
  if (act.type === 'multiple_select') {
    if (!Array.isArray(act.options) || act.options.length < 2) return 'options insuficientes';
    if (!Array.isArray(act.correct_answers) || act.correct_answers.length === 0) return 'correct_answers vacío';
  }
  if (act.type === 'order_steps') {
    if (!Array.isArray(act.options) || act.options.length < 2) return 'options insuficientes';
    if (!Array.isArray(act.correct_answers) || act.correct_answers.length === 0) return 'correct_answers vacío';
  }
  if (act.type === 'true_false') {
    const ca = act.correct_answer?.toString().toLowerCase();
    if (!['verdadero','falso','true','false'].includes(ca)) return `correct_answer inválido: ${ca}`;
  }
  if (act.type === 'fill_blank' || act.type === 'solve') {
    if (!act.correct_answer && (!Array.isArray(act.accepted_answers) || act.accepted_answers.length === 0)) return 'correct_answer requerido';
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function updateProgress(base44, genId, patch) {
  try {
    const records = await base44.asServiceRole.entities.CurriculumGeneration.filter({ generation_id: genId });
    if (records[0]) await base44.asServiceRole.entities.CurriculumGeneration.update(records[0].id, patch);
  } catch (e) {
    console.warn('updateProgress error:', e.message);
  }
}

async function appendLog(base44, genId, currentLogs, message) {
  const logs = [...(currentLogs || []), `[${new Date().toISOString()}] ${message}`].slice(-80);
  await updateProgress(base44, genId, { logs });
  console.log(message);
  return logs;
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[LLM_TIMEOUT] "${label}" superó ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Retry inteligente con backoff ────────────────────────────────────────────
async function withRetry(fn, maxAttempts, label, logFn) {
  const delays = [0, 3000, 6000];
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      const delayMs = delays[attempt - 1] || 6000;
      await logFn(`[LLM_RETRY] Attempt ${attempt}/${maxAttempts} for "${label}" (waiting ${delayMs / 1000}s...)`);
      await sleep(delayMs);
    }
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isTimeout = err.message?.includes('LLM_TIMEOUT') || err.message?.includes('TIMEOUT');
      await logFn(`[LLM_RETRY] ${isTimeout ? '[LLM_TIMEOUT]' : 'Error'} on attempt ${attempt}/${maxAttempts} for "${label}": ${err.message}`);
    }
  }
  throw lastErr;
}

// ─── Crear actividades fallback mínimas (sin LLM) ────────────────────────────
function buildFallbackActivities(lessonTitle, subjectName, count = 5) {
  const templates = [
    {
      type: 'multiple_choice',
      question: `¿Cuál de las siguientes opciones describe mejor el tema "${lessonTitle}"?`,
      options: [`Concepto central de ${lessonTitle}`, `No pertenece a ${subjectName}`, `Definición incorrecta`, `Ninguna de las anteriores`],
      correct_answer: `Concepto central de ${lessonTitle}`,
      correct_answers: [],
      explanation: `Esta actividad refuerza los conceptos básicos del tema: ${lessonTitle}.`,
      hints: ['Revisa el contenido explicativo de la lección'],
      difficulty: 'easy', points: 8,
    },
    {
      type: 'true_false',
      question: `El tema "${lessonTitle}" forma parte del programa de ${subjectName}.`,
      options: ['Verdadero', 'Falso'],
      correct_answer: 'Verdadero',
      correct_answers: [],
      explanation: `Correcto. Esta lección pertenece al temario de ${subjectName}.`,
      hints: ['Piensa en el contexto de la materia'],
      difficulty: 'easy', points: 8,
    },
    {
      type: 'fill_blank',
      question: `El tema principal de esta lección es ___.`,
      options: [],
      correct_answer: lessonTitle,
      correct_answers: [],
      accepted_answers: [lessonTitle],
      explanation: `El tema es "${lessonTitle}".`,
      hints: ['Lee el título de la lección'],
      difficulty: 'easy', points: 8,
    },
    {
      type: 'multiple_choice',
      question: `¿A qué materia pertenece el tema "${lessonTitle}"?`,
      options: [subjectName, 'Matemáticas', 'Historia', 'Química'],
      correct_answer: subjectName,
      correct_answers: [],
      explanation: `"${lessonTitle}" es un tema de ${subjectName}.`,
      hints: ['Recuerda en qué materia estás estudiando'],
      difficulty: 'easy', points: 8,
    },
    {
      type: 'true_false',
      question: `Es importante estudiar "${lessonTitle}" para comprender ${subjectName}.`,
      options: ['Verdadero', 'Falso'],
      correct_answer: 'Verdadero',
      correct_answers: [],
      explanation: `Sí, este tema es esencial para el dominio de ${subjectName}.`,
      hints: ['Considera la importancia del tema en la materia'],
      difficulty: 'easy', points: 8,
    },
  ];

  const result = [];
  for (let i = 0; result.length < count; i++) {
    result.push({ ...templates[i % templates.length] });
  }
  return result;
}

// ─── Guardar actividades en DB ────────────────────────────────────────────────
async function persistActivities(base44, lessonId, activities) {
  let count = 0;
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    const isArrayType = ARRAY_ANSWER_TYPES.includes(act.type);
    const raw = {
      lesson_id: lessonId,
      type: act.type,
      question: act.question,
      options: act.options || [],
      correct_answer: isArrayType ? '' : (act.correct_answer || ''),
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
    await base44.asServiceRole.entities.CourseActivity.create(actData);
    count++;
  }
  return count;
}

// ─── Generar lección completa con retry inteligente ───────────────────────────
async function generateLessonBlock(base44, { module_id, subject_id, subject_name, topic, is_mini_eval, lesson_order, difficulty = 'medium', keywords = [] }, logFn) {
  const keywordsHint = keywords.length ? `\nPalabras clave a incluir: ${keywords.join(', ')}` : '';
  const difficultyHint = { easy: 'introductoria y accesible', medium: 'intermedia con ejemplos aplicados', hard: 'avanzada con razonamiento profundo' }[difficulty] || 'intermedia';

  // ── LLM #1: Contenido teórico — con retry 3 intentos ──
  const lessonResult = await withRetry(
    () => withTimeout(
      base44.asServiceRole.integrations.Core.InvokeLLM({
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
      }),
      90000,
      `LLM lesson content — ${topic}`
    ),
    3,
    `lesson content — ${topic}`,
    logFn
  );

  if (!lessonResult?.title || !lessonResult?.explanation) throw new Error('LLM no generó contenido válido para la lección');

  const lesson = await base44.asServiceRole.entities.CourseLesson.create({
    module_id,
    subject_id,
    title: lessonResult.title,
    explanation: lessonResult.explanation,
    order: lesson_order,
    is_mini_eval,
  });
  console.log(`[DEBUG] DB lesson created: "${lesson.title}"`);

  // ── LLM #2: Actividades con retry ──
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
- multiple_select: correct_answers = ARRAY de textos correctos. NO usar correct_answer.
- order_steps: options=pasos MEZCLADOS, correct_answers=ARRAY en ORDEN CORRECTO. NO usar correct_answer.
- drag_drop: drag_items=items mezclados, drop_targets=etiquetas, correct_answer=JSON object target→item.
- step_by_step: steps=[{instruction,answer,hint}], correct_answer="step_by_step".
CALIDAD: explanation_levels {basic,detailed,example}, incorrect_feedback {default:...}, hints (max 1), points: easy=8, medium=10, hard=14.
Matemáticas: usa LaTeX dentro de $...$.
REGLA CRÍTICA: NUNCA incluir ambos campos correct_answer y correct_answers en la misma actividad.
Devuelve SOLO JSON con campo "activities": array de ${count} objetos.`;

  const valid = [];

  // Intento principal con retry
  let activitiesRaw = null;
  try {
    activitiesRaw = await withRetry(
      () => withTimeout(
        base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: activitiesPrompt,
          response_json_schema: { type: "object", properties: { activities: { type: "array", items: { type: "object" } } } }
        }),
        90000,
        `LLM activities — ${lesson.title}`
      ),
      3,
      `activities — ${lesson.title}`,
      logFn
    );
  } catch (e) {
    await logFn(`[FALLBACK_MODE] LLM activities fallaron para "${lesson.title}" tras 3 intentos: ${e.message}`);
  }

  if (activitiesRaw) {
    const rawList = Array.isArray(activitiesRaw) ? activitiesRaw : (activitiesRaw?.activities || []);
    for (const rawAct of rawList) {
      const act = sanitizeActivity(rawAct);
      if (!validateActivity(act)) valid.push(act);
    }
  }

  // Reintento adicional si faltan
  if (valid.length < min && activitiesRaw) {
    const needed = min - valid.length;
    await logFn(`[LLM_RETRY] Need ${needed} more activities for "${lesson.title}", attempting supplement...`);
    try {
      const supplement = await withRetry(
        () => withTimeout(
          base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `${activitiesPrompt}\n\nNecesito SOLO ${needed} actividades adicionales válidas. Devuelve JSON con "activities": [...]`,
            response_json_schema: { type: "object", properties: { activities: { type: "array", items: { type: "object" } } } }
          }),
          90000,
          `LLM supplement activities — ${lesson.title}`
        ),
        2,
        `supplement activities — ${lesson.title}`,
        logFn
      );
      const suppList = Array.isArray(supplement) ? supplement : (supplement?.activities || []);
      for (const rawAct of suppList) {
        if (valid.length >= min) break;
        const act = sanitizeActivity(rawAct);
        if (!validateActivity(act)) valid.push(act);
      }
    } catch (e) {
      await logFn(`[LLM_RETRY] Supplement also failed for "${lesson.title}": ${e.message}`);
    }
  }

  // Completar con fallback si aún faltan
  if (valid.length < min) {
    const needed = min - valid.length;
    const fallbacks = buildFallbackActivities(lesson.title, subject_name, needed);
    for (const fb of fallbacks) valid.push(fb);
    await logFn(`[FALLBACK_CREATED] Added ${needed} fallback activities for "${lesson.title}" (total: ${valid.length})`);
  }

  const activitiesCreated = await persistActivities(base44, lesson.id, valid);
  await logFn(`[LESSON_COMPLETED] "${lesson.title}" — ${activitiesCreated} activities persisted`);

  return { lesson, activities_count: activitiesCreated };
}

// ─── Crear lección fallback completa (sin LLM) cuando todo falla ─────────────
async function createFallbackLesson(base44, { module_id, subject_id, subject_name, topic, is_mini_eval, lesson_order }, logFn) {
  await logFn(`[FALLBACK_MODE] Creating minimal fallback lesson for "${topic}"`);

  const lesson = await base44.asServiceRole.entities.CourseLesson.create({
    module_id,
    subject_id,
    title: topic,
    explanation: `Esta lección cubre el tema "${topic}" dentro de ${subject_name}. El contenido detallado será enriquecido próximamente.`,
    order: lesson_order,
    is_mini_eval,
  });

  const fallbackActivities = buildFallbackActivities(topic, subject_name, 5);
  const activitiesCreated = await persistActivities(base44, lesson.id, fallbackActivities);

  await logFn(`[FALLBACK_CREATED] Fallback lesson "${topic}" created with ${activitiesCreated} basic activities`);
  return { lesson, activities_count: activitiesCreated, is_fallback: true };
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

    const subjects = await base44.asServiceRole.entities.Subject.filter({ id: subject_id });
    const subject = subjects[0];
    if (!subject) return Response.json({ error: 'Materia no encontrada' }, { status: 404 });

    const syllabuses = await base44.asServiceRole.entities.SubjectSyllabus.filter({ subject_id, is_active: true });
    const syllabus = syllabuses[0];
    if (!syllabus || !syllabus.units?.length) {
      return Response.json({
        error: 'Esta materia no tiene un temario activo. Define el temario primero desde el panel de administración.',
        no_syllabus: true
      }, { status: 422 });
    }

    if (!overwrite) {
      const existingUnits = await base44.asServiceRole.entities.CourseUnit.filter({ subject_id });
      if (existingUnits.length > 0) {
        return Response.json({
          error: `La materia ya tiene ${existingUnits.length} unidades. Usa overwrite=true para sobreescribir.`,
          has_content: true
        }, { status: 409 });
      }
    }

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

    const responsePayload = { success: true, generation_id: genId, record_id: genRecord.id };

    // ── Background: fire and forget ───────────────────────────────────────────
    (async () => {
      let logs = [];
      const log = async (msg) => { logs = await appendLog(base44, genId, logs, msg); };
      const startTime = Date.now();

      try {
        await log(`🚀 Iniciando generación de currículo para "${subject.name}" (Nivel ${subject.level})`);
        await log(`📋 Usando temario v${syllabus.version} como base`);
        await updateProgress(base44, genId, { current_module: 'Leyendo temario...', progress_percent: 2 });

        const blueprint = { units: syllabus.units };

        let totalLessons = 0;
        for (const unit of blueprint.units) {
          for (const mod of (unit.modules || [])) totalLessons += (mod.lessons || []).length;
        }

        await updateProgress(base44, genId, { blueprint, total_steps: totalLessons, progress_percent: 5 });
        await log(`✅ Blueprint listo: ${blueprint.units.length} unidades, ${totalLessons} lecciones planificadas`);

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

        // ── Contadores ────────────────────────────────────────────────────────
        let completedSteps = 0;
        let totalUnitsCreated = 0;
        let totalModulesCreated = 0;
        let totalLessonsCreated = 0;
        let totalActivitiesCreated = 0;
        let normalLessons = 0;
        let fallbackLessons = 0;
        let failedLessons = 0;
        const lessonTimes = [];

        for (const unitBlueprint of blueprint.units) {
          await log(`📦 Creando Unidad ${unitBlueprint.order}: "${unitBlueprint.title}"`);

          const unit = await base44.asServiceRole.entities.CourseUnit.create({
            subject_id,
            title: unitBlueprint.title,
            order: unitBlueprint.order,
          });
          totalUnitsCreated++;

          for (const modBlueprint of (unitBlueprint.modules || [])) {
            await log(`  📁 Módulo ${modBlueprint.order}: "${modBlueprint.title}"`);

            const module = await base44.asServiceRole.entities.CourseModule.create({
              unit_id: unit.id,
              subject_id,
              title: modBlueprint.title,
              order: modBlueprint.order,
            });
            totalModulesCreated++;

            for (const lessonBlueprint of (modBlueprint.lessons || [])) {
              await updateProgress(base44, genId, {
                current_module: modBlueprint.title,
                current_lesson: lessonBlueprint.topic,
                completed_steps: completedSteps,
                progress_percent: Math.round(5 + (completedSteps / totalLessons) * 90),
                lessons_created: totalLessonsCreated,
                activities_created: totalActivitiesCreated,
                modules_created: totalModulesCreated,
                units_created: totalUnitsCreated,
              });

              await log(`    📝 Lección ${lessonBlueprint.order}: "${lessonBlueprint.topic}" ${lessonBlueprint.is_mini_eval ? '(mini-eval)' : ''}`);
              const t0_lesson = Date.now();
              let result = null;
              let isFallback = false;

              try {
                result = await withTimeout(
                  generateLessonBlock(base44, {
                    module_id: module.id,
                    subject_id,
                    subject_name: subject.name,
                    topic: lessonBlueprint.topic,
                    is_mini_eval: lessonBlueprint.is_mini_eval || false,
                    lesson_order: lessonBlueprint.order,
                    difficulty: lessonBlueprint.difficulty || 'medium',
                    keywords: lessonBlueprint.keywords || [],
                  }, log),
                  300000,
                  `generateLessonBlock — ${lessonBlueprint.topic}`
                );
                if (result.is_fallback) {
                  isFallback = true;
                  fallbackLessons++;
                } else {
                  normalLessons++;
                }
              } catch (lessonErr) {
                const isTimeout = lessonErr.message?.includes('LLM_TIMEOUT') || lessonErr.message?.includes('TIMEOUT');
                await log(`    ${isTimeout ? '[LLM_TIMEOUT]' : '❌'} Error en lección "${lessonBlueprint.topic}": ${lessonErr.message}`);

                // Último recurso: fallback lesson sin LLM
                try {
                  result = await createFallbackLesson(base44, {
                    module_id: module.id,
                    subject_id,
                    subject_name: subject.name,
                    topic: lessonBlueprint.topic,
                    is_mini_eval: lessonBlueprint.is_mini_eval || false,
                    lesson_order: lessonBlueprint.order,
                  }, log);
                  isFallback = true;
                  fallbackLessons++;
                } catch (fallbackErr) {
                  await log(`    ❌ Fallback también falló para "${lessonBlueprint.topic}": ${fallbackErr.message}`);
                  failedLessons++;
                }
              }

              const lessonDuration = Date.now() - t0_lesson;
              lessonTimes.push(lessonDuration);

              if (result) {
                totalLessonsCreated++;
                totalActivitiesCreated += result.activities_count;
                completedSteps++;

                const progressPercent = Math.round(5 + (completedSteps / totalLessons) * 90);
                await updateProgress(base44, genId, {
                  completed_steps: completedSteps,
                  progress_percent: progressPercent,
                  lessons_created: totalLessonsCreated,
                  activities_created: totalActivitiesCreated,
                });

                await log(`[CURRICULUM_PROGRESS] ${completedSteps}/${totalLessons} lecciones — ${progressPercent}% (${isFallback ? 'fallback' : 'normal'}, ${(lessonDuration / 1000).toFixed(1)}s)`);
              } else {
                completedSteps++;
              }
            }

            const modLessons = (modBlueprint.lessons || []).length;
            await log(`  ✅ Módulo "${modBlueprint.title}" completado (${modLessons} lecciones)`);
          }
        }

        // ── Métricas finales ──────────────────────────────────────────────────
        const totalDuration = Date.now() - startTime;
        const avgTime = lessonTimes.length > 0 ? Math.round(lessonTimes.reduce((a, b) => a + b, 0) / lessonTimes.length / 1000) : 0;

        await updateProgress(base44, genId, {
          status: 'completed',
          progress_percent: 100,
          completed_steps: completedSteps,
          total_steps: totalLessons,
          current_module: '',
          current_lesson: '',
          units_created: totalUnitsCreated,
          modules_created: totalModulesCreated,
          lessons_created: totalLessonsCreated,
          activities_created: totalActivitiesCreated,
        });

        await log(`🎉 ============ GENERACIÓN COMPLETADA ============`);
        await log(`📊 Total lessons: ${totalLessonsCreated}`);
        await log(`✅ Generated normally: ${normalLessons}`);
        await log(`⚠️ Generated with fallback: ${fallbackLessons}`);
        await log(`❌ Failed permanently: ${failedLessons}`);
        await log(`⏱️ Total duration: ${(totalDuration / 1000 / 60).toFixed(1)} min`);
        await log(`📈 Average generation time: ${avgTime}s/lesson`);
        await log(`📦 ${totalUnitsCreated} unidades | 📁 ${totalModulesCreated} módulos | 📝 ${totalLessonsCreated} lecciones | 🎯 ${totalActivitiesCreated} actividades`);

      } catch (bgErr) {
        console.error('Background generation error:', bgErr.message);
        await updateProgress(base44, genId, { status: 'failed', error_message: bgErr.message });
        await appendLog(base44, genId, logs, `💥 Error fatal: ${bgErr.message}`);
      }
    })();

    return Response.json(responsePayload);

  } catch (e) {
    console.error('generateSubjectCurriculum error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});