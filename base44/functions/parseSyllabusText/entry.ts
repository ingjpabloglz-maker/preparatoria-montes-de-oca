import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { text, subject_name } = await req.json();
    if (!text?.trim()) return Response.json({ error: 'text requerido' }, { status: 400 });

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Eres un experto en diseño curricular. Convierte el siguiente temario en texto libre a una estructura JSON jerárquica válida.

MATERIA: "${subject_name || 'General'}"

TEMARIO EN TEXTO:
---
${text}
---

REGLAS:
1. Identifica unidades (pueden estar marcadas como "Unidad N:", "UNIDAD N", "Bloque N", etc.)
2. Dentro de cada unidad, identifica módulos o temas principales
3. Dentro de cada módulo, identifica subtemas o lecciones específicas
4. El ÚLTIMO elemento de cada módulo debe ser una mini-evaluación (is_mini_eval: true) con topic: "Evaluación: [título del módulo]"
5. Asigna dificultad progresiva: lecciones iniciales = "easy", intermedias = "medium", finales = "hard"
6. Extrae keywords relevantes de cada lección (2-4 palabras clave)
7. Si el texto no tiene estructura clara, interpreta el mejor agrupamiento pedagógico posible
8. Mantén los títulos lo más fieles al texto original

Devuelve SOLO el JSON con esta estructura exacta:
{
  "units": [
    {
      "title": "Nombre de la Unidad",
      "order": 1,
      "modules": [
        {
          "title": "Nombre del Módulo",
          "order": 1,
          "lessons": [
            {
              "topic": "Tema específico",
              "order": 1,
              "difficulty": "easy",
              "keywords": ["palabra1", "palabra2"],
              "is_mini_eval": false
            },
            {
              "topic": "Evaluación: Nombre del Módulo",
              "order": 2,
              "difficulty": "medium",
              "keywords": [],
              "is_mini_eval": true
            }
          ]
        }
      ]
    }
  ]
}`,
      response_json_schema: {
        type: "object",
        properties: {
          units: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                order: { type: "number" },
                modules: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      order: { type: "number" },
                      lessons: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            topic: { type: "string" },
                            order: { type: "number" },
                            difficulty: { type: "string" },
                            keywords: { type: "array", items: { type: "string" } },
                            is_mini_eval: { type: "boolean" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!result?.units?.length) {
      return Response.json({ error: 'No se pudo parsear el temario. Verifica el formato del texto.' }, { status: 422 });
    }

    return Response.json({ success: true, structure: result });
  } catch (e) {
    console.error('parseSyllabusText error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});