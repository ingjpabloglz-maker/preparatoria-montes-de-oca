import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// generateSubjectCurriculum — v5 FINAL
// • 1 llamada LLM por lección
// • Solo: multiple_choice, true_false, fill_blank
// • Sin legacy, sin safe_mode, sin circuit breaker, sin enrichments

const VALID_TYPES = ['multiple_choice', 'true_false', 'fill_blank'];
const MAX_UNITS = 4;
const MAX_MODULES = 10;
const MAX_TOTAL_LESSONS = 26;

function ts() { return new Date().toLocaleTimeString('es-MX', { hour12: false }); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── LLM con retry simple ─────────────────────────────────────────────────────
async function invokeLLM(base44, prompt, label) {
  for (let attempt = 0; attempt <= 2; attempt++) {
    if (attempt > 0) await sleep(attempt * 10000);
    try {
      const result = await Promise.race([
        base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              explanation: {
                type: 'object',
                properties: {
                  intro: { type: 'string' },
                  key_points: { type: 'array', items: { type: 'object' } },
                  examples: { type: 'array', items: { type: 'object' } },
                  summary: { type: 'string' }
                }
              },
              activities: { type: 'array', items: { type: 'object' } }
            },
            required: ['title', 'explanation', 'activities']
          }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), 90000))
      ]);
      return result;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
}

// ─── Prompt estructurado ──────────────────────────────────────────────────────
function buildPrompt(topic, subjectName) {
  return 'Eres un docente experto de preparatoria. Genera una lección completa en JSON puro.\n' +
    'Tema: "' + topic + '"\nMateria: "' + subjectName + '"\n\n' +
    'RESPONDE SOLO EL JSON SIGUIENTE, sin texto extra, sin markdown, sin HTML:\n' +
    '{\n' +
    '  "title": "Título corto del tema",\n' +
    '  "explanation": {\n' +
    '    "intro": "Introducción breve y clara de 1-2 oraciones que explique de qué trata el tema.",\n' +
    '    "key_points": [\n' +
    '      { "title": "Subtema o concepto", "content": "Explicación clara y sencilla.", "example": "Ejemplo corto concreto." }\n' +
    '    ],\n' +
    '    "examples": [\n' +
    '      { "question": "Ejercicio o situación práctica", "solution": "Resolución o respuesta." }\n' +
    '    ],\n' +
    '    "summary": "Resumen final corto de 1-2 oraciones."\n' +
    '  },\n' +
    '  "activities": [\n' +
    '    { "type": "multiple_choice", "question": "Pregunta", "options": ["A","B","C","D"], "correct_answer": "A", "explanation": "Explicación corta" },\n' +
    '    { "type": "true_false", "question": "Afirmación", "options": ["Verdadero","Falso"], "correct_answer": "Verdadero", "explanation": "Explicación corta" },\n' +
    '    { "type": "fill_blank", "question": "Completa: ___ ...", "options": [], "correct_answer": "respuesta", "explanation": "Explicación corta" },\n' +
    '    { "type": "multiple_choice", "question": "Pregunta 2", "options": ["A","B","C","D"], "correct_answer": "B", "explanation": "Explicación corta" },\n' +
    '    { "type": "true_false", "question": "Afirmación 2", "options": ["Verdadero","Falso"], "correct_answer": "Falso", "explanation": "Explicación corta" }\n' +
    '  ]\n' +
    '}\n\n' +
    'REGLAS OBLIGATORIAS:\n' +
    '- explanation.intro: 1-2 oraciones, lenguaje claro para preparatoria.\n' +
    '- explanation.key_points: entre 3 y 6 elementos. Cada uno con title, content y example.\n' +
    '  * Si el tema es matemático/científico: incluir operaciones, números, fórmulas simples en content y example.\n' +
    '  * Si el tema es teórico: usar ejemplos cotidianos, comparaciones o contexto histórico.\n' +
    '- explanation.examples: entre 1 y 3 ejercicios o situaciones prácticas con su solución.\n' +
    '- explanation.summary: 1-2 oraciones resumiendo el tema.\n' +
    '- activities: 4-5 actividades, SOLO tipos multiple_choice/true_false/fill_blank.\n' +
    '- Todas las preguntas deben ser diferentes entre sí.\n' +
    '- correct_answer debe ser exactamente igual a uno de los options.\n' +
    '- NO generar HTML, markdown, SVG, código, imágenes ni propiedades extra.\n' +
    '- Solo JSON válido.';
}

// ─── Validación mínima ────────────────────────────────────────────────────────
function isValidActivity(act) {
  if (!act || !act.question || !act.type || !act.correct_answer) return false;
  if (!VALID_TYPES.includes(act.type)) return false;
  if (act.type === 'multiple_choice' && (!Array.isArray(act.options) || act.options.length < 2)) return false;
  return true;
}

// ─── Normalizar explanation (string legacy → objeto nuevo) ───────────────────
function normalizeExplanation(raw, title, subjectName) {
  // Ya es objeto estructurado válido
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.intro) {
    return {
      intro: String(raw.intro || ''),
      key_points: Array.isArray(raw.key_points) ? raw.key_points.map(kp => ({
        title: String(kp.title || ''),
        content: String(kp.content || ''),
        example: String(kp.example || ''),
      })) : [],
      examples: Array.isArray(raw.examples) ? raw.examples.map(ex => ({
        question: String(ex.question || ''),
        solution: String(ex.solution || ''),
      })) : [],
      summary: String(raw.summary || ''),
    };
  }
  // Retrocompatibilidad: string plano → objeto
  const text = typeof raw === 'string' && raw.trim()
    ? raw
    : 'Esta lección cubre "' + title + '" dentro de ' + subjectName + '.';
  return {
    intro: text,
    key_points: [],
    examples: [],
    summary: 'Estudia bien este tema para avanzar en ' + subjectName + '.',
  };
}

// ─── Fallback local sin LLM ───────────────────────────────────────────────────
function localFallback(title, subjectName, count) {
  const items = [
    { type: 'multiple_choice', question: '¿Qué describe "' + title + '"?', options: ['El concepto central', 'Algo no relacionado', 'Una definición incorrecta', 'Ninguna'], correct_answer: 'El concepto central', explanation: title + ' es el concepto principal de esta lección.' },
    { type: 'true_false', question: '"' + title + '" pertenece al programa de ' + subjectName + '.', options: ['Verdadero', 'Falso'], correct_answer: 'Verdadero', explanation: 'Sí, es parte del programa.' },
    { type: 'fill_blank', question: 'El tema de esta lección es ___.', options: [], correct_answer: title, explanation: 'El título indica el tema.' },
    { type: 'multiple_choice', question: '¿A qué materia pertenece "' + title + '"?', options: [subjectName, 'Historia', 'Geografía', 'Arte'], correct_answer: subjectName, explanation: 'Pertenece a ' + subjectName + '.' },
    { type: 'true_false', question: 'Estudiar "' + title + '" es importante para ' + subjectName + '.', options: ['Verdadero', 'Falso'], correct_answer: 'Verdadero', explanation: 'Es parte fundamental.' },
  ];
  return items.slice(0, count);
}

// ─── Agrupación pedagógica ────────────────────────────────────────────────────
const TOPIC_GROUPS = [
  { pattern: /natural|entero|racional|irracional|real|clasificaci/i, title: 'Números reales y su clasificación' },
  { pattern: /suma|resta|multiplicaci|divisi|operaci|aritmética/i, title: 'Operaciones fundamentales' },
  { pattern: /media|mediana|moda|tendencia central|promedio/i, title: 'Medidas de tendencia central' },
  { pattern: /fraccion|fracción|decimal|porcentaje|proporci/i, title: 'Fracciones, decimales y porcentajes' },
  { pattern: /potencia|exponente|raíz|radical|logaritmo/i, title: 'Potencias, radicales y logaritmos' },
  { pattern: /ecuaci|inecuaci|sistema/i, title: 'Ecuaciones e inecuaciones' },
  { pattern: /función|funcion|dominio|rango/i, title: 'Funciones y sus representaciones' },
  { pattern: /polinomio|monomio|binomio|álgebra/i, title: 'Expresiones algebraicas y polinomios' },
  { pattern: /trigonom|seno|coseno|tangente/i, title: 'Trigonometría básica' },
  { pattern: /geom|área|perímet|volumen|figura/i, title: 'Geometría y medición' },
  { pattern: /probabilidad|estadística|frecuencia/i, title: 'Probabilidad y estadística' },
];
const MICRO = [/^definici/i, /^concepto de/i, /^introducción a/i, /^qué es/i, /^generalidades/i];

function groupLessons(rawLessons, moduleName) {
  const minis = rawLessons.filter(l => l.is_mini_eval);
  const normals = rawLessons.filter(l => !l.is_mini_eval);
  const grouped = [];
  const used = new Set();

  for (const g of TOPIC_GROUPS) {
    const matches = normals.filter((l, i) => !used.has(i) && g.pattern.test(l.topic));
    if (matches.length >= 2) {
      matches.map(m => normals.indexOf(m)).forEach(i => used.add(i));
      grouped.push({ topic: g.title, order: grouped.length + 1, is_mini_eval: false });
    }
  }

  const remaining = normals.filter((_, i) => !used.has(i));
  let i = 0;
  while (i < remaining.length) {
    if (grouped.length >= 3) break;
    const cur = remaining[i];
    const next = remaining[i + 1];
    if (MICRO.some(rx => rx.test(cur.topic)) && next) {
      grouped.push({ topic: next.topic, order: grouped.length + 1, is_mini_eval: false });
      i += 2;
    } else {
      grouped.push({ topic: cur.topic, order: grouped.length + 1, is_mini_eval: false });
      i++;
    }
  }

  const final = grouped.slice(0, 3).map((l, idx) => ({ ...l, order: idx + 1 }));
  if (minis.length > 0) {
    final.push({ topic: 'Mini evaluación: ' + moduleName, order: final.length + 1, is_mini_eval: true });
  }
  return final;
}

function buildStructure(syllabus) {
  const units = (syllabus.units || []).slice(0, MAX_UNITS);
  let moduleCount = 0, lessonCount = 0;
  const moduleSlot = Math.min(units.reduce((s, u) => s + (u.modules || []).length, 0), MAX_MODULES);

  return units.map((unit, ui) => ({
    title: unit.title,
    order: ui + 1,
    modules: (unit.modules || []).filter(() => moduleCount < moduleSlot).map((mod, mi) => {
      if (moduleCount >= moduleSlot) return null;
      moduleCount++;
      const lessons = groupLessons(mod.lessons || [], mod.title).slice(0, Math.max(MAX_TOTAL_LESSONS - lessonCount, 1));
      lessonCount += lessons.length;
      return { title: mod.title, order: mi + 1, lessons };
    }).filter(Boolean),
  }));
}

// ─── Generar una lección ──────────────────────────────────────────────────────
async function generateLesson(base44, { module_id, subject_id, subject_name, topic, is_mini_eval, order }, log) {
  await log('[' + ts() + '] 📝 ' + topic);

  // Skip si ya existe completa
  const existing = (await base44.asServiceRole.entities.CourseLesson.filter({ module_id, subject_id })).filter(l => l.order === order);
  if (existing[0]?.generation_completed) {
    const acts = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id: existing[0].id });
    if (acts.length >= 4) {
      await log('[' + ts() + '] ⏭️ SKIP: ya existe');
      return acts.length;
    }
    // Limpiar incompleta
    for (const a of acts) await base44.asServiceRole.entities.CourseActivity.delete(a.id);
    await base44.asServiceRole.entities.CourseLesson.delete(existing[0].id);
  }

  let title = topic;
  let explanation = normalizeExplanation(null, topic, subject_name);
  let activities = [];

  try {
    const raw = await invokeLLM(base44, buildPrompt(topic, subject_name), topic);
    if (raw?.title) title = raw.title;
    if (raw?.explanation) explanation = normalizeExplanation(raw.explanation, title, subject_name);
    if (Array.isArray(raw?.activities)) {
      activities = raw.activities.filter(isValidActivity).map(a => ({
        type: a.type,
        question: String(a.question).trim(),
        options: Array.isArray(a.options) ? a.options.map(String) : [],
        correct_answer: String(a.correct_answer).trim(),
        explanation: typeof a.explanation === 'string' ? a.explanation.trim() : '',
      }));
    }
  } catch (err) {
    await log('[' + ts() + '] ⚠️ LLM falló: ' + err.message);
  }

  if (activities.length < 4) {
    const needed = 4 - activities.length;
    activities = [...activities, ...localFallback(title, subject_name, needed)];
    await log('[' + ts() + '] 🔧 ' + needed + ' fallback añadidas');
  }

  const lesson = await base44.asServiceRole.entities.CourseLesson.create({
    module_id, subject_id, title, explanation, order, is_mini_eval: is_mini_eval || false, generation_completed: false,
  });

  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    await base44.asServiceRole.entities.CourseActivity.create({
      lesson_id: lesson.id, type: a.type, question: a.question,
      options: a.options, correct_answer: a.correct_answer, explanation: a.explanation, order: i + 1,
    });
  }

  await base44.asServiceRole.entities.CourseLesson.update(lesson.id, { generation_completed: true });
  await log('[' + ts() + '] ✅ "' + title + '" — ' + activities.length + ' actividades');
  return activities.length;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { subject_id, overwrite = false, preview_only = false, force_unlock = false, lesson_selection = null } = body;
    if (!subject_id) return Response.json({ error: 'subject_id requerido' }, { status: 400 });

    // Force unlock
    if (force_unlock) {
      const jobs = await base44.asServiceRole.entities.CurriculumGenerationJob.filter({ subject_id });
      let n = 0;
      for (const j of jobs) {
        if (['processing', 'pending'].includes(j.status)) {
          await base44.asServiceRole.entities.CurriculumGenerationJob.update(j.id, { status: 'failed', error_message: 'Desbloqueado por ' + user.email });
          n++;
        }
      }
      return Response.json({ success: true, unlocked: n });
    }

    const subject = (await base44.asServiceRole.entities.Subject.filter({ id: subject_id }))[0];
    if (!subject) return Response.json({ error: 'Materia no encontrada' }, { status: 404 });

    const syllabus = (await base44.asServiceRole.entities.SubjectSyllabus.filter({ subject_id, is_active: true }))[0];
    if (!syllabus?.units?.length) return Response.json({ error: 'Sin temario activo.', no_syllabus: true }, { status: 422 });

    const structure = buildStructure(syllabus);

    // Filtrar por selección si viene lesson_selection
    let filteredStructure = structure;
    if (lesson_selection && Array.isArray(lesson_selection) && lesson_selection.length > 0) {
      const selSet = new Set(lesson_selection.map(s => `${s.unit_index}-${s.module_index}-${s.lesson_index}`));
      filteredStructure = structure.map((u, ui) => ({
        ...u,
        modules: u.modules.map((m, mi) => ({
          ...m,
          lessons: m.lessons.filter((_, li) => selSet.has(`${ui}-${mi}-${li}`)),
        })).filter(m => m.lessons.length > 0),
      })).filter(u => u.modules.length > 0);
    }

    let totalLessons = 0, totalModules = 0;
    for (const u of filteredStructure) for (const m of u.modules) { totalModules++; totalLessons += m.lessons.length; }

    // Preview — siempre devuelve estructura COMPLETA (sin filtrar) para que el modal muestre todo
    if (preview_only) {
      let fullTotal = 0, fullModules = 0;
      for (const u of structure) for (const m of u.modules) { fullModules++; fullTotal += m.lessons.length; }
      return Response.json({
        preview: true, subject_name: subject.name, units: structure.length, modules: fullModules,
        total_lessons: fullTotal, estimated_minutes: Math.ceil(fullTotal * 20 / 60),
        estimated_tokens: fullTotal * 800,
        structure_summary: structure.map(u => ({
          title: u.title,
          modules: u.modules.map(m => ({
            title: m.title,
            lessons_count: m.lessons.length,
            lessons: m.lessons.map(l => ({ topic: l.topic, is_mini_eval: l.is_mini_eval || false })),
          })),
        })),
      });
    }

    // Verificar lock
    const activeJob = (await base44.asServiceRole.entities.CurriculumGenerationJob.filter({ subject_id })).find(j => j.status === 'processing');
    if (activeJob) return Response.json({ error: 'Ya hay una generación en curso.', locked: true, active_job_id: activeJob.id }, { status: 409 });

    if (!overwrite) {
      const existing = await base44.asServiceRole.entities.CourseUnit.filter({ subject_id });
      if (existing.length > 0) return Response.json({ error: 'Ya tiene contenido. Usa overwrite=true.', has_content: true }, { status: 409 });
    }

    // Crear job
    const job = await base44.asServiceRole.entities.CurriculumGenerationJob.create({
      subject_id, subject_name: subject.name, batch_id: crypto.randomUUID(),
      status: 'pending', total_lessons: totalLessons, completed_lessons: 0, failed_lessons: 0,
      skipped_lessons: 0, progress_percent: 0, logs: [],
      started_at: new Date().toISOString(), last_activity_at: new Date().toISOString(),
      overwrite, started_by: user.email,
    });

    // Background
    (async () => {
      let logs = [];
      const log = async (msg) => {
        logs = [...logs, msg].slice(-100);
        try { await base44.asServiceRole.entities.CurriculumGenerationJob.update(job.id, { logs, last_activity_at: new Date().toISOString() }); } catch (_) {}
        console.log(msg);
        return logs;
      };

      let completed = 0, failed = 0, skipped = 0, activities = 0;
      const start = Date.now();

      try {
        await base44.asServiceRole.entities.CurriculumGenerationJob.update(job.id, { status: 'processing', last_activity_at: new Date().toISOString() });
        await log('[' + ts() + '] 🚀 "' + subject.name + '" — ' + totalLessons + ' lecciones');

        if (overwrite) {
          await log('[' + ts() + '] 🗑️ Limpiando...');
          const units = await base44.asServiceRole.entities.CourseUnit.filter({ subject_id });
          for (const u of units) {
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
        }

        for (const unitBp of filteredStructure) {
          const unit = await base44.asServiceRole.entities.CourseUnit.create({ subject_id, title: unitBp.title, order: unitBp.order });

          for (const modBp of unitBp.modules) {
            // Verificar cancelación externa
            const fresh = (await base44.asServiceRole.entities.CurriculumGenerationJob.filter({ id: job.id }))[0];
            if (fresh?.status === 'failed') { await log('[' + ts() + '] 🛑 Cancelado'); return; }

            const module = await base44.asServiceRole.entities.CourseModule.create({ unit_id: unit.id, subject_id, title: modBp.title, order: modBp.order });

            for (const lessonBp of modBp.lessons) {
              await base44.asServiceRole.entities.CurriculumGenerationJob.update(job.id, {
                current_lesson: lessonBp.topic,
                progress_percent: Math.round(((completed + failed + skipped) / totalLessons) * 100),
                completed_lessons: completed, failed_lessons: failed, activities_created: activities,
                last_activity_at: new Date().toISOString(),
              });

              try {
                const count = await generateLesson(base44, {
                  module_id: module.id, subject_id, subject_name: subject.name,
                  topic: lessonBp.topic, is_mini_eval: lessonBp.is_mini_eval, order: lessonBp.order,
                }, log);
                completed++;
                activities += count;
              } catch (e) {
                failed++;
                await log('[' + ts() + '] ❌ "' + lessonBp.topic + '": ' + e.message);
              }
            }
          }
        }

        const secs = Math.round((Date.now() - start) / 1000);
        await base44.asServiceRole.entities.CurriculumGenerationJob.update(job.id, {
          status: 'completed', progress_percent: 100,
          completed_lessons: completed, failed_lessons: failed, skipped_lessons: skipped,
          activities_created: activities, total_duration_seconds: secs,
          finished_at: new Date().toISOString(), current_lesson: '',
        });
        await log('[' + ts() + '] 🎉 Completado — ' + completed + ' lecciones, ' + activities + ' actividades, ' + secs + 's');

      } catch (err) {
        console.error('[generateSubjectCurriculum]', err.message);
        await base44.asServiceRole.entities.CurriculumGenerationJob.update(job.id, { status: 'failed', error_message: err.message });
      }
    })();

    return Response.json({ success: true, job_id: job.id, total_lessons: totalLessons });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});