import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ═══════════════════════════════════════════════════════════════════════════════
// generateActivityEnrichment v2
// • Timeout 45s por llamada LLM
// • Retry con backoff exponencial (hasta 2 reintentos)
// • Control de costos: NO genera para easy/true_false simple
// • Máximo 3 enrichments distintos por actividad
// • Logs de tokens estimados
// • Cache por activity_id + mode + generation_version
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_MODES = ['hint', 'detailed_explanation', 'example', 'incorrect_feedback'];
const BACKOFF = [0, 5000, 15000];
const LLM_TIMEOUT_MS = 45000;
// Tokens estimados por modo (input prompt ~chars/4 + output fijo)
const TOKENS_BY_MODE = { hint: 180, detailed_explanation: 350, example: 280, incorrect_feedback: 200 };

// ── Actividades que NO se enriquecen (control de costos) ───────────────────────
function shouldSkipEnrichment(activity) {
  if (activity.difficulty === 'easy') return 'difficulty=easy';
  if (activity.type === 'true_false') return 'type=true_false';
  return null;
}

// ── Contar enrichments existentes en el registro ──────────────────────────────
function countExistingEnrichments(record) {
  let count = 0;
  if (record?.hints?.length > 0) count++;
  if (record?.detailed_explanation) count++;
  if (record?.example_explanation) count++;
  if (record?.incorrect_feedback && Object.keys(record.incorrect_feedback).length > 0) count++;
  return count;
}

// ── Timeout + retry wrapper ────────────────────────────────────────────────────
async function invokeLLMWithRetry(base44, prompt, schema, label) {
  let lastErr;
  for (let attempt = 0; attempt <= 2; attempt++) {
    if (attempt > 0) {
      const delay = BACKOFF[attempt] || 15000;
      console.log(`[Enrichment] Retry ${attempt}/2 para "${label}" (espera ${delay/1000}s)`);
      await new Promise(r => setTimeout(r, delay));
    }
    try {
      const result = await Promise.race([
        base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema }),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`LLM_TIMEOUT: "${label}" superó ${LLM_TIMEOUT_MS}ms`)), LLM_TIMEOUT_MS)),
      ]);
      return result;
    } catch (err) {
      lastErr = err;
      const isRateLimit = err.message?.toLowerCase().includes('rate limit') || err.message?.includes('429');
      const isTimeout = err.message?.includes('LLM_TIMEOUT');
      console.warn(`[Enrichment] Attempt ${attempt} falló (${isRateLimit ? 'RateLimit' : isTimeout ? 'Timeout' : 'Error'}): ${err.message}`);
      if (attempt === 2) break;
    }
  }
  throw lastErr;
}

// ── Prompts ────────────────────────────────────────────────────────────────────
function buildHintPrompt(activity) {
  return `Tutor preparatoria. Genera 2 pistas progresivas para ayudar al alumno SIN revelar la respuesta.
Pregunta: "${activity.question}"
Tipo: ${activity.type}
Opciones: ${activity.options?.length ? activity.options.join(' | ') : 'N/A'}
[NO revelar respuesta: "${activity.correct_answer || activity.correct_answers?.join(', ')}"]
Pista 1: orientadora (1 línea). Pista 2: más directa (1 línea).
Matemáticas: usa LaTeX $expr$.
JSON: {"hints":["p1","p2"]}`;
}

function buildDetailedPrompt(activity) {
  return `Tutor preparatoria. Explica la respuesta correcta en máximo 5 líneas y da un ejemplo similar breve.
Pregunta: "${activity.question}"
Respuesta: "${activity.correct_answer || activity.correct_answers?.join(', ')}"
Explicación base: "${(activity.explanation || '').slice(0, 100)}"
Matemáticas: LaTeX $expr$.
JSON: {"detailed_explanation":"...","example_explanation":"..."}`;
}

function buildFeedbackPrompt(activity, userAnswer) {
  return `Tutor empático preparatoria. Alumno respondió incorrectamente.
Pregunta: "${activity.question}"
Respuesta del alumno: "${userAnswer || '?'}"
Respuesta correcta: "${activity.correct_answer || activity.correct_answers?.join(', ')}"
Explica en 1-3 líneas: por qué está mal + orientación motivadora. NO dar respuesta directa.
Matemáticas: LaTeX $expr$.
JSON: {"feedback":"..."}`;
}

// ── Handler principal ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const t0 = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { activity_id, mode, user_answer } = body;

    if (!activity_id) return Response.json({ error: 'activity_id requerido' }, { status: 400 });
    if (!VALID_MODES.includes(mode)) return Response.json({ error: `mode inválido. Válidos: ${VALID_MODES.join(', ')}` }, { status: 400 });

    // ── Cargar actividad ──────────────────────────────────────────────────────
    const activities = await base44.asServiceRole.entities.CourseActivity.filter({ id: activity_id });
    const activity = activities[0];
    if (!activity) return Response.json({ error: 'Actividad no encontrada' }, { status: 404 });

    // ── Control de costos: skip para easy / true_false ────────────────────────
    const skipReason = shouldSkipEnrichment(activity);
    if (skipReason) {
      console.log(`[Enrichment] SKIP activity=${activity_id} reason=${skipReason}`);
      // Retornar fallback sin generar
      const fallback = mode === 'hint'
        ? { mode, data: ['Revisa el concepto de la lección.', 'Lee la pregunta despacio y piensa en lo que sabes.'], cache_hit: false, skipped: true }
        : mode === 'incorrect_feedback'
          ? { mode, data: 'Revisa la explicación básica y vuelve a intentarlo.', cache_hit: false, skipped: true }
          : { mode, data: activity.explanation || '', example: '', cache_hit: false, skipped: true };
      return Response.json(fallback);
    }

    // ── Cargar registro de enrichment existente ───────────────────────────────
    const existing = (await base44.asServiceRole.entities.ActivityEnrichment.filter({ activity_id }))[0] || null;

    // ── Cache check ───────────────────────────────────────────────────────────
    const feedbackKey = mode === 'incorrect_feedback' ? `fb_${(user_answer || '').slice(0, 20)}` : null;

    if (existing) {
      if (mode === 'hint' && existing.hints?.length > 0) {
        console.log(`[EnrichCache HIT] ${activity_id} mode=hint`);
        return Response.json({ mode, data: existing.hints, cache_hit: true });
      }
      if (mode === 'detailed_explanation' && existing.detailed_explanation) {
        console.log(`[EnrichCache HIT] ${activity_id} mode=detailed_explanation`);
        return Response.json({ mode, data: existing.detailed_explanation, example: existing.example_explanation, cache_hit: true });
      }
      if (mode === 'example' && existing.example_explanation) {
        console.log(`[EnrichCache HIT] ${activity_id} mode=example`);
        return Response.json({ mode, data: existing.example_explanation, cache_hit: true });
      }
      if (mode === 'incorrect_feedback' && existing.incorrect_feedback?.[feedbackKey]) {
        console.log(`[EnrichCache HIT] ${activity_id} mode=incorrect_feedback key=${feedbackKey}`);
        return Response.json({ mode, data: existing.incorrect_feedback[feedbackKey], cache_hit: true });
      }

      // ── Control: máx 3 enrichments por actividad ──────────────────────────
      const existingCount = countExistingEnrichments(existing);
      if (existingCount >= 3) {
        console.log(`[Enrichment] LIMIT REACHED activity=${activity_id} count=${existingCount}/3`);
        // Retornar lo que tengamos o fallback
        const fallbackData = mode === 'hint'
          ? (existing.hints?.length > 0 ? existing.hints : ['Revisa el contenido de la lección.'])
          : mode === 'incorrect_feedback'
            ? 'Revisa la respuesta correcta y el razonamiento explicado.'
            : existing.detailed_explanation || activity.explanation || '';
        return Response.json({ mode, data: fallbackData, cache_hit: false, limit_reached: true });
      }
    }

    console.log(`[EnrichCache MISS] ${activity_id} mode=${mode} — generando LLM`);

    // ── Generar con LLM ───────────────────────────────────────────────────────
    let result = null;
    let updatePatch = {};
    const tokensEst = TOKENS_BY_MODE[mode] || 200;

    if (mode === 'hint') {
      const raw = await invokeLLMWithRetry(
        base44,
        buildHintPrompt(activity),
        { type: 'object', properties: { hints: { type: 'array', items: { type: 'string' } } } },
        `hint:${activity_id}`
      );
      const hints = Array.isArray(raw?.hints) && raw.hints.length > 0
        ? raw.hints
        : [`Piensa en la relación con "${activity.question.slice(0, 40)}".`, 'Elimina las opciones que claramente son incorrectas.'];
      updatePatch = { hints };
      result = { mode, data: hints, cache_hit: false };
    }

    if (mode === 'detailed_explanation' || mode === 'example') {
      const raw = await invokeLLMWithRetry(
        base44,
        buildDetailedPrompt(activity),
        { type: 'object', properties: { detailed_explanation: { type: 'string' }, example_explanation: { type: 'string' } } },
        `detail:${activity_id}`
      );
      const detailed = raw?.detailed_explanation || activity.explanation || '';
      const example = raw?.example_explanation || '';
      updatePatch = { detailed_explanation: detailed, example_explanation: example };
      result = mode === 'detailed_explanation'
        ? { mode, data: detailed, example, cache_hit: false }
        : { mode, data: example, cache_hit: false };
    }

    if (mode === 'incorrect_feedback') {
      const raw = await invokeLLMWithRetry(
        base44,
        buildFeedbackPrompt(activity, user_answer),
        { type: 'object', properties: { feedback: { type: 'string' } } },
        `feedback:${activity_id}`
      );
      const feedback = raw?.feedback || 'Revisa la respuesta correcta y el razonamiento.';
      const currentFeedback = existing?.incorrect_feedback || {};
      updatePatch = { incorrect_feedback: { ...currentFeedback, [feedbackKey]: feedback } };
      result = { mode, data: feedback, cache_hit: false };
    }

    // ── Persistir en cache ────────────────────────────────────────────────────
    const elapsed = Date.now() - t0;
    if (existing) {
      await base44.asServiceRole.entities.ActivityEnrichment.update(existing.id, {
        ...updatePatch,
        generated_at: new Date().toISOString(),
        generation_version: (existing.generation_version || 1) + 1,
      });
    } else {
      await base44.asServiceRole.entities.ActivityEnrichment.create({
        activity_id,
        hints: updatePatch.hints || [],
        detailed_explanation: updatePatch.detailed_explanation || '',
        example_explanation: updatePatch.example_explanation || '',
        incorrect_feedback: updatePatch.incorrect_feedback || {},
        generated_at: new Date().toISOString(),
        generated_for_error_type: mode,
        generation_version: 1,
      });
    }

    console.log(`[EnrichGenerated] ${activity_id} mode=${mode} ~${tokensEst}tok elapsed=${elapsed}ms`);
    return Response.json(result);

  } catch (e) {
    console.error('[generateActivityEnrichment] Error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});