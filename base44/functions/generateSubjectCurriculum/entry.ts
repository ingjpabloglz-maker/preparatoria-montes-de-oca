import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ═══════════════════════════════════════════════════════════════════════════════
//  generateSubjectCurriculum
//  Arquitectura: 1 LLM call a la vez, secuencial, con rate limiter + checkpoints
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_TYPES = ['multiple_choice','true_false','fill_blank','solve','order_steps','multiple_select','drag_drop','step_by_step'];
const ARRAY_ANSWER_TYPES = ['multiple_select', 'order_steps'];
const FALLBACK_TYPES = ['multiple_choice', 'true_false', 'fill_blank'];

// ─── Timestamp para logs ──────────────────────────────────────────────────────
function ts() {
  return new Date().toLocaleTimeString('es-MX', { hour12: false });
}

// ─── Rate Limiter Global ──────────────────────────────────────────────────────
// safeInvokeLLM: 1 call a la vez, backoff exponencial, detección de rate limit
const BACKOFF_DELAYS = [0, 5000, 15000, 45000]; // ms por intento (0=primer intento)

async function safeInvokeLLM(base44, prompt, options = {}, label = 'LLM', logFn = null) {
  const maxRetries = 3;
  let lastErr = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const delay = BACKOFF_DELAYS[attempt] || 45000;
    if (attempt > 0) {
      if (logFn) await logFn(`[${ts()}] Retry ${attempt}/${maxRetries} para "${label}" (espera ${delay/1000}s...)`);
      await sleep(delay);
    }

    try {
      const result = await withTimeout(
        base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          ...options,
        }),
        90000,
        label
      );
      if (logFn && attempt > 0) await logFn(`[${ts()}] ✅ Retry ${attempt} exitoso para "${label}"`);
      return result;
    } catch (err) {
      lastErr = err;
      const isRateLimit = err.message?.toLowerCase().includes('rate limit') ||
                          err.message?.toLowerCase().includes('too many') ||
                          err.message?.toLowerCase().includes('429');
      const isTimeout = err.message?.includes('LLM_TIMEOUT') || err.message?.includes('TIMEOUT');

      if (logFn) {
        if (isRateLimit) {
          await logFn(`[${ts()}] ⚠️ Rate limit detectado para "${label}"`);
          await logFn(`[${ts()}] Retry ${attempt + 1}/${maxRetries} en ${BACKOFF_DELAYS[attempt + 1] ? BACKOFF_DELAYS[attempt + 1]/1000 : 45}s`);
        } else if (isTimeout) {
          await logFn(`[${ts()}] ⏱️ Timeout en "${label}"`);
        } else {
          await logFn(`[${ts()}] ❌ Error en "${label}": ${err.message}`);
        }
      }
      if (attempt === maxRetries) break;
    }
  }
  throw lastErr;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[LLM_TIMEOUT] "${label}" superó ${ms}ms`)), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}

async function updateJob(base44, jobId, patch) {
  try {
    await base44.asServiceRole.entities.CurriculumGenerationJob.update(jobId, {
      ...patch,
      last_activity_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[updateJob] error:', e.message);
  }
}

async function appendLog(base44, jobId, currentLogs, message) {
  const logs = [...(currentLogs || []), message].slice(-100);
  try {
    await base44.asServiceRole.entities.CurriculumGenerationJob.update(jobId, {
      logs,
      last_activity_at: new Date().toISOString(),
    });
  } catch (e) { /* silent */ }
  console.log(message);
  return logs;
}

// También actualiza el CurriculumGeneration legacy para compatibilidad con UI existente
async function syncLegacyProgress(base44, genId, patch) {
  try {
    const recs = await base44.asServiceRole.entities.CurriculumGeneration.filter({ generation_id: genId });
    if (recs[0]) await base44.asServiceRole.entities.CurriculumGeneration.update(recs[0].id, patch);
  } catch (e) { /* silent */ }
}

// ─── Normalización y sanitización ────────────────────────────────────────────
function normalizeExplanationLevels(raw, question) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { basic: `La respuesta correcta es correcta.`, detailed: `Explicación del procedimiento.`, example: `Aplica el mismo procedimiento.` };
  }
  return {
    basic: typeof raw.basic === 'string' && raw.basic.trim() ? raw.basic : `Respuesta correcta.`,
    detailed: typeof raw.detailed === 'string' && raw.detailed.trim() ? raw.detailed : `Explicación paso a paso.`,
    example: typeof raw.example === 'string' && raw.example.trim() ? raw.example : `Ejemplo similar.`,
  };
}

function sanitizeActivity(activity) {
  const safe = { ...activity };
  if (!safe.type || !VALID_TYPES.includes(safe.type)) safe.type = 'multiple_choice';
  if (!safe.question || typeof safe.question !== 'string') safe.question = 'Selecciona la respuesta correcta';
  if (['multiple_choice','multiple_select','order_steps'].includes(safe.type)) {
    if (!Array.isArray(safe.options) || safe.options.length < 2) safe.options = ['Opción A','Opción B','Opción C','Opción D'];
  } else { safe.options = Array.isArray(safe.options) ? safe.options : []; }
  if (ARRAY_ANSWER_TYPES.includes(safe.type)) {
    safe.correct_answer = '';
    if (!Array.isArray(safe.correct_answers) || safe.correct_answers.length === 0)
      safe.correct_answers = [safe.options?.[0] || 'Opción A'];
    else safe.correct_answers = safe.correct_answers.map(x => String(x));
  } else {
    safe.correct_answers = [];
    if (!safe.correct_answer || typeof safe.correct_answer !== 'string')
      safe.correct_answer = safe.options?.[0] || 'Respuesta correcta';
  }
  safe.accepted_answers = Array.isArray(safe.accepted_answers) ? safe.accepted_answers.map(a => String(a)) : [];
  safe.hints = Array.isArray(safe.hints) ? safe.hints.filter(h => h) : [];
  if (!safe.explanation || typeof safe.explanation !== 'string') safe.explanation = safe.question;
  safe.explanation_levels = normalizeExplanationLevels(safe.explanation_levels, safe.question);
  if (safe.type === 'step_by_step') {
    if (!Array.isArray(safe.steps) || safe.steps.length < 2)
      safe.steps = [{ instruction:'Paso 1', answer:'resp 1', hint:'pista 1' }, { instruction:'Paso 2', answer:'resp 2', hint:'pista 2' }];
  } else { safe.steps = []; }
  if (safe.type === 'drag_drop') {
    if (!Array.isArray(safe.drag_items) || safe.drag_items.length < 2) safe.drag_items = ['A','B','C'];
    if (!Array.isArray(safe.drop_targets) || safe.drop_targets.length < 2) safe.drop_targets = ['1','2','3'];
  } else { safe.drag_items = []; safe.drop_targets = []; }
  if (!['easy','medium','hard'].includes(safe.difficulty)) safe.difficulty = 'medium';
  if (typeof safe.points !== 'number' || safe.points < 0)
    safe.points = { easy:8, medium:10, hard:14 }[safe.difficulty] || 10;
  safe.incorrect_feedback = typeof safe.incorrect_feedback === 'object' ? safe.incorrect_feedback : null;
  return safe;
}

function normalizeForPersistence(activity) {
  const a = { ...activity };
  const isArrayType = ARRAY_ANSWER_TYPES.includes(a.type);
  if (!a.question || typeof a.question !== 'string') a.question = 'Pregunta no disponible';
  if (isArrayType) {
    a.correct_answer = '';
  } else {
    if (a.correct_answer === null || a.correct_answer === undefined) a.correct_answer = '';
    else if (Array.isArray(a.correct_answer)) a.correct_answer = a.correct_answer.length > 0 ? String(a.correct_answer[0]) : '';
    else a.correct_answer = String(a.correct_answer);
  }
  if (isArrayType) {
    if (!Array.isArray(a.correct_answers)) a.correct_answers = [];
    else a.correct_answers = a.correct_answers.map(String).filter(Boolean);
  } else { a.correct_answers = []; }
  const expl = a.explanation || a.question || 'Explicación no disponible';
  if (!a.explanation_levels || Array.isArray(a.explanation_levels)) {
    a.explanation_levels = { basic: expl, detailed: expl, example: 'Sin ejemplo' };
  } else if (typeof a.explanation_levels === 'string') {
    a.explanation_levels = { basic: a.explanation_levels, detailed: a.explanation_levels, example: 'Sin ejemplo' };
  } else {
    a.explanation_levels = {
      basic: typeof a.explanation_levels.basic === 'string' ? a.explanation_levels.basic : expl,
      detailed: typeof a.explanation_levels.detailed === 'string' ? a.explanation_levels.detailed : expl,
      example: typeof a.explanation_levels.example === 'string' ? a.explanation_levels.example : 'Sin ejemplo',
    };
  }
  if (!Array.isArray(a.options)) a.options = []; else a.options = a.options.map(String).filter(Boolean);
  if (!Array.isArray(a.hints)) a.hints = []; else a.hints = a.hints.map(String).filter(Boolean);
  if (!Array.isArray(a.steps)) a.steps = [];
  if (!Array.isArray(a.drag_items)) a.drag_items = []; else a.drag_items = a.drag_items.map(String).filter(Boolean);
  if (!Array.isArray(a.drop_targets)) a.drop_targets = []; else a.drop_targets = a.drop_targets.map(String).filter(Boolean);
  if (typeof a.points !== 'number' || isNaN(a.points) || a.points < 0) a.points = 10;
  return a;
}

function validateActivity(act) {
  if (!act.question?.toString().trim()) return 'question vacío';
  if (!VALID_TYPES.includes(act.type)) return `tipo inválido: ${act.type}`;
  const isArrayType = ARRAY_ANSWER_TYPES.includes(act.type);
  if (act.type === 'multiple_choice') {
    if (!Array.isArray(act.options) || act.options.length < 2) return 'options insuficientes';
    if (!act.correct_answer?.trim()) return 'correct_answer vacío';
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

// ─── Fallback activities (sin LLM) ────────────────────────────────────────────
function buildFallbackActivities(lessonTitle, subjectName, count = 5) {
  const templates = [
    { type:'multiple_choice', question:`¿Cuál describe mejor "${lessonTitle}"?`,
      options:[`Concepto de ${lessonTitle}`,`No pertenece a ${subjectName}`,'Definición incorrecta','Ninguna'],
      correct_answer:`Concepto de ${lessonTitle}`, correct_answers:[], explanation:`Concepto básico de ${lessonTitle}.`, hints:['Revisa el contenido'], difficulty:'easy', points:8 },
    { type:'true_false', question:`"${lessonTitle}" es parte del programa de ${subjectName}.`,
      options:['Verdadero','Falso'], correct_answer:'Verdadero', correct_answers:[], explanation:`Sí, es parte de ${subjectName}.`, hints:['Piensa en el contexto'], difficulty:'easy', points:8 },
    { type:'fill_blank', question:`El tema principal de esta lección es ___.`,
      options:[], correct_answer:lessonTitle, correct_answers:[], accepted_answers:[lessonTitle], explanation:`El tema es "${lessonTitle}".`, hints:['Lee el título'], difficulty:'easy', points:8 },
    { type:'multiple_choice', question:`¿A qué materia pertenece "${lessonTitle}"?`,
      options:[subjectName,'Matemáticas','Historia','Química'], correct_answer:subjectName, correct_answers:[], explanation:`"${lessonTitle}" es de ${subjectName}.`, hints:['Recuerda tu materia'], difficulty:'easy', points:8 },
    { type:'true_false', question:`Es importante estudiar "${lessonTitle}" para comprender ${subjectName}.`,
      options:['Verdadero','Falso'], correct_answer:'Verdadero', correct_answers:[], explanation:`Sí, es esencial.`, hints:['Considera la importancia'], difficulty:'easy', points:8 },
  ];
  const result = [];
  for (let i = 0; result.length < count; i++) result.push({ ...templates[i % templates.length] });
  return result;
}

// ─── Persistir actividades inmediatamente ─────────────────────────────────────
async function persistActivities(base44, lessonId, activities, batchId = null) {
  let count = 0;
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    const isArrayType = ARRAY_ANSWER_TYPES.includes(act.type);
    const raw = {
      lesson_id: lessonId,
      generated_by: 'admin_curriculum',
      generation_batch_id: batchId || null,
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
    await base44.asServiceRole.entities.CourseActivity.create(actData);
    count++;
  }
  return count;
}

// ─── FASE 1: Leer estructura desde temario ────────────────────────────────────
// (Ya tenemos el syllabus estructurado, no necesitamos LLM para esto)
function buildStructureFromSyllabus(syllabus) {
  return syllabus.units.map(unit => ({
    title: unit.title,
    order: unit.order,
    modules: (unit.modules || []).map(mod => ({
      title: mod.title,
      order: mod.order,
      lessons: (mod.lessons || []).map(lesson => ({
        topic: lesson.topic,
        order: lesson.order,
        difficulty: lesson.difficulty || 'medium',
        keywords: lesson.keywords || [],
        is_mini_eval: lesson.is_mini_eval || false,
      })),
    })),
  }));
}

// ─── FASE 2: Generar 1 lección (secuencial) ───────────────────────────────────
async function generateOneLesson(base44, params, batchId, logFn) {
  const { module_id, subject_id, subject_name, topic, is_mini_eval, lesson_order, difficulty, keywords } = params;

  const t0 = Date.now();
  await logFn(`[${ts()}] 📝 Generando lección: "${topic}" ${is_mini_eval ? '(mini-eval)' : ''}`);

  // ── Verificar si ya existe (anti-duplicados / checkpoint recovery) ──────────
  const existing = await base44.asServiceRole.entities.CourseLesson.filter({ module_id, subject_id });
  const existingForOrder = existing.filter(l => l.order === lesson_order);
  if (existingForOrder.length > 0) {
    const existLesson = existingForOrder[0];
    if (existLesson.generation_completed) {
      const existActs = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id: existLesson.id });
      if (existActs.length > 0) {
        await logFn(`[${ts()}] ⏭️ SKIP "${topic}" — ya existe con ${existActs.length} actividades`);
        return { lesson: existLesson, activities_count: existActs.length, skipped: true };
      }
    }
  }

  const keywordsHint = keywords?.length ? `\nPalabras clave: ${keywords.join(', ')}` : '';
  const diffHint = { easy:'introductoria', medium:'intermedia', hard:'avanzada' }[difficulty] || 'intermedia';

  // LLM #1: Contenido teórico (secuencial, con rate limiter)
  let lessonContent = null;
  try {
    lessonContent = await safeInvokeLLM(
      base44,
      `Eres experto en diseño instruccional para preparatoria mexicana.
TEMA: "${topic}"
MATERIA: "${subject_name}"
TIPO: ${is_mini_eval ? 'MINI EVALUACIÓN' : 'LECCIÓN NORMAL'}
DIFICULTAD: ${diffHint}${keywordsHint}

Genera:
- title: título claro (máx 8 palabras)
- explanation: explicación teórica (máx 150 palabras). Para matemáticas usa LaTeX: $x^2$, $\\frac{a}{b}$.

Devuelve SOLO JSON: {"title":"...","explanation":"..."}`,
      {
        response_json_schema: {
          type: 'object',
          properties: { title: { type: 'string' }, explanation: { type: 'string' } },
          required: ['title', 'explanation'],
        },
      },
      `lesson-content:${topic}`,
      logFn
    );
  } catch (err) {
    await logFn(`[${ts()}] ❌ LLM falló para contenido de "${topic}": ${err.message}`);
  }

  const lessonTitle = lessonContent?.title || topic;
  const lessonExpl = lessonContent?.explanation || `Esta lección cubre "${topic}" dentro de ${subject_name}.`;

  // Crear lección inmediatamente
  const lesson = await base44.asServiceRole.entities.CourseLesson.create({
    module_id,
    subject_id,
    title: lessonTitle,
    explanation: lessonExpl,
    order: lesson_order,
    is_mini_eval: is_mini_eval || false,
    ai_generated: !!lessonContent,
    generation_completed: false,
    generation_version: 1,
    generated_at: new Date().toISOString(),
    generation_source: lessonContent ? 'admin_curriculum' : 'fallback',
  });

  await logFn(`[${ts()}] 🏗️ Lección creada en DB: "${lessonTitle}"`);

  // LLM #2: Actividades (secuencial)
  const min = is_mini_eval ? 10 : 7;
  const max = is_mini_eval ? 14 : 10;
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const easyCount = Math.round(count * 0.4);
  const hardCount = Math.round(count * 0.2);
  const mediumCount = count - easyCount - hardCount;

  const typeInstructions = is_mini_eval
    ? 'MÍNIMO: 2 multiple_choice, 2 true_false, 1 fill_blank, 1 multiple_select, 1 drag_drop, 1 step_by_step, 1 order_steps.'
    : 'MÍNIMO: 2 multiple_choice, 1 true_false, 1 fill_blank, 1 solve.';

  const valid = [];
  let activitiesRaw = null;

  try {
    activitiesRaw = await safeInvokeLLM(
      base44,
      `Eres experto en diseño instruccional. Genera ${count} actividades para:
TEMA: "${lessonTitle}"
MATERIA: "${subject_name}"
CONTENIDO: "${lessonExpl}"
TIPO: ${is_mini_eval ? 'MINI EVALUACIÓN' : 'LECCIÓN NORMAL'}
${typeInstructions}
DIFICULTAD: ${easyCount} easy, ${mediumCount} medium, ${hardCount} hard.
TIPOS DISPONIBLES: multiple_choice, true_false, fill_blank, solve, order_steps, multiple_select, drag_drop, step_by_step.
REGLAS CRÍTICAS:
- multiple_choice: 4 opciones, correct_answer=texto exacto de opción.
- true_false: options=["Verdadero","Falso"], correct_answer="Verdadero" o "Falso".
- multiple_select: correct_answers=ARRAY. NO usar correct_answer.
- order_steps: correct_answers=ARRAY orden correcto. NO usar correct_answer.
- drag_drop: drag_items, drop_targets, correct_answer=JSON object.
- step_by_step: steps=[{instruction,answer,hint}], correct_answer="step_by_step".
NUNCA combinar correct_answer y correct_answers en la misma actividad.
CALIDAD: explanation_levels {basic,detailed,example}, hints (máx 1), points: easy=8, medium=10, hard=14.
Matemáticas: LaTeX en $...$.
Devuelve SOLO JSON: {"activities":[...]}`,
      {
        response_json_schema: {
          type: 'object',
          properties: { activities: { type: 'array', items: { type: 'object' } } },
        },
      },
      `activities:${lessonTitle}`,
      logFn
    );
  } catch (err) {
    await logFn(`[${ts()}] ⚠️ LLM actividades falló para "${lessonTitle}": ${err.message} — usando fallback`);
  }

  if (activitiesRaw) {
    const rawList = Array.isArray(activitiesRaw) ? activitiesRaw : (activitiesRaw?.activities || []);
    for (const rawAct of rawList) {
      const act = sanitizeActivity(rawAct);
      if (!validateActivity(act)) valid.push(act);
    }
  }

  // Completar con fallback si faltan
  if (valid.length < min) {
    const needed = min - valid.length;
    const fallbacks = buildFallbackActivities(lessonTitle, subject_name, needed);
    for (const fb of fallbacks) valid.push(fb);
    await logFn(`[${ts()}] 🔧 ${needed} actividades fallback agregadas para "${lessonTitle}"`);
  }

  // Persistir actividades inmediatamente
  const activitiesCreated = await persistActivities(base44, lesson.id, valid, batchId);
  await logFn(`[${ts()}] 💾 ${activitiesCreated} actividades guardadas`);

  // Marcar lección como completada — checkpoint
  await base44.asServiceRole.entities.CourseLesson.update(lesson.id, { generation_completed: true });

  const elapsed = Math.round((Date.now() - t0) / 1000);
  await logFn(`[${ts()}] ✅ Lección completada en ${elapsed}s — "${lessonTitle}" (${activitiesCreated} actividades)`);

  return { lesson, activities_count: activitiesCreated, elapsed_seconds: elapsed };
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
    if (!syllabus?.units?.length) {
      return Response.json({
        error: 'Esta materia no tiene un temario activo. Define el temario primero.',
        no_syllabus: true,
      }, { status: 422 });
    }

    if (!overwrite) {
      const existingUnits = await base44.asServiceRole.entities.CourseUnit.filter({ subject_id });
      if (existingUnits.length > 0) {
        return Response.json({
          error: `La materia ya tiene ${existingUnits.length} unidades. Usa overwrite=true para sobreescribir.`,
          has_content: true,
        }, { status: 409 });
      }
    }

    // Crear job de generación
    const batchId = crypto.randomUUID();
    const job = await base44.asServiceRole.entities.CurriculumGenerationJob.create({
      subject_id,
      subject_name: subject.name,
      batch_id: batchId,
      generation_version: 1,
      status: 'pending',
      total_lessons: 0,
      completed_lessons: 0,
      failed_lessons: 0,
      skipped_lessons: 0,
      progress_percent: 0,
      logs: [],
      started_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      overwrite,
      started_by: user.email,
      rate_limit_hits: 0,
    });

    // Crear CurriculumGeneration legacy (para UI existente)
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

    const responsePayload = {
      success: true,
      generation_id: genId,
      job_id: job.id,
      batch_id: batchId,
      record_id: genRecord.id,
    };

    // ── Background: generación SECUENCIAL con cola robusta ──────────────────
    (async () => {
      let logs = [];
      const log = async (msg) => {
        logs = await appendLog(base44, job.id, logs, msg);
        // Sync legacy también
        try {
          const recs = await base44.asServiceRole.entities.CurriculumGeneration.filter({ generation_id: genId });
          if (recs[0]) {
            const legacyLogs = [...(recs[0].logs || []), msg].slice(-80);
            await base44.asServiceRole.entities.CurriculumGeneration.update(recs[0].id, { logs: legacyLogs });
          }
        } catch (e) { /* silent */ }
      };

      const startTime = Date.now();

      try {
        await updateJob(base44, job.id, { status: 'processing' });
        await log(`[${ts()}] 🚀 Iniciando generación de "${subject.name}" (Nivel ${subject.level})`);
        await log(`[${ts()}] 📋 Temario v${syllabus.version} cargado`);
        await log(`[${ts()}] ⚙️  MODO: Secuencial — 1 LLM call a la vez`);

        // FASE 1: Construir estructura desde temario (sin LLM)
        const structure = buildStructureFromSyllabus(syllabus);
        let totalLessons = 0;
        for (const u of structure) for (const m of u.modules) totalLessons += m.lessons.length;

        await log(`[${ts()}] 📐 FASE 1 completada: ${structure.length} unidades, ${totalLessons} lecciones planificadas`);
        await updateJob(base44, job.id, { total_lessons: totalLessons });
        await syncLegacyProgress(base44, genId, { total_steps: totalLessons, progress_percent: 5 });

        // Limpiar contenido si overwrite
        if (overwrite) {
          await log(`[${ts()}] 🗑️ Limpiando contenido existente...`);
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
          await log(`[${ts()}] ✅ Contenido anterior eliminado`);
        }

        // FASE 2: Generación secuencial lección por lección
        await log(`[${ts()}] 🎯 FASE 2: Generando contenido secuencialmente...`);

        let completedLessons = 0;
        let failedLessons = 0;
        let skippedLessons = 0;
        let totalUnitsCreated = 0;
        let totalModulesCreated = 0;
        let totalActivitiesCreated = 0;
        const lessonTimes = [];

        for (const unitBlueprint of structure) {
          await log(`[${ts()}] 📦 Unidad ${unitBlueprint.order}: "${unitBlueprint.title}"`);
          await updateJob(base44, job.id, { current_unit: unitBlueprint.title });

          const unit = await base44.asServiceRole.entities.CourseUnit.create({
            subject_id,
            title: unitBlueprint.title,
            order: unitBlueprint.order,
          });
          totalUnitsCreated++;

          for (const modBlueprint of unitBlueprint.modules) {
            await log(`[${ts()}] 📁 Módulo ${modBlueprint.order}: "${modBlueprint.title}"`);
            await updateJob(base44, job.id, { current_module: modBlueprint.title });
            await syncLegacyProgress(base44, genId, { current_module: modBlueprint.title });

            const module = await base44.asServiceRole.entities.CourseModule.create({
              unit_id: unit.id,
              subject_id,
              title: modBlueprint.title,
              order: modBlueprint.order,
            });
            totalModulesCreated++;

            // ── GENERACIÓN SECUENCIAL: 1 lección a la vez ──────────────────
            for (const lessonBlueprint of modBlueprint.lessons) {
              await updateJob(base44, job.id, {
                current_lesson: lessonBlueprint.topic,
                completed_lessons: completedLessons,
                failed_lessons: failedLessons,
                skipped_lessons: skippedLessons,
                progress_percent: Math.round(5 + ((completedLessons + failedLessons + skippedLessons) / totalLessons) * 90),
                activities_created: totalActivitiesCreated,
                units_created: totalUnitsCreated,
                modules_created: totalModulesCreated,
              });
              await syncLegacyProgress(base44, genId, {
                current_lesson: lessonBlueprint.topic,
                current_module: modBlueprint.title,
                completed_steps: completedLessons + failedLessons + skippedLessons,
                progress_percent: Math.round(5 + ((completedLessons + failedLessons + skippedLessons) / totalLessons) * 90),
                lessons_created: completedLessons,
                activities_created: totalActivitiesCreated,
                modules_created: totalModulesCreated,
                units_created: totalUnitsCreated,
              });

              let result = null;
              try {
                // Una sola lección a la vez — sin Promise.all, sin paralelismo
                result = await generateOneLesson(base44, {
                  module_id: module.id,
                  subject_id,
                  subject_name: subject.name,
                  topic: lessonBlueprint.topic,
                  is_mini_eval: lessonBlueprint.is_mini_eval || false,
                  lesson_order: lessonBlueprint.order,
                  difficulty: lessonBlueprint.difficulty || 'medium',
                  keywords: lessonBlueprint.keywords || [],
                }, batchId, log);

                if (result.skipped) {
                  skippedLessons++;
                } else {
                  completedLessons++;
                  totalActivitiesCreated += result.activities_count;
                  if (result.elapsed_seconds) lessonTimes.push(result.elapsed_seconds);
                }
              } catch (lessonErr) {
                // Modo resiliente: 1 lección falla → continúa con la siguiente
                failedLessons++;
                await log(`[${ts()}] ❌ Falló lección "${lessonBlueprint.topic}": ${lessonErr.message}`);
                await log(`[${ts()}] ➡️  Continuando con la siguiente lección...`);
              }

              // Tiempo estimado restante
              if (lessonTimes.length > 0 && (completedLessons + failedLessons + skippedLessons) < totalLessons) {
                const avgSecs = lessonTimes.reduce((a, b) => a + b, 0) / lessonTimes.length;
                const remaining = totalLessons - (completedLessons + failedLessons + skippedLessons);
                const etaMin = Math.round((avgSecs * remaining) / 60);
                if (etaMin > 0) await log(`[${ts()}] ⏳ ETA estimado: ~${etaMin} min restantes`);
              }
            }

            await log(`[${ts()}] ✅ Módulo "${modBlueprint.title}" completado`);
          }
        }

        // ── Resumen final ──────────────────────────────────────────────────
        const totalDuration = Math.round((Date.now() - startTime) / 1000);
        const avgTime = lessonTimes.length > 0 ? Math.round(lessonTimes.reduce((a, b) => a + b, 0) / lessonTimes.length) : 0;
        const totalMins = Math.round(totalDuration / 60);

        await updateJob(base44, job.id, {
          status: 'completed',
          progress_percent: 100,
          completed_lessons: completedLessons,
          failed_lessons: failedLessons,
          skipped_lessons: skippedLessons,
          finished_at: new Date().toISOString(),
          units_created: totalUnitsCreated,
          modules_created: totalModulesCreated,
          activities_created: totalActivitiesCreated,
          avg_lesson_seconds: avgTime,
          total_duration_seconds: totalDuration,
          current_unit: '',
          current_module: '',
          current_lesson: '',
        });

        await syncLegacyProgress(base44, genId, {
          status: 'completed',
          progress_percent: 100,
          completed_steps: completedLessons,
          total_steps: totalLessons,
          current_module: '',
          current_lesson: '',
          units_created: totalUnitsCreated,
          modules_created: totalModulesCreated,
          lessons_created: completedLessons,
          activities_created: totalActivitiesCreated,
        });

        await log(`[${ts()}] 🎉 ═══════════ GENERACIÓN COMPLETADA ═══════════`);
        await log(`[${ts()}] ✅ Exitosas: ${completedLessons} | ⏭️ Saltadas: ${skippedLessons} | ❌ Fallidas: ${failedLessons}`);
        await log(`[${ts()}] ⏱️  Duración total: ${totalMins} min | Promedio: ${avgTime}s/lección`);
        await log(`[${ts()}] 📦 ${totalUnitsCreated} unidades | 📁 ${totalModulesCreated} módulos | 📝 ${completedLessons} lecciones | ⚡ ${totalActivitiesCreated} actividades`);

      } catch (bgErr) {
        console.error('[generateSubjectCurriculum] Background error:', bgErr.message);
        await updateJob(base44, job.id, { status: 'failed', error_message: bgErr.message });
        await syncLegacyProgress(base44, genId, { status: 'failed', error_message: bgErr.message });
        await appendLog(base44, job.id, logs, `[${ts()}] 💥 Error fatal: ${bgErr.message}`);
      }
    })();

    return Response.json(responsePayload);

  } catch (e) {
    console.error('generateSubjectCurriculum error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});