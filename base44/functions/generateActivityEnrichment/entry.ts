import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ═══════════════════════════════════════════════════════════════════
// generateActivityEnrichment
// Genera on-demand: hint, detailed_explanation, example, incorrect_feedback
// Cache por activity_id + mode. Nunca regenera si ya existe.
// ═══════════════════════════════════════════════════════════════════

const VALID_MODES = ['hint', 'detailed_explanation', 'example', 'incorrect_feedback'];

async function getOrCreateEnrichment(base44, activityId) {
  const existing = await base44.asServiceRole.entities.ActivityEnrichment.filter({ activity_id: activityId });
  return existing[0] || null;
}

function buildHintPrompt(activity) {
  return `Eres un tutor de preparatoria. El alumno necesita una pista para la siguiente pregunta.

Tipo: ${activity.type}
Pregunta: "${activity.question}"
Opciones: ${activity.options?.length ? activity.options.join(', ') : 'N/A'}
Respuesta correcta (NO la reveles): "${activity.correct_answer || activity.correct_answers?.join(', ')}"

Genera 2 pistas progresivas:
- hints[0]: pista suave — orienta sin revelar la respuesta
- hints[1]: pista más directa — reduce opciones pero sin dar la respuesta completa

Para matemáticas usa LaTeX: $expresión$.
Responde SOLO JSON: {"hints": ["pista1", "pista2"]}`;
}

function buildDetailedPrompt(activity) {
  return `Eres un tutor de preparatoria. Explica detalladamente la respuesta correcta.

Pregunta: "${activity.question}"
Respuesta correcta: "${activity.correct_answer || activity.correct_answers?.join(', ')}"
Explicación básica ya dada: "${activity.explanation || ''}"

Genera:
- detailed_explanation: explicación paso a paso (3-5 oraciones). Incluye el razonamiento completo.
- example_explanation: un ejemplo concreto diferente que ilustre el mismo concepto.

Para matemáticas usa LaTeX: $expresión$.
Responde SOLO JSON: {"detailed_explanation": "...", "example_explanation": "..."}`;
}

function buildFeedbackPrompt(activity, userAnswer) {
  return `Eres un tutor empático de preparatoria. Un alumno respondió incorrectamente.

Pregunta: "${activity.question}"
Respuesta del alumno: "${userAnswer || 'no especificada'}"
Respuesta correcta: "${activity.correct_answer || activity.correct_answers?.join(', ')}"

Genera feedback pedagógico breve (1-2 oraciones) que:
- Explique específicamente por qué esa respuesta es incorrecta
- Oriente hacia la respuesta correcta sin revelarla directamente
- Sea empático y motivador

Para matemáticas usa LaTeX: $expresión$.
Responde SOLO JSON: {"feedback": "..."}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { activity_id, mode, user_answer } = body;

    if (!activity_id) return Response.json({ error: 'activity_id requerido' }, { status: 400 });
    if (!VALID_MODES.includes(mode)) return Response.json({ error: `mode inválido. Válidos: ${VALID_MODES.join(', ')}` }, { status: 400 });

    // ── Cargar actividad ──────────────────────────────────────────
    const activities = await base44.asServiceRole.entities.CourseActivity.filter({ id: activity_id });
    const activity = activities[0];
    if (!activity) return Response.json({ error: 'Actividad no encontrada' }, { status: 404 });

    // ── Cache check ───────────────────────────────────────────────
    const existing = await getOrCreateEnrichment(base44, activity_id);

    // Para incorrect_feedback usamos user_answer como parte de la clave de cache
    const feedbackKey = mode === 'incorrect_feedback' ? `fb_${(user_answer || '').slice(0, 20)}` : null;

    if (existing) {
      if (mode === 'hint' && existing.hints?.length > 0) {
        console.log(`[EnrichCache HIT] activity=${activity_id} mode=hint`);
        return Response.json({ mode, data: existing.hints, cache_hit: true });
      }
      if (mode === 'detailed_explanation' && existing.detailed_explanation) {
        console.log(`[EnrichCache HIT] activity=${activity_id} mode=detailed_explanation`);
        return Response.json({ mode, data: existing.detailed_explanation, example: existing.example_explanation, cache_hit: true });
      }
      if (mode === 'example' && existing.example_explanation) {
        console.log(`[EnrichCache HIT] activity=${activity_id} mode=example`);
        return Response.json({ mode, data: existing.example_explanation, cache_hit: true });
      }
      if (mode === 'incorrect_feedback' && existing.incorrect_feedback?.[feedbackKey]) {
        console.log(`[EnrichCache HIT] activity=${activity_id} mode=incorrect_feedback key=${feedbackKey}`);
        return Response.json({ mode, data: existing.incorrect_feedback[feedbackKey], cache_hit: true });
      }
    }

    console.log(`[EnrichCache MISS] activity=${activity_id} mode=${mode} — generando con LLM`);

    // ── Generar con LLM ───────────────────────────────────────────
    let result = null;
    let updatePatch = {};

    if (mode === 'hint') {
      const raw = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildHintPrompt(activity),
        response_json_schema: {
          type: 'object',
          properties: { hints: { type: 'array', items: { type: 'string' } } }
        }
      });
      const hints = Array.isArray(raw?.hints) && raw.hints.length > 0 ? raw.hints : [`Revisa el concepto relacionado con "${activity.question}"`];
      updatePatch = { hints };
      result = { mode, data: hints, cache_hit: false };
    }

    if (mode === 'detailed_explanation' || mode === 'example') {
      // Generar ambos a la vez (mismo costo, misma llamada)
      const raw = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildDetailedPrompt(activity),
        response_json_schema: {
          type: 'object',
          properties: {
            detailed_explanation: { type: 'string' },
            example_explanation: { type: 'string' }
          }
        }
      });
      const detailed = raw?.detailed_explanation || activity.explanation || '';
      const example = raw?.example_explanation || '';
      updatePatch = { detailed_explanation: detailed, example_explanation: example };

      if (mode === 'detailed_explanation') {
        result = { mode, data: detailed, example, cache_hit: false };
      } else {
        result = { mode, data: example, cache_hit: false };
      }
    }

    if (mode === 'incorrect_feedback') {
      const raw = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: buildFeedbackPrompt(activity, user_answer),
        response_json_schema: {
          type: 'object',
          properties: { feedback: { type: 'string' } }
        }
      });
      const feedback = raw?.feedback || 'Revisa la respuesta correcta y el razonamiento.';
      const currentFeedback = existing?.incorrect_feedback || {};
      updatePatch = { incorrect_feedback: { ...currentFeedback, [feedbackKey]: feedback } };
      result = { mode, data: feedback, cache_hit: false };
    }

    // ── Persistir en cache ────────────────────────────────────────
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

    console.log(`[EnrichGenerated] activity=${activity_id} mode=${mode}`);
    return Response.json(result);

  } catch (e) {
    console.error('generateActivityEnrichment error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});