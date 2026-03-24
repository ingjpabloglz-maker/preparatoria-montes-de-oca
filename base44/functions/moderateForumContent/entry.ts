import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Palabras clave sospechosas - filtro rápido sin IA
const FORBIDDEN_PATTERNS = [
  "la respuesta es",
  "respuesta es",
  "respuesta correcta es",
  "la correcta es",
  "es la opción",
  "es la opcion",
  "opción correcta",
  "opcion correcta",
  "la solución es",
  "la solucion es",
  "solución completa",
  "solucion completa",
  "respuestas del examen",
  "soluciones del examen",
  "pregunta 1 es",
  "pregunta 2 es",
  "pregunta 3 es",
  "inciso a)",
  "inciso b)",
  "inciso c)",
  "la b es correcta",
  "la a es correcta",
  "la c es correcta",
  "la d es correcta",
  "elige la opción",
  "marca la opción",
];

function checkForbiddenPatterns(content) {
  const lower = content.toLowerCase();
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (lower.includes(pattern)) {
      return { matched: true, pattern };
    }
  }
  return { matched: false };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { content, user_email } = await req.json();

  if (!content || content.trim().length === 0) {
    return Response.json({ is_cheating: false, confidence: 0, reason: '' });
  }

  // ── 1. FILTRO RÁPIDO POR PATRONES ────────────────────────────────────────────
  const patternCheck = checkForbiddenPatterns(content);
  if (patternCheck.matched) {
    // Registrar incidencia y aplicar penalización
    await applyPenalty(base44, user_email || user.email, `Patrón detectado: "${patternCheck.pattern}"`);
    return Response.json({
      is_cheating: true,
      confidence: 0.95,
      reason: `Se detectó el patrón prohibido: "${patternCheck.pattern}". No está permitido compartir ni solicitar respuestas directas.`,
      source: 'pattern',
    });
  }

  // ── 2. ANÁLISIS CON IA ────────────────────────────────────────────────────────
  const prompt = `Eres el moderador de un foro educativo de preparatoria. Tu trabajo es detectar intentos de trampa.

Analiza el siguiente mensaje y determina si el usuario está:
1. Pidiendo respuestas directas a ejercicios o exámenes
2. Compartiendo respuestas correctas o soluciones
3. Copiando preguntas literales del sistema para que otros las resuelvan
4. Mencionando opciones correctas (ej: "la respuesta es B", "elige la opción 3")

PERMITIDO (no es trampa):
- Pedir explicación de un concepto matemático o de otra materia
- Preguntar cómo se resuelve un tipo de problema (sin pedir la respuesta)
- Compartir estrategias generales de estudio
- Preguntar sobre temas del temario sin pedir soluciones
- Discutir ideas o teorías

BLOQUEADO (es trampa):
- "¿Cuánto es 4x + 5x?" (ejercicio específico pidiendo respuesta)
- "La respuesta de la pregunta 3 es B"
- "Alguien tiene las respuestas del examen de nivel 2?"
- "¿Qué opción es correcta en la actividad de fracciones?"
- Dar soluciones paso a paso de ejercicios específicos del sistema

Mensaje a analizar:
"""
${content}
"""

Responde SOLO con JSON válido:
{
  "is_cheating": true o false,
  "confidence": número entre 0 y 1,
  "reason": "explicación breve en español de máximo 2 oraciones"
}`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        is_cheating: { type: 'boolean' },
        confidence: { type: 'number' },
        reason: { type: 'string' },
      },
    },
  });

  if (result.is_cheating && result.confidence >= 0.7) {
    await applyPenalty(base44, user_email || user.email, result.reason);
  }

  return Response.json({ ...result, source: 'ai' });
});

async function applyPenalty(base44, user_email, reason) {
  // Buscar penalización existente
  const penalties = await base44.asServiceRole.entities.ForumPenalty.filter({ user_email });
  const existing = penalties?.[0];

  const now = new Date();
  let incidentCount = (existing?.incident_count || 0) + 1;

  // Días de bloqueo por incidencia: 1, 3, 7, 14, 30...
  const banDays = incidentCount === 1 ? 1
    : incidentCount === 2 ? 3
    : incidentCount === 3 ? 7
    : incidentCount === 4 ? 14
    : 30;

  const bannedUntil = new Date(now.getTime() + banDays * 24 * 60 * 60 * 1000).toISOString();

  const penaltyData = {
    user_email,
    incident_count: incidentCount,
    banned_until: bannedUntil,
    last_incident_date: now.toISOString(),
    last_incident_reason: reason,
  };

  if (existing) {
    await base44.asServiceRole.entities.ForumPenalty.update(existing.id, penaltyData);
  } else {
    await base44.asServiceRole.entities.ForumPenalty.create(penaltyData);
  }

  // Quitar XP si hay gamification profile
  const gamArr = await base44.asServiceRole.entities.GamificationProfile.filter({ user_email });
  const gam = gamArr?.[0];
  if (gam) {
    const xpPenalty = Math.min(gam.xp_points || 0, 20 * incidentCount);
    await base44.asServiceRole.entities.GamificationProfile.update(gam.id, {
      xp_points: Math.max(0, (gam.xp_points || 0) - xpPenalty),
      streak_days: 0, // reset streak
    });
  }
}