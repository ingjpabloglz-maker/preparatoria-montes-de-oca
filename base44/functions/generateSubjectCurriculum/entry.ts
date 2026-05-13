import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ═══════════════════════════════════════════════════════════════════════════════
//  generateSubjectCurriculum — SIMPLIFIED v4
//  • 1 sola llamada LLM por lección (título + explicación + actividades juntos)
//  • Solo tipos: multiple_choice, true_false, fill_blank
//  • Sin enrichments, sin tipos complejos, sin lógica on-demand
//  • Sin rollbacks agresivos: si LLM falla → fallback simple
//  • Circuit breaker + watchdog + safe_mode mantenidos
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_TYPES = ['multiple_choice', 'true_false', 'fill_blank'];
const BACKOFF_DELAYS = [0, 8000, 20000];
const WATCHDOG_TIMEOUT_MS = 5 * 60 * 1000;
const PAUSED_STALE_MS = 30 * 60 * 1000;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const MAX_UNITS = 4;
const MAX_MODULES = 10;
const MAX_TOTAL_LESSONS = 26;

const GENERATION_MODES = {
  lightweight: { activities_count: 4 },
  standard:    { activities_count: 4 },
  rich:        { activities_count: 5 },
};

const TOKENS_PER_LESSON = { lightweight: 600, standard: 900, rich: 1100 };

function ts() {
  return new Date().toLocaleTimeString('es-MX', { hour12: false });
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('[LLM_TIMEOUT] "' + label + '" superó ' + ms + 'ms')), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}

// ─── Watchdog ─────────────────────────────────────────────────────────────────
async function recoverStuckJobs(base44, subjectId) {
  const allJobs = await base44.asServiceRole.entities.CurriculumGenerationJob.filter({ subject_id: subjectId });
  const now = Date.now();
  let recovered = 0;
  for (const job of allJobs) {
    if (job.status !== 'processing' && job.status !== 'paused') continue;
    const lastActivity = job.last_activity_at ? new Date(job.last_activity_at).getTime() : 0;
    const threshold = job.status === 'paused' ? PAUSED_STALE_MS : WATCHDOG_TIMEOUT_MS;
    if (now - lastActivity > threshold) {
      await base44.asServiceRole.entities.CurriculumGenerationJob.update(job.id, {
        status: 'failed',
        error_message: 'Watchdog: job inactivo demasiado tiempo',
        finished_at: new Date().toISOString(),
      });
      recovered++;
    }
  }
  return recovered;
}

async function checkSubjectLock(base44, subjectId) {
  const allJobs = await base44.asServiceRole.entities.CurriculumGenerationJob.filter({ subject_id: subjectId });
  return allJobs.find(j => j.status === 'processing' || j.status === 'paused') || null;
}

// ─── LLM wrapper ──────────────────────────────────────────────────────────────
async function safeInvokeLLM(base44, prompt, label) {
  let lastErr = null;
  for (let attempt = 0; attempt <= 2; attempt++) {
    if (attempt > 0) {
      await sleep(BACKOFF_DELAYS[attempt] || 20000);
    }
    try {
      const result = await withTimeout(
        base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              explanation: { type: 'string' },
              activities: { type: 'array', items: { type: 'object' } }
            },
            required: ['title', 'explanation', 'activities']
          }
        }),
        90000,
        label
      );
      return result;
    } catch (err) {
      lastErr = err;
      if (attempt === 2) break;
    }
  }
  throw lastErr;
}

// ─── Prompt único por lección ─────────────────────────────────────────────────
function buildLessonPrompt(lessonTitle, subjectName, activitiesCount) {
  return 'Genera una lección educativa de preparatoria en JSON válido.\n\n' +
    'Tema: "' + lessonTitle + '"\n' +
    'Materia: "' + subjectName + '"\n\n' +
    'Formato EXACTO requerido:\n' +
    '{\n' +
    '  "title": "Título corto",\n' +
    '  "explanation": "Explicación completa de 100 a 200 palabras, más si es necesario. Explica todo lo necesario para que el tema quede totalmente entendible para un alumno de preparatoria.",\n' +
    '  "activities": [\n' +
    '    {\n' +
    '      "type": "multiple_choice",\n' +
    '      "question": "Pregunta",\n' +
    '      "options": ["A","B","C","D"],\n' +
    '      "correct_answer": "A",\n' +
    '      "explanation": "Por qué esta respuesta es correcta"\n' +
    '    }\n' +
    '  ]\n' +
    '}\n\n' +
    'Reglas obligatorias:\n' +
    '- Genera exactamente ' + activitiesCount + ' actividades\n' +
    '- Solo usar estos tipos: multiple_choice, true_false, fill_blank\n' +
    '- Para multiple_choice: incluir 4 opciones y correct_answer debe ser el texto exacto de una de las opciones\n' +
    '- Para true_false: options debe ser ["Verdadero","Falso"] y correct_answer "Verdadero" o "Falso"\n' +
    '- Para fill_blank: options vacío [], correct_answer es la palabra o frase correcta\n' +
    '- Todas las preguntas deben ser diferentes entre sí\n' +
    '- NO markdown, NO HTML, NO texto fuera del JSON\n' +
    '- Responder únicamente JSON válido';
}

// ─── Validación simple ────────────────────────────────────────────────────────
function validateActivity(act) {
  if (!act || typeof act !== 'object') return 'actividad inválida';
  if (!act.question || String(act.question).trim().length === 0) return 'question vacío';
  if (!VALID_TYPES.includes(act.type)) return 'tipo inválido: ' + act.type;
  if (!act.correct_answer || String(act.correct_answer).trim().length === 0) return 'correct_answer vacío';
  if (act.type === 'multiple_choice' && (!Array.isArray(act.options) || act.options.length < 2)) return 'options insuficientes';
  return null;
}

// ─── Fallback simple ──────────────────────────────────────────────────────────
function buildFallbackActivities(lessonTitle, subjectName, count) {
  const base = [
    { type: 'multiple_choice', question: '¿Cuál de las siguientes opciones describe mejor "' + lessonTitle + '"?', options: ['Concepto central de ' + lessonTitle, 'No pertenece a ' + subjectName, 'Definición incorrecta', 'Ninguna de las anteriores'], correct_answer: 'Concepto central de ' + lessonTitle, explanation: 'Este es el concepto fundamental de la lección.' },
    { type: 'true_false', question: '"' + lessonTitle + '" es un tema del programa de ' + subjectName + '.', options: ['Verdadero', 'Falso'], correct_answer: 'Verdadero', explanation: 'Sí, forma parte del programa.' },
    { type: 'fill_blank', question: 'El tema principal de esta lección es ___.', options: [], correct_answer: lessonTitle, explanation: 'El título de la lección indica el tema principal.' },
    { type: 'multiple_choice', question: '¿A qué materia pertenece el tema "' + lessonTitle + '"?', options: [subjectName, 'Matemáticas', 'Historia', 'Química'], correct_answer: subjectName, explanation: 'Este tema pertenece a ' + subjectName + '.' },
    { type: 'true_false', question: 'Es importante estudiar "' + lessonTitle + '" para comprender ' + subjectName + '.', options: ['Verdadero', 'Falso'], correct_answer: 'Verdadero', explanation: 'Sí, es parte fundamental del aprendizaje.' },
  ];
  const result = [];
  for (let i = 0; result.length < count; i++) result.push({ ...base[i % base.length] });
  return result;
}

// ─── Parsear respuesta LLM ────────────────────────────────────────────────────
function parseLLMResponse(raw, lessonTitle) {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : lessonTitle;
  const explanation = typeof raw.explanation === 'string' && raw.explanation.trim() ? raw.explanation.trim() : '';
  const activitiesRaw = Array.isArray(raw.activities) ? raw.activities : [];
  return { title, explanation, activitiesRaw };
}

// ─── Job helpers ──────────────────────────────────────────────────────────────
async function updateJob(base44, jobId, patch) {
  try {
    await base44.asServiceRole.entities.CurriculumGenerationJob.update(jobId, {
      ...patch,
      last_activity_at: new Date().toISOString(),
    });
  } catch (e) { console.warn('[updateJob]', e.message); }
}

async function appendLog(base44, jobId, currentLogs, message) {
  const logs = [...(currentLogs || []), message].slice(-150);
  try {
    await base44.asServiceRole.entities.CurriculumGenerationJob.update(jobId, {
      logs,
      last_activity_at: new Date().toISOString(),
    });
  } catch (e) { /* silent */ }
  console.log(message);
  return logs;
}

// ─── Lesson Grouping (mantenido) ──────────────────────────────────────────────
const TOPIC_GROUPS = [
  { pattern: /natural|entero|racional|irracional|real|complejo|número|numeros|clasificaci/i, title: 'Números reales y su clasificación' },
  { pattern: /suma|resta|multiplicaci|divisi|operaci|básica|aritmética|fundamental/i, title: 'Operaciones fundamentales' },
  { pattern: /media|mediana|moda|tendencia central|promedio/i, title: 'Medidas de tendencia central' },
  { pattern: /dispersi|varianza|desviaci|estándar|rango/i, title: 'Medidas de dispersión' },
  { pattern: /fraccion|fracción|decimal|porcentaje|proporci/i, title: 'Fracciones, decimales y porcentajes' },
  { pattern: /potencia|exponente|raíz|radical|logaritmo/i, title: 'Potencias, radicales y logaritmos' },
  { pattern: /ecuaci|inecuaci|sistema|inequaci/i, title: 'Ecuaciones e inecuaciones' },
  { pattern: /función|funcion|dominio|rango|imagen|gráfica|grafica/i, title: 'Funciones y sus representaciones' },
  { pattern: /polinomio|monomio|binomio|trinomio|álgebra|algebraic/i, title: 'Expresiones algebraicas y polinomios' },
  { pattern: /trigonom|seno|coseno|tangente|ángulo|círculo unitario/i, title: 'Trigonometría básica' },
  { pattern: /geom|área|perímet|volumen|figura|polígono/i, title: 'Geometría y medición' },
  { pattern: /probabilidad|evento|espacio muestral|estadística|frecuencia/i, title: 'Probabilidad y estadística' },
];

const MICRO_TOPIC_WORDS = [/^definici/i, /^concepto de/i, /^introducción a/i, /^nociones de/i, /^qué es/i, /^generalidades/i];

function isMicroTopic(topic) {
  return MICRO_TOPIC_WORDS.some(rx => rx.test(topic.trim()));
}

function topicsAreRelated(topicsArr) {
  for (const g of TOPIC_GROUPS) {
    const matches = topicsArr.filter(t => g.pattern.test(t));
    if (matches.length >= 2 && matches.length / topicsArr.length >= 0.4) return g.title;
  }
  return null;
}

function groupTopicsIntoLessons(rawLessons, moduleName) {
  const miniEvals = rawLessons.filter(l => l.is_mini_eval);
  const normals = rawLessons.filter(l => !l.is_mini_eval);
  const grouped = [];
  const used = new Set();

  for (const g of TOPIC_GROUPS) {
    const matches = normals.filter((l, i) => !used.has(i) && g.pattern.test(l.topic));
    if (matches.length >= 2) {
      matches.map(m => normals.indexOf(m)).forEach(i => used.add(i));
      grouped.push({
        topic: g.title, order: grouped.length + 1,
        difficulty: matches.some(m => m.difficulty === 'hard') ? 'hard' : 'medium',
        keywords: [...new Set(matches.flatMap(m => m.keywords || []))].slice(0, 6),
        is_mini_eval: false,
      });
    }
  }

  const remaining = normals.filter((_, i) => !used.has(i));
  let i = 0;
  while (i < remaining.length) {
    const current = remaining[i];
    const next = remaining[i + 1];
    if (isMicroTopic(current.topic) && next) {
      grouped.push({ topic: next.topic, order: grouped.length + 1, difficulty: next.difficulty || 'medium', keywords: [...new Set([...(current.keywords || []), ...(next.keywords || [])])].slice(0, 6), is_mini_eval: false });
      i += 2;
    } else {
      const stillLeft = remaining.length - i;
      if (grouped.length < 3 && stillLeft <= 3) {
        const batch = remaining.slice(i);
        const inferredTitle = topicsAreRelated(batch.map(b => b.topic)) || (batch.length > 1 ? batch[0].topic + ' y temas relacionados' : batch[0].topic);
        grouped.push({ topic: inferredTitle, order: grouped.length + 1, difficulty: 'medium', keywords: [...new Set(batch.flatMap(b => b.keywords || []))].slice(0, 6), is_mini_eval: false });
        i = remaining.length;
      } else if (grouped.length >= 3 && grouped.length > 0) {
        const last = grouped[grouped.length - 1];
        last.topic = last.topic;
        i++;
      } else {
        grouped.push({ topic: current.topic, order: grouped.length + 1, difficulty: current.difficulty || 'medium', keywords: current.keywords || [], is_mini_eval: false });
        i++;
      }
    }
  }

  while (grouped.length > 3) {
    grouped.pop();
  }

  const finalLessons = grouped.map((l, idx) => ({ ...l, order: idx + 1 }));
  if (miniEvals.length > 0) {
    finalLessons.push({ topic: miniEvals[0].topic || 'Mini evaluación: ' + moduleName, order: finalLessons.length + 1, difficulty: 'medium', keywords: miniEvals[0].keywords || [], is_mini_eval: true });
  }
  return finalLessons;
}

function buildStructureFromSyllabus(syllabus) {
  const units = (syllabus.units || []).slice(0, MAX_UNITS);
  let moduleCount = 0;
  let lessonCount = 0;
  const moduleSlot = Math.min(units.reduce((s, u) => s + (u.modules || []).length, 0), MAX_MODULES);

  return units.map((unit, ui) => ({
    title: unit.title,
    order: ui + 1,
    modules: (unit.modules || [])
      .filter(() => moduleCount < moduleSlot)
      .map((mod, mi) => {
        if (moduleCount >= moduleSlot) return null;
        moduleCount++;
        const grouped = groupTopicsIntoLessons(mod.lessons || [], mod.title);
        const available = MAX_TOTAL_LESSONS - lessonCount;
        const lessons = grouped.slice(0, Math.max(available, 1));
        lessonCount += lessons.length;
        return { title: mod.title, order: mi + 1, lessons };
      })
      .filter(Boolean),
  }));
}

// ─── Generar una lección ──────────────────────────────────────────────────────
async function generateOneLesson(base44, params, batchId, logFn, activitiesCount) {
  const { module_id, subject_id, subject_name, topic, is_mini_eval, lesson_order } = params;
  const count = is_mini_eval ? activitiesCount + 1 : activitiesCount;

  await logFn('[' + ts() + '] 📝 Generando: "' + topic + '"' + (is_mini_eval ? ' (mini-eval)' : ''));

  // Checkpoint recovery
  const existing = await base44.asServiceRole.entities.CourseLesson.filter({ module_id, subject_id });
  const existingForOrder = existing.filter(l => l.order === lesson_order);
  if (existingForOrder.length > 0) {
    const existLesson = existingForOrder[0];
    if (existLesson.generation_completed) {
      const existActs = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id: existLesson.id });
      if (existActs.length > 0) {
        await logFn('[' + ts() + '] ⏭️ SKIP "' + topic + '" — ya existe con ' + existActs.length + ' actividades');
        return { lesson: existLesson, activities_count: existActs.length, skipped: true };
      }
    }
    // Limpiar lección incompleta
    const orphanActs = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id: existLesson.id });
    for (const a of orphanActs) await base44.asServiceRole.entities.CourseActivity.delete(a.id);
    await base44.asServiceRole.entities.CourseLesson.delete(existLesson.id);
  }

  // Valores por defecto
  let lessonTitle = topic;
  let lessonExpl = 'Esta lección cubre "' + topic + '" dentro de ' + subject_name + '.';
  let validActivities = [];

  // 1 sola llamada LLM
  try {
    const prompt = buildLessonPrompt(topic, subject_name, count);
    const raw = await safeInvokeLLM(base44, prompt, 'lesson:' + topic);
    const parsed = parseLLMResponse(raw, topic);

    if (parsed) {
      if (parsed.title) lessonTitle = parsed.title;
      if (parsed.explanation) lessonExpl = parsed.explanation;

      for (const rawAct of parsed.activitiesRaw) {
        // Normalizar
        const act = {
          type: rawAct.type,
          question: typeof rawAct.question === 'string' ? rawAct.question.trim() : '',
          options: Array.isArray(rawAct.options) ? rawAct.options.map(String) : [],
          correct_answer: rawAct.correct_answer !== undefined ? String(rawAct.correct_answer).trim() : '',
          explanation: typeof rawAct.explanation === 'string' ? rawAct.explanation.trim() : '',
          difficulty: ['easy', 'medium', 'hard'].includes(rawAct.difficulty) ? rawAct.difficulty : 'medium',
        };
        const err = validateActivity(act);
        if (!err) validActivities.push(act);
        else await logFn('[' + ts() + '] ⚠️ Actividad descartada: ' + err);
      }
    }
  } catch (err) {
    await logFn('[' + ts() + '] ⚠️ LLM falló para "' + topic + '": ' + err.message + ' — usando fallback');
  }

  // Fallback si faltan actividades
  const minCount = is_mini_eval ? 5 : 4;
  if (validActivities.length < minCount) {
    const needed = minCount - validActivities.length;
    const fallbacks = buildFallbackActivities(lessonTitle, subject_name, needed);
    validActivities = [...validActivities, ...fallbacks];
    await logFn('[' + ts() + '] 🔧 ' + needed + ' actividades fallback añadidas');
  }

  // Crear lección
  const lesson = await base44.asServiceRole.entities.CourseLesson.create({
    module_id, subject_id,
    title: lessonTitle,
    explanation: lessonExpl,
    order: lesson_order,
    is_mini_eval: is_mini_eval || false,
    generation_completed: false,
  });

  // Persistir actividades
  for (let i = 0; i < validActivities.length; i++) {
    const act = validActivities[i];
    await base44.asServiceRole.entities.CourseActivity.create({
      lesson_id: lesson.id,
      type: act.type,
      question: act.question,
      options: act.options || [],
      correct_answer: act.correct_answer || '',
      explanation: act.explanation || '',
      difficulty: act.difficulty || 'medium',
      order: i + 1,
    });
  }

  // Marcar completado
  await base44.asServiceRole.entities.CourseLesson.update(lesson.id, { generation_completed: true });
  await logFn('[' + ts() + '] ✅ "' + lessonTitle + '" — ' + validActivities.length + ' actividades');

  return { lesson, activities_count: validActivities.length };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { subject_id, overwrite = false, safe_mode = false, preview_only = false, force_unlock = false } = body;
    if (!subject_id) return Response.json({ error: 'subject_id requerido' }, { status: 400 });

    // Force unlock
    if (force_unlock) {
      const allJobs = await base44.asServiceRole.entities.CurriculumGenerationJob.filter({ subject_id });
      let unlocked = 0;
      for (const job of allJobs) {
        if (['processing', 'paused', 'pending'].includes(job.status)) {
          await base44.asServiceRole.entities.CurriculumGenerationJob.update(job.id, {
            status: 'failed',
            error_message: 'Desbloqueado manualmente por admin: ' + user.email,
            finished_at: new Date().toISOString(),
          });
          unlocked++;
        }
      }
      return Response.json({ success: true, unlocked, message: unlocked + ' job(s) desbloqueados.' });
    }

    const subjects = await base44.asServiceRole.entities.Subject.filter({ id: subject_id });
    const subject = subjects[0];
    if (!subject) return Response.json({ error: 'Materia no encontrada' }, { status: 404 });

    const syllabuses = await base44.asServiceRole.entities.SubjectSyllabus.filter({ subject_id, is_active: true });
    const syllabus = syllabuses[0];
    if (!syllabus?.units?.length) {
      return Response.json({ error: 'Sin temario activo.', no_syllabus: true }, { status: 422 });
    }

    await recoverStuckJobs(base44, subject_id);

    const structure = buildStructureFromSyllabus(syllabus);
    let totalLessons = 0;
    let totalModules = 0;
    for (const u of structure) {
      for (const m of u.modules) {
        totalModules++;
        totalLessons += m.lessons.length;
      }
    }

    const generationMode = body.generation_mode || 'standard';
    const modeConfig = GENERATION_MODES[generationMode] || GENERATION_MODES.standard;

    // Preview
    if (preview_only) {
      const tokensPerLesson = TOKENS_PER_LESSON[generationMode] || TOKENS_PER_LESSON.standard;
      const avgSecsPerLesson = generationMode === 'lightweight' ? 15 : 20;
      return Response.json({
        preview: true,
        subject_name: subject.name,
        units: structure.length,
        modules: totalModules,
        total_lessons: totalLessons,
        estimated_minutes: Math.ceil((totalLessons * avgSecsPerLesson) / 60),
        estimated_tokens: totalLessons * tokensPerLesson,
        generation_mode: generationMode,
        structure_summary: structure.map(u => ({
          title: u.title,
          modules: u.modules.map(m => ({ title: m.title, lessons_count: m.lessons.length })),
        })),
      });
    }

    const activeJob = await checkSubjectLock(base44, subject_id);
    if (activeJob) {
      return Response.json({
        error: 'Ya existe un job ' + activeJob.status + ' para esta materia.',
        locked: true, active_job_id: activeJob.id, active_job_status: activeJob.status,
      }, { status: 409 });
    }

    if (!overwrite) {
      const existingUnits = await base44.asServiceRole.entities.CourseUnit.filter({ subject_id });
      if (existingUnits.length > 0) {
        return Response.json({ error: 'La materia ya tiene contenido. Usa overwrite=true.', has_content: true }, { status: 409 });
      }
    }

    // Crear job
    const batchId = crypto.randomUUID();
    const job = await base44.asServiceRole.entities.CurriculumGenerationJob.create({
      subject_id, subject_name: subject.name, batch_id: batchId,
      generation_version: 1, status: 'pending',
      total_lessons: totalLessons, completed_lessons: 0, failed_lessons: 0, skipped_lessons: 0,
      progress_percent: 0, logs: [],
      started_at: new Date().toISOString(), last_activity_at: new Date().toISOString(),
      overwrite, started_by: user.email, rate_limit_hits: 0,
    });

    // Crear CurriculumGeneration legacy para compatibilidad con UI
    const genId = crypto.randomUUID();
    await base44.asServiceRole.entities.CurriculumGeneration.create({
      generation_id: genId, subject_id, subject_name: subject.name,
      status: 'in_progress', progress_percent: 0, total_steps: totalLessons, completed_steps: 0,
      logs: [], started_by: user.email, overwrite,
      units_created: 0, modules_created: 0, lessons_created: 0, activities_created: 0,
    });

    const responsePayload = { success: true, generation_id: genId, job_id: job.id, batch_id: batchId, total_lessons: totalLessons };

    // ── Generación en segundo plano ───────────────────────────────────────────
    (async () => {
      let logs = [];
      const log = async (msg) => { logs = await appendLog(base44, job.id, logs, msg); };
      const startTime = Date.now();
      let completedLessons = 0, failedLessons = 0, skippedLessons = 0;
      let totalUnitsCreated = 0, totalModulesCreated = 0, totalActivitiesCreated = 0;
      let consecutiveFailures = 0;

      try {
        await updateJob(base44, job.id, { status: 'processing' });
        await log('[' + ts() + '] 🚀 Iniciando "' + subject.name + '" — ' + totalLessons + ' lecciones (1 llamada LLM/lección)');
        if (safe_mode) await log('[' + ts() + '] 🛡️ MODO SEGURO activo');

        // Limpiar si overwrite
        if (overwrite) {
          await log('[' + ts() + '] 🗑️ Limpiando contenido existente...');
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
          await log('[' + ts() + '] ✅ Contenido anterior eliminado');
        }

        for (const unitBlueprint of structure) {
          await log('[' + ts() + '] 📦 Unidad: "' + unitBlueprint.title + '"');
          await updateJob(base44, job.id, { current_unit: unitBlueprint.title });

          const unit = await base44.asServiceRole.entities.CourseUnit.create({
            subject_id, title: unitBlueprint.title, order: unitBlueprint.order,
          });
          totalUnitsCreated++;

          for (const modBlueprint of unitBlueprint.modules) {
            // Verificar si el job fue detenido externamente
            const freshJob = await base44.asServiceRole.entities.CurriculumGenerationJob.filter({ id: job.id });
            if (['paused', 'failed'].includes(freshJob[0]?.status)) {
              await log('[' + ts() + '] 🛑 Job detenido externamente');
              return;
            }

            await log('[' + ts() + '] 📁 Módulo: "' + modBlueprint.title + '"');
            await updateJob(base44, job.id, { current_module: modBlueprint.title });

            const module = await base44.asServiceRole.entities.CourseModule.create({
              unit_id: unit.id, subject_id, title: modBlueprint.title, order: modBlueprint.order,
            });
            totalModulesCreated++;

            for (const lessonBlueprint of modBlueprint.lessons) {
              // Circuit breaker
              if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
                await log('[' + ts() + '] 🔴 Circuit breaker: ' + consecutiveFailures + ' fallos consecutivos');
                await updateJob(base44, job.id, {
                  status: 'paused', error_message: 'Circuit breaker activado',
                  completed_lessons: completedLessons, failed_lessons: failedLessons,
                });
                return;
              }

              await updateJob(base44, job.id, {
                current_lesson: lessonBlueprint.topic,
                completed_lessons: completedLessons, failed_lessons: failedLessons, skipped_lessons: skippedLessons,
                progress_percent: Math.round(5 + ((completedLessons + failedLessons + skippedLessons) / totalLessons) * 90),
                activities_created: totalActivitiesCreated,
              });

              try {
                const result = await generateOneLesson(base44, {
                  module_id: module.id, subject_id, subject_name: subject.name,
                  topic: lessonBlueprint.topic, is_mini_eval: lessonBlueprint.is_mini_eval || false,
                  lesson_order: lessonBlueprint.order,
                }, batchId, log, modeConfig.activities_count);

                if (result.skipped) {
                  skippedLessons++;
                } else {
                  completedLessons++;
                  totalActivitiesCreated += result.activities_count;
                }
                consecutiveFailures = 0;
              } catch (lessonErr) {
                failedLessons++;
                consecutiveFailures++;
                await log('[' + ts() + '] ❌ Falló "' + lessonBlueprint.topic + '": ' + lessonErr.message);
              }
            }

            // Safe mode: pausa tras cada módulo
            if (safe_mode) {
              await log('[' + ts() + '] 🛡️ Safe mode: módulo completado. Job pausado.');
              await updateJob(base44, job.id, {
                status: 'paused', completed_lessons: completedLessons,
                failed_lessons: failedLessons, activities_created: totalActivitiesCreated,
              });
              return;
            }

            await log('[' + ts() + '] ✅ Módulo "' + modBlueprint.title + '" completado');
          }
        }

        const totalDuration = Math.round((Date.now() - startTime) / 1000);
        const successRate = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        await updateJob(base44, job.id, {
          status: 'completed', progress_percent: 100,
          completed_lessons: completedLessons, failed_lessons: failedLessons, skipped_lessons: skippedLessons,
          finished_at: new Date().toISOString(),
          units_created: totalUnitsCreated, modules_created: totalModulesCreated,
          activities_created: totalActivitiesCreated, total_duration_seconds: totalDuration,
          current_unit: '', current_module: '', current_lesson: '',
        });

        // Sync legacy
        try {
          const recs = await base44.asServiceRole.entities.CurriculumGeneration.filter({ generation_id: genId });
          if (recs[0]) await base44.asServiceRole.entities.CurriculumGeneration.update(recs[0].id, {
            status: 'completed', progress_percent: 100, completed_steps: completedLessons,
            units_created: totalUnitsCreated, modules_created: totalModulesCreated,
            lessons_created: completedLessons, activities_created: totalActivitiesCreated,
          });
        } catch (e) { /* silent */ }

        await log('[' + ts() + '] 🎉 GENERACIÓN COMPLETADA — ' + completedLessons + ' lecciones | ' + failedLessons + ' fallos | ' + successRate + '% éxito | ' + totalActivitiesCreated + ' actividades');

      } catch (bgErr) {
        console.error('[generateSubjectCurriculum] Error fatal:', bgErr.message);
        await updateJob(base44, job.id, { status: 'failed', error_message: bgErr.message });
        try {
          const recs = await base44.asServiceRole.entities.CurriculumGeneration.filter({ generation_id: genId });
          if (recs[0]) await base44.asServiceRole.entities.CurriculumGeneration.update(recs[0].id, { status: 'failed', error_message: bgErr.message });
        } catch (e) { /* silent */ }
      }
    })();

    return Response.json(responsePayload);

  } catch (e) {
    console.error('generateSubjectCurriculum error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});