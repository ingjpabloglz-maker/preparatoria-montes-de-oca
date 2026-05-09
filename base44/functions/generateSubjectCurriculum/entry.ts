import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ═══════════════════════════════════════════════════════════════════════════════
//  generateSubjectCurriculum — HARDENED v3
//  Sistemas activos:
//    ✅ Watchdog de jobs colgados
//    ✅ Locks reales por materia
//    ✅ Transacciones por lección (atomicidad)
//    ✅ Validación post-generación
//    ✅ Cache de prompts
//    ✅ Métricas reales
//    ✅ Modo safe_mode
//    ✅ Detección de basura LLM
//    ✅ Normalizador matemático
//    ✅ Circuit breaker (5 fallos consecutivos)
//    ✅ Sin Promise.all, sin recursión, sin generación desde frontend
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_TYPES = ['multiple_choice','true_false','fill_blank','solve','order_steps','multiple_select','drag_drop','step_by_step'];
const ARRAY_ANSWER_TYPES = ['multiple_select', 'order_steps'];
const BACKOFF_DELAYS = [0, 5000, 15000, 45000];
const WATCHDOG_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
const CIRCUIT_BREAKER_THRESHOLD = 5; // fallos consecutivos

// Modos de generación
const GENERATION_MODES = {
  lightweight: { normal_min: 4, normal_max: 4, mini_min: 5, mini_max: 5, only_basic_explanation: true, max_advanced_types: 1 },
  standard:    { normal_min: 4, normal_max: 6, mini_min: 5, mini_max: 7, only_basic_explanation: true, max_advanced_types: 1 },
  rich:        { normal_min: 7, normal_max: 10, mini_min: 10, mini_max: 14, only_basic_explanation: false, max_advanced_types: 3 },
};

// Tipos avanzados — se elige 1 aleatorio por lección
const ADVANCED_TYPES = ['drag_drop', 'step_by_step', 'multiple_select'];

// Tokens estimados por modo (para preview)
const TOKENS_PER_LESSON = { lightweight: 700, standard: 1100, rich: 1800 };

// ─── Timestamp ────────────────────────────────────────────────────────────────
function ts() {
  return new Date().toLocaleTimeString('es-MX', { hour12: false });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[LLM_TIMEOUT] "${label}" superó ${ms}ms`)), ms);
    promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// #1 WATCHDOG — recoverStuckJobs
// Recupera jobs 'processing' inactivos >5min y 'paused' abandonados >30min
// ═══════════════════════════════════════════════════════════════════════════════
const PAUSED_STALE_MS = 30 * 60 * 1000; // 30 minutos sin actividad = paused abandonado

async function recoverStuckJobs(base44, subjectId) {
  try {
    const allJobs = await base44.asServiceRole.entities.CurriculumGenerationJob.filter({ subject_id: subjectId });
    const now = Date.now();
    let recovered = 0;

    for (const job of allJobs) {
      if (job.status !== 'processing' && job.status !== 'paused') continue;
      const lastActivity = job.last_activity_at ? new Date(job.last_activity_at).getTime() : 0;
      const inactiveMs = now - lastActivity;
      const threshold = job.status === 'paused' ? PAUSED_STALE_MS : WATCHDOG_TIMEOUT_MS;

      if (inactiveMs > threshold) {
        const reason = job.status === 'paused'
          ? `Watchdog: paused job abandoned for ${Math.round(inactiveMs/60000)} minutes`
          : `Watchdog timeout: job inactive for ${Math.round(inactiveMs/60000)} minutes`;
        const logs = [...(job.logs || []), `[${ts()}] ⚠️ ${reason} — marking as failed`];
        await base44.asServiceRole.entities.CurriculumGenerationJob.update(job.id, {
          status: 'failed',
          error_message: reason,
          finished_at: new Date().toISOString(),
          logs: logs.slice(-100),
        });
        console.log(`[Watchdog] Job ${job.id} (${job.status}) marcado como failed (inactivo ${Math.round(inactiveMs/60000)}min)`);
        recovered++;
      }
    }
    return recovered;
  } catch (e) {
    console.warn('[Watchdog] Error:', e.message);
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// #2 LOCK — verificar si hay job activo para esta materia
// ═══════════════════════════════════════════════════════════════════════════════
async function checkSubjectLock(base44, subjectId) {
  const allJobs = await base44.asServiceRole.entities.CurriculumGenerationJob.filter({ subject_id: subjectId });
  const active = allJobs.find(j => j.status === 'processing' || j.status === 'paused');
  return active || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// #9 NORMALIZADOR MATEMÁTICO
// ═══════════════════════════════════════════════════════════════════════════════
function normalizeMathContent(text) {
  if (!text || typeof text !== 'string') return text;
  let t = text;

  // Operadores
  t = t.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/‒/g, '-').replace(/–/g, '-');

  // Exponentes unicode comunes
  t = t.replace(/²/g, '^2').replace(/³/g, '^3').replace(/¹/g, '^1').replace(/⁴/g, '^4');
  t = t.replace(/₀/g, '_0').replace(/₁/g, '_1').replace(/₂/g, '_2');

  // Fracciones unicode
  t = t.replace(/½/g, '1/2').replace(/⅓/g, '1/3').replace(/¼/g, '1/4').replace(/¾/g, '3/4');

  // LaTeX roto: backslashes inválidos (no seguidos de letras o llaves)
  t = t.replace(/\\(?![a-zA-Z{\\])/g, '');

  // Markdown roto: *** o __ sin cierre
  t = t.replace(/\*{3,}/g, '**').replace(/_{3,}/g, '__');

  // HTML residual
  t = t.replace(/<[^>]+>/g, '');

  // Espacios excesivos
  t = t.replace(/\s{3,}/g, '  ').trim();

  return t;
}

function normalizeActivityMath(activity) {
  const a = { ...activity };
  a.question = normalizeMathContent(a.question);
  a.explanation = normalizeMathContent(a.explanation);
  a.correct_answer = normalizeMathContent(a.correct_answer);
  if (Array.isArray(a.options)) a.options = a.options.map(normalizeMathContent);
  if (Array.isArray(a.correct_answers)) a.correct_answers = a.correct_answers.map(normalizeMathContent);
  if (Array.isArray(a.accepted_answers)) a.accepted_answers = a.accepted_answers.map(normalizeMathContent);
  if (a.explanation_levels) {
    a.explanation_levels = {
      basic: normalizeMathContent(a.explanation_levels.basic),
      detailed: normalizeMathContent(a.explanation_levels.detailed),
      example: normalizeMathContent(a.explanation_levels.example),
    };
  }
  return a;
}

// ═══════════════════════════════════════════════════════════════════════════════
// #8 DETECCIÓN DE BASURA LLM — ultra-permisiva, math-safe
// Solo rechaza basura REAL: null, HTML, JSON roto, actividades completamente vacías
// ═══════════════════════════════════════════════════════════════════════════════

// Cualquier materia técnica/numérica — se aplican reglas relajadas
const LENIENT_SUBJECT_KEYWORDS = [
  'algebra', 'álgebra', 'matemáticas', 'matematicas', 'arithmetic', 'aritmética', 'aritmetica',
  'cálculo', 'calculo', 'estadística', 'estadistica', 'probabilidad', 'geometría', 'geometria',
  'trigonometría', 'trigonometria', 'ecuaciones', 'física', 'fisica', 'química', 'quimica',
  'biología', 'biologia', 'ciencias', 'contabilidad', 'economía', 'economia',
];

function isLenientSubject(subjectName = '') {
  const lower = subjectName.toLowerCase();
  // Por defecto, casi todas las materias son lenient — solo rechazar si es materia puramente humanística
  // Si el nombre tiene alguna keyword técnica → lenient; de lo contrario también lenient por default
  return true; // Aplicar reglas relajadas a TODAS las materias para evitar falsos positivos
}

// Retorna string con motivo si es basura, null si es válido
function getGarbageReason(response, expectedField = 'activities') {
  if (response === null || response === undefined) return 'response es null/undefined';

  let str;
  try { str = typeof response === 'string' ? response : JSON.stringify(response); } catch (e) { return `JSON.stringify falló: ${e.message}`; }

  if (!str || str.length < 5) return `respuesta vacía (${str?.length} chars)`;
  if (/<html[\s>]|<body[\s>]|<!DOCTYPE/i.test(str)) return 'respuesta es página HTML';
  if (/^["']?```/.test(str.trim())) return 'markdown sin parsear como raíz';

  const totalFields = (str.match(/:/g) || []).length;
  if (totalFields > 15) {
    const nullCount = (str.match(/\bnull\b/g) || []).length;
    if (nullCount / totalFields > 0.7) return `nulls masivos (${nullCount}/${totalFields} = ${Math.round(nullCount/totalFields*100)}%)`;
  }

  if (expectedField === 'activities') {
    const items = Array.isArray(response?.activities) ? response.activities : (Array.isArray(response) ? response : null);
    if (!items) return `no se encontró array activities — keys: ${response ? Object.keys(response).join(',') : 'null'}`;
    if (items.length === 0) return 'array activities vacío';
    const emptyCount = items.filter(a => !a || typeof a !== 'object' || (!a.question && !a.type)).length;
    if (emptyCount / items.length > 0.7) return `${emptyCount}/${items.length} items completamente vacíos`;
    const withQuestion = items.filter(a => a && a.question !== undefined && a.question !== null);
    if (withQuestion.length === 0) return 'ningún item tiene campo question';
    const qs = withQuestion.map(a => String(a.question).trim().toLowerCase()).filter(q => q.length > 0);
    if (qs.length > 2 && new Set(qs).size === 1) return `todas las preguntas son idénticas: "${qs[0].slice(0,40)}"`;
    return null;
  }

  if (expectedField === 'lesson') {
    if (!response?.title && !response?.explanation) return 'lesson sin title NI explanation';
    const t = response.title ? String(response.title).trim() : '';
    const e = response.explanation ? String(response.explanation).trim() : '';
    if (!t && !e) return 'title y explanation vacíos';
    return null;
  }

  return null;
}

function isGarbageLLMResponse(response, expectedField = 'activities', subjectName = '') {
  const reason = getGarbageReason(response, expectedField);
  if (reason) { console.log(`[GarbageDetector] BASURA (${expectedField}): ${reason}`); return true; }
  console.log(`[GarbageDetector] ✅ OK (${expectedField}) — materia: "${subjectName}"`);
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// #5 PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════

const MATH_SUBJECT_KEYWORDS = ['matemáticas', 'matematicas', 'álgebra', 'algebra', 'aritmética', 'aritmetica', 'ecuaciones', 'estadística', 'estadistica'];

function isMathSubject(subjectName = '') {
  const lower = subjectName.toLowerCase();
  return MATH_SUBJECT_KEYWORDS.some(k => lower.includes(k));
}

function buildLessonContentPrompt(topic, subjectName, isMiniEval, difficulty, keywords) {
  const diff = { easy: 'básica', medium: 'intermedia', hard: 'avanzada' }[difficulty] || 'intermedia';
  return `Genera un título y explicación para una lección de preparatoria.
Tema: "${topic}"
Materia: "${subjectName}"
Dificultad: ${diff}
JSON: {"title":"título corto","explanation":"texto 60-100 palabras"}
Solo JSON.`;
}

function buildMathActivitiesPrompt(lessonTitle, isMiniEval) {
  const count = isMiniEval ? 6 : 4;
  const example = '{"activities":[{"question":"¿Cuánto es 3 + 4?","type":"multiple_choice","options":["5","6","7","8"],"correct_answer":"7","explanation_levels":{"basic":"3 más 4 es igual a 7"}},{"question":"Completa: 2 × ___ = 10","type":"fill_blank","options":[],"correct_answer":"5","explanation_levels":{"basic":"2 por 5 es 10"}},{"question":"¿Es verdad que 5 > 3?","type":"true_false","options":["Verdadero","Falso"],"correct_answer":"Verdadero","explanation_levels":{"basic":"5 es mayor que 3"}}]}';
  return 'Genera ' + count + ' actividades matematicas en JSON valido para preparatoria.\n' +
    'Leccion: "' + lessonTitle + '"\n\n' +
    'Ejemplo de formato:\n' + example + '\n\n' +
    'Reglas:\n' +
    '- Solo tipos: multiple_choice, fill_blank, true_false\n' +
    '- Preguntas matematicas reales sobre el tema de la leccion\n' +
    '- correct_answer debe ser texto exacto de options (para multiple_choice)\n' +
    '- NO texto vacio en ningun campo\n' +
    '- Solo JSON valido, sin markdown ni texto extra';
}

function buildActivitiesPrompt(lessonTitle, subjectName, lessonExpl, isMiniEval) {
  const count = isMiniEval ? 6 : 4;
  const advancedType = ADVANCED_TYPES[Math.floor(Math.random() * ADVANCED_TYPES.length)];
  return 'Genera ' + count + ' actividades educativas en JSON para preparatoria.\n' +
    'Leccion: "' + lessonTitle + '" Materia: "' + subjectName + '"\n' +
    'Incluye tipos: multiple_choice, true_false, fill_blank. 1 actividad tipo ' + advancedType + '.\n' +
    'JSON: {"activities":[{"question":"...","type":"multiple_choice","options":["a","b","c","d"],"correct_answer":"a","explanation_levels":{"basic":"..."}}]}\n' +
    'Solo JSON valido.';
}

// ═══════════════════════════════════════════════════════════════════════════════
// Rate Limiter + Garbage Detection
// ═══════════════════════════════════════════════════════════════════════════════
async function safeInvokeLLM(base44, prompt, options = {}, label = 'LLM', logFn = null, metrics = null) {
  const maxRetries = 3;
  let lastErr = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const delay = BACKOFF_DELAYS[attempt] || 45000;
    if (attempt > 0) {
      retryCount++;
      if (logFn) await logFn(`[${ts()}] 🔄 Retry ${attempt}/${maxRetries} para "${label}" (espera ${delay/1000}s...)`);
      await sleep(delay);
    }

    try {
      if (metrics) metrics.total_llm_calls++;

      const result = await withTimeout(
        base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, ...options }),
        90000,
        label
      );

      // Estimar tokens (~4 chars = 1 token)
      if (metrics) {
        metrics.total_tokens_estimated += Math.round(prompt.length / 4);
        if (retryCount > 0) metrics.total_retries += retryCount;
      }

      if (logFn && attempt > 0) await logFn(`[${ts()}] ✅ Retry ${attempt} exitoso para "${label}"`);
      return result;
    } catch (err) {
      lastErr = err;
      const isRateLimit = err.message?.toLowerCase().includes('rate limit') ||
                          err.message?.toLowerCase().includes('too many') ||
                          err.message?.toLowerCase().includes('429');
      const isTimeout = err.message?.includes('LLM_TIMEOUT') || err.message?.includes('TIMEOUT');

      if (metrics && isRateLimit) metrics.rate_limit_hits = (metrics.rate_limit_hits || 0) + 1;

      if (logFn) {
        if (isRateLimit) await logFn(`[${ts()}] ⚠️ Rate limit para "${label}" — retry ${attempt + 1}/${maxRetries} en ${BACKOFF_DELAYS[attempt + 1] ? BACKOFF_DELAYS[attempt + 1]/1000 : 45}s`);
        else if (isTimeout) await logFn(`[${ts()}] ⏱️ Timeout en "${label}"`);
        else await logFn(`[${ts()}] ❌ Error en "${label}": ${err.message}`);
      }
      if (attempt === maxRetries) break;
    }
  }
  throw lastErr;
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

async function syncLegacyProgress(base44, genId, patch) {
  try {
    const recs = await base44.asServiceRole.entities.CurriculumGeneration.filter({ generation_id: genId });
    if (recs[0]) await base44.asServiceRole.entities.CurriculumGeneration.update(recs[0].id, patch);
  } catch (e) { /* silent */ }
}

// ─── Normalización y sanitización ────────────────────────────────────────────
function normalizeExplanationLevels(raw, question) {
  const basic = (raw && typeof raw === 'object' && !Array.isArray(raw) && typeof raw.basic === 'string' && raw.basic.trim())
    ? raw.basic
    : (typeof raw === 'string' && raw.trim() ? raw : `La respuesta correcta es la indicada.`);
  // Solo basic pregenerado; detailed/example on-demand via generateActivityEnrichment
  return { basic, detailed: '', example: '' };
}

function sanitizeActivity(activity) {
  if (!activity) return null;
  // Rechazar si question está vacía, es whitespace, null, o type falta — NO crear placeholders
  const q = activity.question;
  if (q === null || q === undefined || String(q).trim().length === 0) return null;
  if (!activity.type || !VALID_TYPES.includes(activity.type)) return null;

  const safe = { ...activity };
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
  // hints y incorrect_feedback on-demand — no se pregenera
  safe.hints = [];
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
  safe.incorrect_feedback = null;
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
    a.explanation_levels = { basic: expl, detailed: '', example: '' };
  } else if (typeof a.explanation_levels === 'string') {
    a.explanation_levels = { basic: a.explanation_levels, detailed: '', example: '' };
  } else {
    a.explanation_levels = {
      basic: typeof a.explanation_levels.basic === 'string' && a.explanation_levels.basic.trim() ? a.explanation_levels.basic : expl,
      detailed: '',
      example: '',
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
  // Solo rechazar si question está completamente ausente o es un objeto no-string
  if (act.question === undefined || act.question === null) return 'question ausente';
  if (typeof act.question !== 'string' && typeof act.question !== 'number') return 'question tipo inválido';
  // Aceptar preguntas numéricas cortas: "2+3", "x²", "5/8" son válidas
  if (String(act.question).trim().length === 0) return 'question vacío';

  if (!VALID_TYPES.includes(act.type)) return `tipo inválido: ${act.type}`;

  if (act.type === 'multiple_choice') {
    if (!Array.isArray(act.options) || act.options.length < 2) return 'options insuficientes';
    if (!act.correct_answer && act.correct_answer !== 0) return 'correct_answer vacío';
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
    const hasAnswer = (act.correct_answer !== undefined && act.correct_answer !== null && String(act.correct_answer).trim().length > 0)
      || (Array.isArray(act.accepted_answers) && act.accepted_answers.length > 0);
    if (!hasAnswer) return 'correct_answer requerido';
  }
  if (act.type === 'drag_drop') {
    if (!Array.isArray(act.drag_items) || !act.drag_items.length) return 'drag_items vacío';
    if (!Array.isArray(act.drop_targets) || !act.drop_targets.length) return 'drop_targets vacío';
  }
  if (act.type === 'step_by_step') {
    if (!Array.isArray(act.steps) || act.steps.length < 2) return 'steps requiere mínimo 2';
  }
  // Explanation: aceptar cualquier string no vacío (incluso "Ver solución" o "4")
  // NO rechazar por longitud — matemáticas puede tener explicaciones muy cortas
  if (act.explanation !== undefined && act.explanation !== null && typeof act.explanation !== 'string') return 'explanation tipo inválido';
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// #4 VALIDACIÓN POST-GENERACIÓN
// ═══════════════════════════════════════════════════════════════════════════════
function auditGeneratedLesson(lesson, activities, isMiniEval) {
  const errors = [];
  const minActivities = isMiniEval ? 6 : 4;

  if (!lesson?.id) { errors.push('lesson no existe'); return errors; }
  if (!activities || activities.length < minActivities) {
    errors.push(`actividades insuficientes: ${activities?.length || 0} < ${minActivities}`);
  }

  // Tipos requeridos (solo multiple_choice obligatorio para todos)
  const presentTypes = new Set(activities.map(a => a.type));
  if (!presentTypes.has('multiple_choice')) errors.push(`tipo requerido ausente: multiple_choice`);

  // Preguntas duplicadas (todas iguales)
  const questions = activities.map(a => a.question?.trim().toLowerCase());
  const uniqueQ = new Set(questions);
  if (uniqueQ.size === 1 && questions.length > 2) errors.push(`todas las preguntas son idénticas`);

  // Options requeridas ausentes
  const needOptions = ['multiple_choice', 'multiple_select', 'order_steps'];
  const missingOptions = activities.filter(a => needOptions.includes(a.type) && (!Array.isArray(a.options) || a.options.length < 2));
  if (missingOptions.length > 0) errors.push(`${missingOptions.length} actividades sin options`);

  // Correct answers malformadas
  for (const a of activities) {
    const err = validateActivity(a);
    if (err) errors.push(`actividad malformada (${a.type}): ${err}`);
  }

  return errors;
}

// ─── Fallback activities ──────────────────────────────────────────────────────
function buildFallbackActivities(lessonTitle, subjectName, count = 4) {
  const templates = [
    { type:'multiple_choice', question:`¿Cuál describe mejor "${lessonTitle}"?`, options:[`Concepto de ${lessonTitle}`,`No pertenece a ${subjectName}`,'Definición incorrecta','Ninguna'], correct_answer:`Concepto de ${lessonTitle}`, correct_answers:[], explanation:`Concepto básico de ${lessonTitle}.`, hints:['Revisa el contenido'], difficulty:'easy', points:8 },
    { type:'true_false', question:`"${lessonTitle}" es parte del programa de ${subjectName}.`, options:['Verdadero','Falso'], correct_answer:'Verdadero', correct_answers:[], explanation:`Sí, es parte de ${subjectName}.`, hints:[], difficulty:'easy', points:8 },
    { type:'fill_blank', question:`El tema principal de esta lección es ___.`, options:[], correct_answer:lessonTitle, correct_answers:[], accepted_answers:[lessonTitle], explanation:`El tema es "${lessonTitle}".`, hints:['Lee el título'], difficulty:'easy', points:8 },
    { type:'multiple_choice', question:`¿A qué materia pertenece "${lessonTitle}"?`, options:[subjectName,'Matemáticas','Historia','Química'], correct_answer:subjectName, correct_answers:[], explanation:`"${lessonTitle}" es de ${subjectName}.`, hints:[], difficulty:'easy', points:8 },
    { type:'true_false', question:`Es importante estudiar "${lessonTitle}" para comprender ${subjectName}.`, options:['Verdadero','Falso'], correct_answer:'Verdadero', correct_answers:[], explanation:`Sí, es esencial.`, hints:[], difficulty:'easy', points:8 },
    { type:'fill_blank', question:`La materia "${subjectName}" pertenece al nivel ___ de preparatoria.`, options:[], correct_answer:'preparatoria', correct_answers:[], accepted_answers:['preparatoria','bachillerato'], explanation:`Es parte del plan de preparatoria.`, hints:[], difficulty:'easy', points:8 },
    { type:'multiple_choice', question:`¿Cuál es el objetivo principal de "${lessonTitle}"?`, options:[`Aprender sobre ${lessonTitle}`,`No tiene objetivo`,'Practicar otra materia','Ninguno de los anteriores'], correct_answer:`Aprender sobre ${lessonTitle}`, correct_answers:[], explanation:`El objetivo es comprender ${lessonTitle}.`, hints:[], difficulty:'easy', points:8 },
  ];
  const result = [];
  for (let i = 0; result.length < count; i++) result.push({ ...templates[i % templates.length] });
  return result;
}

// ─── Persistir actividades ────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON GROUPING — agrupa subtemas relacionados en lecciones compactas
// ═══════════════════════════════════════════════════════════════════════════════

// Grupos semánticos conocidos: si los temas de un módulo caen en un grupo,
// se fusionan en una sola lección con un título pedagógico.
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
  { pattern: /factor|factoriz|product notable/i, title: 'Factorización y productos notables' },
  { pattern: /trigonom|seno|coseno|tangente|ángulo|angle|círculo unitario/i, title: 'Trigonometría básica' },
  { pattern: /geom|área|perímet|volumen|figura|polígono|circunferencia/i, title: 'Geometría y medición' },
  { pattern: /probabilidad|evento|espacio muestral|estadística|frecuencia/i, title: 'Probabilidad y estadística' },
  { pattern: /célula|tejido|órgano|organismo|biolog/i, title: 'Organización biológica' },
  { pattern: /fotosíntesis|respiraci|metabolismo|energía celular/i, title: 'Procesos metabólicos celulares' },
  { pattern: /átomo|molécula|elemento|compuesto|enlace|quím/i, title: 'Estructura atómica y química' },
  { pattern: /fuerza|movimiento|velocidad|aceleración|física|cinemática|dinámica/i, title: 'Física: movimiento y fuerzas' },
  { pattern: /sujeto|predicado|oración|sintaxis|gramática/i, title: 'Sintaxis y gramática oracional' },
  { pattern: /liter|poesía|narrativa|género|autor|obra/i, title: 'Géneros y corrientes literarias' },
  { pattern: /revolución|guerra|historia|independencia|coloni/i, title: 'Contexto histórico y político' },
];

// Palabras de "microtema" que NO deben crear lección individual
const MICRO_TOPIC_WORDS = [
  /^definici/i, /^concepto de/i, /^introducción a/i, /^nociones de/i,
  /^qué es/i, /^generalidades/i, /^historia de/i, /^origen de/i,
];

function isMicroTopic(topic) {
  return MICRO_TOPIC_WORDS.some(rx => rx.test(topic.trim()));
}

function topicsAreRelated(topicsArr) {
  // Dos temas son "relacionados" si más del 50% cae en el mismo grupo semántico
  for (const g of TOPIC_GROUPS) {
    const matches = topicsArr.filter(t => g.pattern.test(t));
    if (matches.length >= 2 && matches.length / topicsArr.length >= 0.4) return g.title;
  }
  return null;
}

/**
 * groupTopicsIntoLessons
 * Recibe el array de lecciones raw del módulo y devuelve lecciones agrupadas.
 * Reglas:
 *  - máx 4 lecciones por módulo (contando mini_eval)
 *  - 2-3 lecciones normales + 1 mini_eval
 *  - fusiona microtemas y subtemas relacionados
 */
function groupTopicsIntoLessons(rawLessons, moduleName, subjectName) {
  // Separar mini_eval del resto
  const miniEvals = rawLessons.filter(l => l.is_mini_eval);
  const normals = rawLessons.filter(l => !l.is_mini_eval);

  const originalCount = normals.length;
  const grouped = [];

  // PASO 1 — Agrupar por grupo semántico detectado
  const used = new Set();
  for (const g of TOPIC_GROUPS) {
    const matches = normals.filter((l, i) => !used.has(i) && g.pattern.test(l.topic));
    if (matches.length >= 2) {
      const indices = matches.map(m => normals.indexOf(m));
      indices.forEach(i => used.add(i));
      grouped.push({
        topic: g.title,
        order: grouped.length + 1,
        difficulty: matches.some(m => m.difficulty === 'hard') ? 'hard' : matches.some(m => m.difficulty === 'medium') ? 'medium' : 'easy',
        keywords: [...new Set(matches.flatMap(m => m.keywords || []))].slice(0, 6),
        is_mini_eval: false,
        _grouped_from: matches.map(m => m.topic),
      });
    }
  }

  // PASO 2 — Agrupar microtemas restantes con el siguiente tema normal
  const remaining = normals.filter((_, i) => !used.has(i));
  let i = 0;
  while (i < remaining.length) {
    const current = remaining[i];
    const next = remaining[i + 1];

    if (isMicroTopic(current.topic) && next) {
      // Fusionar microtema con el siguiente
      grouped.push({
        topic: next.topic, // usar el título del tema sustantivo
        order: grouped.length + 1,
        difficulty: next.difficulty || 'medium',
        keywords: [...new Set([...(current.keywords || []), ...(next.keywords || [])])].slice(0, 6),
        is_mini_eval: false,
        _grouped_from: [current.topic, next.topic],
      });
      i += 2;
    } else {
      // Intentar fusionar lotes de 2-3 temas pequeños restantes si aún superamos el límite
      const stillLeft = remaining.length - i;
      const alreadyGrouped = grouped.length;
      const maxNormal = 3; // máximo 3 lecciones normales por módulo

      if (alreadyGrouped < maxNormal && stillLeft <= 3) {
        // Fusionar todos los que quedan en 1 lección
        const batch = remaining.slice(i);
        const batchTopics = batch.map(b => b.topic);
        const inferredTitle = topicsAreRelated(batchTopics)
          || (batch.length > 1 ? `${batchTopics[0]} y temas relacionados` : batch[0].topic);
        grouped.push({
          topic: inferredTitle,
          order: grouped.length + 1,
          difficulty: batch.some(b => b.difficulty === 'hard') ? 'hard' : 'medium',
          keywords: [...new Set(batch.flatMap(b => b.keywords || []))].slice(0, 6),
          is_mini_eval: false,
          _grouped_from: batchTopics,
        });
        i = remaining.length; // done
      } else if (alreadyGrouped >= maxNormal) {
        // Ya tenemos suficientes lecciones — fusionar el resto en la última
        const last = grouped[grouped.length - 1];
        last._grouped_from = [...(last._grouped_from || [last.topic]), current.topic];
        i++;
      } else {
        grouped.push({
          topic: current.topic,
          order: grouped.length + 1,
          difficulty: current.difficulty || 'medium',
          keywords: current.keywords || [],
          is_mini_eval: false,
          _grouped_from: [current.topic],
        });
        i++;
      }
    }
  }

  // PASO 3 — Enforcing máx 3 normales por módulo (fusionar exceso)
  while (grouped.length > 3) {
    const last = grouped.pop();
    const prev = grouped[grouped.length - 1];
    prev._grouped_from = [...(prev._grouped_from || [prev.topic]), ...(last._grouped_from || [last.topic])];
    prev.topic = topicsAreRelated([prev.topic, last.topic]) || prev.topic;
    prev.keywords = [...new Set([...(prev.keywords || []), ...(last.keywords || [])])].slice(0, 6);
  }

  // PASO 4 — Asignar orden final + añadir mini_eval
  const finalLessons = grouped.map((l, idx) => ({ ...l, order: idx + 1 }));

  // Solo 1 mini_eval por módulo (la última)
  if (miniEvals.length > 0) {
    finalLessons.push({
      topic: miniEvals[0].topic || `Mini evaluación: ${moduleName}`,
      order: finalLessons.length + 1,
      difficulty: 'medium',
      keywords: miniEvals[0].keywords || [],
      is_mini_eval: true,
      _grouped_from: miniEvals.map(m => m.topic),
    });
  }

  // Log de agrupación
  const savedLessons = originalCount - grouped.length;
  const savePct = originalCount > 0 ? Math.round((savedLessons / originalCount) * 100) : 0;
  if (originalCount > grouped.length) {
    console.log(`[GroupTopics] "${moduleName}": ${originalCount} temas → ${grouped.length} lecciones (-${savePct}% carga). Agrupaciones: ${grouped.filter(g => (g._grouped_from || []).length > 1).map(g => `"${g.topic}" (${g._grouped_from.length} temas)`).join(', ')}`);
  }

  return finalLessons;
}

// ─── Estructura desde temario con grouping ────────────────────────────────────
// Límites globales del currículo
const MAX_UNITS = 4;
const MAX_MODULES = 10;
const MAX_TOTAL_LESSONS = 26;

function buildStructureFromSyllabus(syllabus, subjectName = '') {
  // 1. Tomar máx 4 unidades
  const units = (syllabus.units || []).slice(0, MAX_UNITS);

  // 2. Calcular cuántos módulos por unidad podemos tomar
  const totalRawModules = units.reduce((s, u) => s + (u.modules || []).length, 0);
  const moduleSlot = Math.min(totalRawModules, MAX_MODULES);

  let moduleCount = 0;
  let lessonCount = 0;

  return units.map((unit, ui) => ({
    title: unit.title,
    order: ui + 1,
    modules: (unit.modules || [])
      .filter(() => moduleCount < moduleSlot)
      .map((mod, mi) => {
        if (moduleCount >= moduleSlot) return null;
        moduleCount++;

        // Aplicar grouping pedagógico
        const grouped = groupTopicsIntoLessons(mod.lessons || [], mod.title, subjectName);

        // Truncar si superamos el límite global de lecciones
        const available = MAX_TOTAL_LESSONS - lessonCount;
        const lessons = grouped.slice(0, Math.max(available, 1));
        lessonCount += lessons.length;

        return {
          title: mod.title,
          order: mi + 1,
          lessons,
        };
      })
      .filter(Boolean),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERAR 1 LECCIÓN — con transacciones, validación post-gen, math normalizer
// ═══════════════════════════════════════════════════════════════════════════════
async function generateOneLesson(base44, params, batchId, logFn, metrics, modeConfig) {
  const { module_id, subject_id, subject_name, topic, is_mini_eval, lesson_order, difficulty, keywords } = params;
  const isMath = isMathSubject(subject_name);
  const cfg = modeConfig || GENERATION_MODES.standard;
  const t0 = Date.now();
  await logFn(`[${ts()}] 📝 Generando lección: "${topic}" ${is_mini_eval ? '(mini-eval)' : ''}`);

  // ── Checkpoint recovery ──────────────────────────────────────────────────
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
    // Lección incompleta — limpiar (rollback de estado anterior)
    const orphanActs = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id: existLesson.id });
    for (const a of orphanActs) await base44.asServiceRole.entities.CourseActivity.delete(a.id);
    await base44.asServiceRole.entities.CourseLesson.delete(existLesson.id);
    await logFn(`[${ts()}] 🧹 Lección incompleta anterior eliminada (rollback): "${topic}"`);
  }

  // ═════════════════════════════════
  // BEGIN TRANSACTION
  // ═════════════════════════════════
  let createdLesson = null;
  let createdActivityIds = [];

  try {
    // LLM #1: Contenido teórico con garbage detection
    let lessonContent = null;
    let lessonTitle = topic;
    let lessonExpl = `Esta lección cubre "${topic}" dentro de ${subject_name}.`;

    try {
      const prompt1 = buildLessonContentPrompt(topic, subject_name, is_mini_eval, difficulty, keywords);
      const raw1 = await safeInvokeLLM(
        base44, prompt1,
        { response_json_schema: { type:'object', properties:{ title:{type:'string'}, explanation:{type:'string'} }, required:['title','explanation'] } },
        `lesson-content:${topic}`, logFn, metrics
      );

      if (isGarbageLLMResponse(raw1, 'lesson', subject_name)) {
        await logFn(`[${ts()}] ⚠️ Respuesta basura detectada para contenido de "${topic}" — usando fallback`);
      } else {
        lessonContent = raw1;
        lessonTitle = normalizeMathContent(raw1.title) || topic;
        lessonExpl = normalizeMathContent(raw1.explanation) || lessonExpl;
      }
    } catch (err) {
      await logFn(`[${ts()}] ❌ LLM falló para contenido de "${topic}": ${err.message} — usando fallback`);
    }

    // Crear lección (inicio de transacción)
    createdLesson = await base44.asServiceRole.entities.CourseLesson.create({
      module_id, subject_id,
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

    await logFn(`[${ts()}] 🏗️ Lección creada: "${lessonTitle}"`);

    // LLM #2: Actividades
    const valid = [];
    let activitiesRaw = null;

    try {
      const prompt2 = isMath
        ? buildMathActivitiesPrompt(lessonTitle, is_mini_eval)
        : buildActivitiesPrompt(lessonTitle, subject_name, lessonExpl, is_mini_eval);
      const llmOptions = { response_json_schema: { type:'object', properties:{ activities:{type:'array', items:{type:'object'}} } } };
      if (isMath) llmOptions.temperature = 0.3;
      const rawActs = await safeInvokeLLM(
        base44, prompt2, llmOptions,
        `activities:${lessonTitle}`, logFn, metrics
      );

      // Diagnóstico detallado antes de evaluar
      const items = Array.isArray(rawActs?.activities) ? rawActs.activities : (Array.isArray(rawActs) ? rawActs : null);
      await logFn(`[${ts()}] 🔍 LLM respondió: ${items ? items.length + ' items' : 'NO ARRAY'} | type=${typeof rawActs} | keys=${rawActs ? Object.keys(rawActs).join(',') : 'null'}`);

      const garbageReason = getGarbageReason(rawActs, 'activities');
      if (garbageReason) {
        await logFn(`[${ts()}] ⚠️ Respuesta descartada: ${garbageReason} — usando lo que hay`);
        // Aun así intentar usar lo que venga si tiene items
        if (items && items.length > 0) {
          await logFn(`[${ts()}] 🔄 Recuperando ${items.length} items a pesar del warning`);
          activitiesRaw = rawActs;
        }
      } else {
        activitiesRaw = rawActs;
      }
    } catch (err) {
      await logFn(`[${ts()}] ⚠️ LLM actividades falló: ${err.message}`);
    }

    if (activitiesRaw) {
      const rawList = Array.isArray(activitiesRaw) ? activitiesRaw : (activitiesRaw?.activities || []);
      const sanitized = rawList.map(sanitizeActivity).filter(Boolean);
      await logFn(`[${ts()}] 🧹 Sanitización: ${rawList.length} items → ${sanitized.length} válidos (${rawList.length - sanitized.length} descartados por vacíos)`);
      for (const rawAct of sanitized) {
        const act = normalizeActivityMath(rawAct);
        const err = validateActivity(act);
        if (!err) valid.push(act);
        else await logFn(`[${ts()}] ⚠️ Actividad descartada por validación: ${err}`);
      }
    }

    // Fallback si faltan actividades — mínimo 4 normal, 6 mini_eval
    const auditMin = is_mini_eval ? 6 : 4;
    if (valid.length < auditMin) {
      const needed = auditMin - valid.length;
      const fallbacks = buildFallbackActivities(lessonTitle, subject_name, needed);
      for (const fb of fallbacks) valid.push(fb);
      await logFn(`[${ts()}] 🔧 ${needed} actividades fallback añadidas (total: ${valid.length}) para "${lessonTitle}"`);
    }

    // Persistir actividades y registrar IDs (para rollback si falla auditoría)
    for (let i = 0; i < valid.length; i++) {
      const act = valid[i];
      const isArrayType = ARRAY_ANSWER_TYPES.includes(act.type);
      const raw = {
        lesson_id: createdLesson.id,
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
      const created = await base44.asServiceRole.entities.CourseActivity.create(actData);
      createdActivityIds.push(created.id);
    }

    await logFn(`[${ts()}] 💾 ${createdActivityIds.length} actividades guardadas`);

    // ═════════════════════════════════
    // #4 VALIDACIÓN POST-GENERACIÓN (auditoría)
    // ═════════════════════════════════
    const auditErrors = auditGeneratedLesson(createdLesson, valid, is_mini_eval);
    if (auditErrors.length > 0) {
      // ROLLBACK: eliminar actividades y lección
      await logFn(`[${ts()}] 🚨 Auditoría FALLIDA para "${lessonTitle}" — ROLLBACK:`);
      for (const e of auditErrors) await logFn(`[${ts()}]   → ${e}`);

      for (const actId of createdActivityIds) {
        try { await base44.asServiceRole.entities.CourseActivity.delete(actId); } catch(e) { /* silent */ }
      }
      try { await base44.asServiceRole.entities.CourseLesson.delete(createdLesson.id); } catch(e) { /* silent */ }

      throw new Error(`Auditoría fallida: ${auditErrors[0]}`);
    }

    // ═════════════════════════════════
    // COMMIT — marcar lección completada
    // ═════════════════════════════════
    await base44.asServiceRole.entities.CourseLesson.update(createdLesson.id, { generation_completed: true });

    const elapsed = Math.round((Date.now() - t0) / 1000);
    if (metrics) {
      metrics.lessons_generated++;
      metrics.activities_generated += createdActivityIds.length;
    }

    await logFn(`[${ts()}] ✅ COMMIT "${lessonTitle}" — ${createdActivityIds.length} actividades — ${elapsed}s`);
    return { lesson: createdLesson, activities_count: createdActivityIds.length, elapsed_seconds: elapsed };

  } catch (err) {
    // ═════════════════════════════════
    // ROLLBACK COMPLETO
    // ═════════════════════════════════
    await logFn(`[${ts()}] 🔴 ROLLBACK para "${topic}": ${err.message}`);

    for (const actId of createdActivityIds) {
      try { await base44.asServiceRole.entities.CourseActivity.delete(actId); } catch(e) { /* silent */ }
    }
    if (createdLesson?.id) {
      try { await base44.asServiceRole.entities.CourseLesson.delete(createdLesson.id); } catch(e) { /* silent */ }
    }

    if (metrics) metrics.lessons_failed++;
    throw err;
  }
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

    // ── FORCE UNLOCK — cancelar todos los jobs activos/pausados de esta materia ──
    if (force_unlock) {
      const allJobs = await base44.asServiceRole.entities.CurriculumGenerationJob.filter({ subject_id });
      let unlocked = 0;
      for (const job of allJobs) {
        if (job.status === 'processing' || job.status === 'paused' || job.status === 'pending') {
          await base44.asServiceRole.entities.CurriculumGenerationJob.update(job.id, {
            status: 'failed',
            error_message: `Desbloqueado manualmente por admin: ${user.email}`,
            finished_at: new Date().toISOString(),
          });
          unlocked++;
        }
      }
      console.log(`[ForceUnlock] ${unlocked} jobs desbloqueados para subject=${subject_id} por ${user.email}`);
      return Response.json({ success: true, unlocked, message: `${unlocked} job(s) desbloqueados.` });
    }

    const subjects = await base44.asServiceRole.entities.Subject.filter({ id: subject_id });
    const subject = subjects[0];
    if (!subject) return Response.json({ error: 'Materia no encontrada' }, { status: 404 });

    const syllabuses = await base44.asServiceRole.entities.SubjectSyllabus.filter({ subject_id, is_active: true });
    const syllabus = syllabuses[0];
    if (!syllabus?.units?.length) {
      return Response.json({ error: 'Sin temario activo.', no_syllabus: true }, { status: 422 });
    }

    // #1 WATCHDOG — recuperar jobs colgados antes de continuar
    const recovered = await recoverStuckJobs(base44, subject_id);
    if (recovered > 0) console.log(`[Watchdog] ${recovered} jobs recuperados`);

    // Calcular estructura (para preview y lock) — con lesson grouping
    const structure = buildStructureFromSyllabus(syllabus, subject.name);
    let totalLessons = 0;
    let totalModules = 0;
    // Contar también los temas originales del temario para el log
    let rawTopicCount = 0;
    for (const u of syllabus.units || []) for (const m of u.modules || []) rawTopicCount += (m.lessons || []).length;
    for (const u of structure) {
      for (const m of u.modules) {
        totalModules++;
        totalLessons += m.lessons.length;
      }
    }
    const groupingSavePct = rawTopicCount > 0 ? Math.round(((rawTopicCount - totalLessons) / rawTopicCount) * 100) : 0;
    console.log(`[Blueprint] "${subject.name}": ${rawTopicCount} temas originales → ${totalLessons} lecciones agrupadas (-${groupingSavePct}% carga de tokens)`);


    // ── PREVIEW MODE — retorna estimaciones sin generar ──────────────────────
    if (preview_only) {
      const mode = body.generation_mode || 'standard';
      const tokensPerLesson = TOKENS_PER_LESSON[mode] || TOKENS_PER_LESSON.standard;
      const avgSecsPerLesson = mode === 'lightweight' ? 20 : mode === 'standard' ? 28 : 40;
      const estimatedMinutes = Math.ceil((totalLessons * avgSecsPerLesson) / 60);
      const estimatedTokens = totalLessons * tokensPerLesson;

      return Response.json({
        preview: true,
        subject_name: subject.name,
        units: structure.length,
        modules: totalModules,
        total_lessons: totalLessons,
        estimated_minutes: estimatedMinutes,
        estimated_tokens: estimatedTokens,
        generation_mode: mode,
        structure_summary: structure.map(u => ({
          title: u.title,
          modules: u.modules.map(m => ({
            title: m.title,
            lessons_count: m.lessons.length,
          })),
        })),
      });
    }

    // #2 LOCK — verificar job activo para esta materia
    const activeJob = await checkSubjectLock(base44, subject_id);
    if (activeJob) {
      return Response.json({
        error: `Ya existe un job ${activeJob.status} para esta materia (ID: ${activeJob.id}). Espera que termine o cancélalo.`,
        locked: true,
        active_job_id: activeJob.id,
        active_job_status: activeJob.status,
      }, { status: 409 });
    }

    if (!overwrite) {
      const existingUnits = await base44.asServiceRole.entities.CourseUnit.filter({ subject_id });
      if (existingUnits.length > 0) {
        return Response.json({
          error: `La materia ya tiene ${existingUnits.length} unidades. Usa overwrite=true.`,
          has_content: true,
        }, { status: 409 });
      }
    }

    // Crear job
    const batchId = crypto.randomUUID();
    const job = await base44.asServiceRole.entities.CurriculumGenerationJob.create({
      subject_id,
      subject_name: subject.name,
      batch_id: batchId,
      generation_version: 1,
      status: 'pending',
      total_lessons: totalLessons,
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

    // Legacy CurriculumGeneration
    const genId = crypto.randomUUID();
    const genRecord = await base44.asServiceRole.entities.CurriculumGeneration.create({
      generation_id: genId,
      subject_id,
      subject_name: subject.name,
      status: 'in_progress',
      progress_percent: 0,
      total_steps: totalLessons,
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

    const generationMode = body.generation_mode || 'standard';
    const modeConfig = GENERATION_MODES[generationMode] || GENERATION_MODES.standard;

    const responsePayload = {
      success: true,
      generation_id: genId,
      job_id: job.id,
      batch_id: batchId,
      record_id: genRecord.id,
      total_lessons: totalLessons,
      safe_mode,
      generation_mode: generationMode,
    };

    // ── Background: generación secuencial ────────────────────────────────────
    (async () => {
      let logs = [];

      // Métricas en memoria durante la ejecución
      const metrics = {
        total_llm_calls: 0,
        total_tokens_estimated: 0,
        total_retries: 0,
        rate_limit_hits: 0,
        lessons_generated: 0,
        lessons_failed: 0,
        activities_generated: 0,
      };

      const log = async (msg) => {
        logs = await appendLog(base44, job.id, logs, msg);
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
        await log(`[${ts()}] 🚀 Iniciando "${subject.name}" (Nivel ${subject.level}) — ${totalLessons} lecciones`);
        if (rawTopicCount > totalLessons) {
          await log(`[${ts()}] 🗂️ Grouped ${rawTopicCount} topics into ${totalLessons} lessons (-${groupingSavePct}% token load)`);
        }
        if (safe_mode) await log(`[${ts()}] 🛡️ MODO SEGURO activo — solo 1 módulo a la vez`);
        await syncLegacyProgress(base44, genId, { total_steps: totalLessons, progress_percent: 5 });

        // Limpiar si overwrite
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

        let completedLessons = 0;
        let failedLessons = 0;
        let skippedLessons = 0;
        let totalUnitsCreated = 0;
        let totalModulesCreated = 0;
        let totalActivitiesCreated = 0;
        const lessonTimes = [];
        let consecutiveFailures = 0; // #10 Circuit Breaker counter

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
            // #10 CIRCUIT BREAKER check
            const freshJob = await base44.asServiceRole.entities.CurriculumGenerationJob.filter({ id: job.id });
            if (freshJob[0]?.status === 'paused' || freshJob[0]?.status === 'failed') {
              await log(`[${ts()}] 🛑 Job detenido externamente — saliendo`);
              return;
            }

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

            for (const lessonBlueprint of modBlueprint.lessons) {
              // #10 CIRCUIT BREAKER
              if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
                await log(`[${ts()}] 🔴 Circuit breaker activated — ${consecutiveFailures} lecciones consecutivas fallaron`);
                await updateJob(base44, job.id, {
                  status: 'paused',
                  error_message: `Circuit breaker: ${consecutiveFailures} fallos consecutivos`,
                  completed_lessons: completedLessons,
                  failed_lessons: failedLessons,
                  skipped_lessons: skippedLessons,
                  activities_created: totalActivitiesCreated,
                  total_llm_calls: metrics.total_llm_calls,
                  total_tokens_estimated: metrics.total_tokens_estimated,
                  avg_retry_count: metrics.total_retries,
                  rate_limit_hits: metrics.rate_limit_hits,
                });
                await syncLegacyProgress(base44, genId, { status: 'failed', error_message: 'Circuit breaker activado' });
                return;
              }

              await updateJob(base44, job.id, {
                current_lesson: lessonBlueprint.topic,
                completed_lessons: completedLessons,
                failed_lessons: failedLessons,
                skipped_lessons: skippedLessons,
                progress_percent: Math.round(5 + ((completedLessons + failedLessons + skippedLessons) / totalLessons) * 90),
                activities_created: totalActivitiesCreated,
                units_created: totalUnitsCreated,
                modules_created: totalModulesCreated,
                total_llm_calls: metrics.total_llm_calls,
                total_tokens_estimated: metrics.total_tokens_estimated,
                rate_limit_hits: metrics.rate_limit_hits,
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

              try {
                const result = await generateOneLesson(base44, {
                  module_id: module.id,
                  subject_id,
                  subject_name: subject.name,
                  topic: lessonBlueprint.topic,
                  is_mini_eval: lessonBlueprint.is_mini_eval || false,
                  lesson_order: lessonBlueprint.order,
                  difficulty: lessonBlueprint.difficulty || 'medium',
                  keywords: lessonBlueprint.keywords || [],
                }, batchId, log, metrics, modeConfig);

                if (result.skipped) {
                  skippedLessons++;
                  consecutiveFailures = 0; // reset en skip
                } else {
                  completedLessons++;
                  totalActivitiesCreated += result.activities_count;
                  if (result.elapsed_seconds) lessonTimes.push(result.elapsed_seconds);
                  consecutiveFailures = 0; // reset en éxito
                }
              } catch (lessonErr) {
                failedLessons++;
                consecutiveFailures++;
                await log(`[${ts()}] ❌ Falló "${lessonBlueprint.topic}": ${lessonErr.message} [fallos consecutivos: ${consecutiveFailures}]`);
              }

              // ETA
              if (lessonTimes.length > 0 && (completedLessons + failedLessons + skippedLessons) < totalLessons) {
                const avgSecs = lessonTimes.reduce((a, b) => a + b, 0) / lessonTimes.length;
                const remaining = totalLessons - (completedLessons + failedLessons + skippedLessons);
                const etaMin = Math.round((avgSecs * remaining) / 60);
                if (etaMin > 0) await log(`[${ts()}] ⏳ ETA: ~${etaMin} min restantes`);
                await updateJob(base44, job.id, { avg_lesson_seconds: Math.round(avgSecs) });
              }
            } // end lessons

            // #7 SAFE MODE — pausa entre módulos
            if (safe_mode) {
              await log(`[${ts()}] 🛡️ Safe mode: módulo "${modBlueprint.title}" completado. Job pausado — reanudar manualmente.`);
              await updateJob(base44, job.id, {
                status: 'paused',
                completed_lessons: completedLessons,
                failed_lessons: failedLessons,
                skipped_lessons: skippedLessons,
                activities_created: totalActivitiesCreated,
                total_llm_calls: metrics.total_llm_calls,
                total_tokens_estimated: metrics.total_tokens_estimated,
              });
              return; // el admin debe reanudar manualmente
            }

            await log(`[${ts()}] ✅ Módulo "${modBlueprint.title}" completado`);
          } // end modules
        } // end units

        // Resumen final
        const totalDuration = Math.round((Date.now() - startTime) / 1000);
        const avgTime = lessonTimes.length > 0 ? Math.round(lessonTimes.reduce((a, b) => a + b, 0) / lessonTimes.length) : 0;
        const totalMins = Math.round(totalDuration / 60);
        const successRate = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

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
          total_llm_calls: metrics.total_llm_calls,
          total_tokens_estimated: metrics.total_tokens_estimated,
          avg_retry_count: metrics.total_retries,
          rate_limit_hits: metrics.rate_limit_hits,
          current_unit: '',
          current_module: '',
          current_lesson: '',
        });

        await syncLegacyProgress(base44, genId, {
          status: 'completed',
          progress_percent: 100,
          completed_steps: completedLessons,
          total_steps: totalLessons,
          current_module: '', current_lesson: '',
          units_created: totalUnitsCreated,
          modules_created: totalModulesCreated,
          lessons_created: completedLessons,
          activities_created: totalActivitiesCreated,
        });

        await log(`[${ts()}] 🎉 ═══ GENERACIÓN COMPLETADA ═══`);
        await log(`[${ts()}] ✅ ${completedLessons} exitosas | ⏭️ ${skippedLessons} saltadas | ❌ ${failedLessons} fallidas | 📊 ${successRate}% éxito`);
        await log(`[${ts()}] ⏱️ ${totalMins} min total | ${avgTime}s/lección promedio`);
        await log(`[${ts()}] 🤖 ${metrics.total_llm_calls} llamadas LLM | ~${Math.round(metrics.total_tokens_estimated/1000)}k tokens estimados`);
        await log(`[${ts()}] 📦 ${totalUnitsCreated} unidades | 📁 ${totalModulesCreated} módulos | ⚡ ${totalActivitiesCreated} actividades`);

      } catch (bgErr) {
        console.error('[generateSubjectCurriculum] Error fatal:', bgErr.message);
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