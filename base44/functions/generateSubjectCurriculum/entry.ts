import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// generateSubjectCurriculum — v8
// • Clave semántica estable: normalizeKey(unit_title|module_title|lesson_title)
// • NO usa order para unicidad lógica
// • 1 llamada LLM por lección (timeout 45s, fallback inmediato)
// • Solo: multiple_choice, true_false, fill_blank

const VALID_TYPES = ['multiple_choice', 'true_false', 'fill_blank'];

function ts() { return new Date().toLocaleTimeString('es-MX', { hour12: false }); }

// ─── Clave semántica estable ──────────────────────────────────────────────────
function normalizeKey(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

function buildLessonKey(unitTitle, moduleTitle, lessonTitle) {
  return [normalizeKey(unitTitle), normalizeKey(moduleTitle), normalizeKey(lessonTitle)].join('|');
}

// ─── LLM con timeout duro ─────────────────────────────────────────────────────
async function invokeLLM(base44, prompt) {
  return Promise.race([
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
    new Promise((_, reject) => setTimeout(() => reject(new Error('LLM_TIMEOUT')), 45000))
  ]);
}

// ─── Prompt estructurado ──────────────────────────────────────────────────────
function buildPrompt(topic, subjectName) {
  return 'Eres un docente experto de preparatoria. Genera una lección completa en JSON puro.\n' +
    'Tema: "' + topic + '"\nMateria: "' + subjectName + '"\n\n' +
    'RESPONDE SOLO EL JSON SIGUIENTE, sin texto extra, sin markdown, sin HTML:\n' +
    '{\n' +
    '  "title": "Título corto del tema",\n' +
    '  "explanation": {\n' +
    '    "intro": "Introducción breve y clara de 1-2 oraciones.",\n' +
    '    "key_points": [\n' +
    '      { "title": "Subtema", "content": "Explicación clara.", "example": "Ejemplo corto." }\n' +
    '    ],\n' +
    '    "examples": [\n' +
    '      { "question": "Ejercicio o situación práctica", "solution": "Resolución." }\n' +
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
    '- explanation.key_points: entre 3 y 6 elementos, cada uno con title, content y example.\n' +
    '- activities: 4-5 actividades, SOLO tipos multiple_choice/true_false/fill_blank.\n' +
    '- correct_answer debe ser exactamente igual a uno de los options.\n' +
    '- Solo JSON válido, sin HTML ni markdown.';
}

// ─── Validación mínima de actividad ──────────────────────────────────────────
function isValidActivity(act) {
  if (!act || !act.question || !act.type || !act.correct_answer) return false;
  if (!VALID_TYPES.includes(act.type)) return false;
  if (act.type === 'multiple_choice' && (!Array.isArray(act.options) || act.options.length < 2)) return false;
  return true;
}

// ─── Normalizar explanation ───────────────────────────────────────────────────
function normalizeExplanation(raw, title, subjectName) {
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
  const text = typeof raw === 'string' && raw.trim()
    ? raw
    : 'Esta lección cubre "' + title + '" dentro de ' + subjectName + '.';
  return { intro: text, key_points: [], examples: [], summary: 'Estudia bien este tema para avanzar en ' + subjectName + '.' };
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

// ─── Estructura 1:1 del sílabo ────────────────────────────────────────────────
function buildStructure(syllabus) {
  return (syllabus.units || []).map((unit, ui) => ({
    title: unit.title,
    order: ui + 1,
    modules: (unit.modules || []).map((mod, mi) => ({
      title: mod.title,
      order: mi + 1,
      lessons: (mod.lessons || []).map((l, li) => ({
        topic: l.topic,
        order: li + 1,
        is_mini_eval: l.is_mini_eval || false,
      })),
    })),
  }));
}

// ─── Upsert por título normalizado ────────────────────────────────────────────
async function upsertUnit(base44, subject_id, order, title) {
  const existing = await base44.asServiceRole.entities.CourseUnit.filter({ subject_id });
  const nk = normalizeKey(title);
  const match = existing.find(u => normalizeKey(u.title) === nk);
  if (match) return match;
  return base44.asServiceRole.entities.CourseUnit.create({ subject_id, title, order });
}

async function upsertModule(base44, unit_id, subject_id, order, title) {
  const existing = await base44.asServiceRole.entities.CourseModule.filter({ unit_id });
  const nk = normalizeKey(title);
  const match = existing.find(m => normalizeKey(m.title) === nk);
  if (match) return match;
  return base44.asServiceRole.entities.CourseModule.create({ unit_id, subject_id, title, order });
}

// ─── Generar lección — unicidad por título normalizado ────────────────────────
async function generateLesson(base44, { module_id, subject_id, subject_name, topic, is_mini_eval, order }, log) {
  await log('[' + ts() + '] 📝 ' + topic);

  const nk = normalizeKey(topic);
  const allInModule = await base44.asServiceRole.entities.CourseLesson.filter({ module_id, subject_id });
  const existing = allInModule.filter(l => normalizeKey(l.title) === nk);

  // Si ya existe completa → skip
  if (existing[0]?.generation_completed) {
    const acts = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id: existing[0].id });
    if (acts.length >= 4) {
      await log('[' + ts() + '] ⏭️ SKIP: ya existe completa');
      return acts.length;
    }
    // Existe pero incompleta → limpiar y regenerar
    for (const a of acts) await base44.asServiceRole.entities.CourseActivity.delete(a.id);
    await base44.asServiceRole.entities.CourseLesson.delete(existing[0].id);
  } else if (existing[0]) {
    const acts = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id: existing[0].id });
    for (const a of acts) await base44.asServiceRole.entities.CourseActivity.delete(a.id);
    await base44.asServiceRole.entities.CourseLesson.delete(existing[0].id);
  }

  let title = topic;
  let explanation = normalizeExplanation(null, topic, subject_name);
  let activities = [];

  try {
    const raw = await invokeLLM(base44, buildPrompt(topic, subject_name));
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
    const isTimeout = err.message === 'LLM_TIMEOUT';
    await log('[' + ts() + '] ⚠️ ' + (isTimeout ? 'TIMEOUT — usando fallback' : 'LLM falló: ' + err.message));
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

// ─── Cleanup selectivo por clave semántica ────────────────────────────────────
async function cleanupSelectedContent(base44, subject_id, filteredStructure, log, selectionSummary) {
  await log('[' + ts() + '] 🗑️ Limpiando contenido seleccionado: ' + (selectionSummary || filteredStructure.map(u => u.title).join(', ')));
  let actCount = 0, lessonCount = 0, modCount = 0, unitCount = 0;

  const allUnits = await base44.asServiceRole.entities.CourseUnit.filter({ subject_id });

  for (const unitBp of filteredStructure) {
    const existingUnit = allUnits.find(u => normalizeKey(u.title) === normalizeKey(unitBp.title));
    if (!existingUnit) continue;

    const allMods = await base44.asServiceRole.entities.CourseModule.filter({ unit_id: existingUnit.id });

    for (const modBp of unitBp.modules) {
      const existingMod = allMods.find(m => normalizeKey(m.title) === normalizeKey(modBp.title));
      if (!existingMod) continue;

      const allLessons = await base44.asServiceRole.entities.CourseLesson.filter({ module_id: existingMod.id });

      for (const lessonBp of modBp.lessons) {
        const existingLesson = allLessons.find(l => normalizeKey(l.title) === normalizeKey(lessonBp.topic));
        if (!existingLesson) continue;

        const acts = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id: existingLesson.id });
        for (const a of acts) { await base44.asServiceRole.entities.CourseActivity.delete(a.id); actCount++; }
        await base44.asServiceRole.entities.CourseLesson.delete(existingLesson.id);
        lessonCount++;
      }

      const remainingLessons = await base44.asServiceRole.entities.CourseLesson.filter({ module_id: existingMod.id });
      if (remainingLessons.length === 0) {
        await base44.asServiceRole.entities.CourseModule.delete(existingMod.id);
        modCount++;
      }
    }

    const remainingMods = await base44.asServiceRole.entities.CourseModule.filter({ unit_id: existingUnit.id });
    if (remainingMods.length === 0) {
      await base44.asServiceRole.entities.CourseUnit.delete(existingUnit.id);
      unitCount++;
    }
  }

  await log('[' + ts() + '] ✅ Limpieza selectiva: ' + actCount + ' act, ' + lessonCount + ' lec, ' + modCount + ' mod, ' + unitCount + ' uni eliminados');
}

// ─── Validación post-generación: duplicados por título normalizado ─────────────
async function validateAndCleanDuplicates(base44, subject_id, log) {
  await log('[' + ts() + '] 🔍 Validando estructura post-generación...');
  let removed = 0;

  // CourseUnit: duplicados por subject_id + normalized title
  const units = await base44.asServiceRole.entities.CourseUnit.filter({ subject_id });
  const unitsByKey = {};
  for (const u of units) {
    const key = normalizeKey(u.title);
    if (!unitsByKey[key]) unitsByKey[key] = [];
    unitsByKey[key].push(u);
  }
  for (const key of Object.keys(unitsByKey)) {
    const dups = unitsByKey[key].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
    for (let i = 1; i < dups.length; i++) {
      await base44.asServiceRole.entities.CourseUnit.delete(dups[i].id);
      removed++;
      await log('[' + ts() + '] ⚠️ Unidad duplicada eliminada: "' + key + '"');
    }
  }

  // CourseModule: duplicados por unit_id + normalized title
  const allModules = await base44.asServiceRole.entities.CourseModule.filter({ subject_id });
  const modsByKey = {};
  for (const m of allModules) {
    const key = m.unit_id + '|' + normalizeKey(m.title);
    if (!modsByKey[key]) modsByKey[key] = [];
    modsByKey[key].push(m);
  }
  for (const key of Object.keys(modsByKey)) {
    const dups = modsByKey[key].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
    for (let i = 1; i < dups.length; i++) {
      await base44.asServiceRole.entities.CourseModule.delete(dups[i].id);
      removed++;
      await log('[' + ts() + '] ⚠️ Módulo duplicado eliminado: "' + key + '"');
    }
  }

  // CourseLesson: duplicados por module_id + normalized title
  const allLessons = await base44.asServiceRole.entities.CourseLesson.filter({ subject_id });
  const lessonsByKey = {};
  for (const l of allLessons) {
    const key = l.module_id + '|' + normalizeKey(l.title);
    if (!lessonsByKey[key]) lessonsByKey[key] = [];
    lessonsByKey[key].push(l);
  }
  for (const key of Object.keys(lessonsByKey)) {
    const dups = lessonsByKey[key].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
    for (let i = 1; i < dups.length; i++) {
      const acts = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id: dups[i].id });
      for (const a of acts) await base44.asServiceRole.entities.CourseActivity.delete(a.id);
      await base44.asServiceRole.entities.CourseLesson.delete(dups[i].id);
      removed++;
      await log('[' + ts() + '] ⚠️ Lección duplicada eliminada: "' + key + '"');
    }
  }

  // CourseActivity: duplicados por lesson_id + question normalizada
  const freshLessons = await base44.asServiceRole.entities.CourseLesson.filter({ subject_id });
  for (const lesson of freshLessons) {
    const acts = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id: lesson.id });
    const actsByKey = {};
    for (const a of acts) {
      const key = normalizeKey(a.question);
      if (!actsByKey[key]) actsByKey[key] = [];
      actsByKey[key].push(a);
    }
    for (const key of Object.keys(actsByKey)) {
      const dups = actsByKey[key].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
      for (let i = 1; i < dups.length; i++) {
        await base44.asServiceRole.entities.CourseActivity.delete(dups[i].id);
        removed++;
      }
    }
  }

  if (removed > 0) {
    await log('[' + ts() + '] 🧹 Validación: ' + removed + ' duplicados eliminados');
  } else {
    await log('[' + ts() + '] ✅ Validación: estructura limpia, sin duplicados');
  }
}

// ─── Detectar faltantes por clave semántica ───────────────────────────────────
async function detectMissingLessons(base44, subject_id, structure) {
  const existingUnits = await base44.asServiceRole.entities.CourseUnit.filter({ subject_id });
  const allModules = await base44.asServiceRole.entities.CourseModule.filter({ subject_id });
  const allLessons = await base44.asServiceRole.entities.CourseLesson.filter({ subject_id });

  // Indexar unidades por título normalizado
  const unitByKey = {};
  for (const u of existingUnits) unitByKey[normalizeKey(u.title)] = u;

  // Indexar módulos por unit_id + título normalizado
  const modByKey = {};
  for (const m of allModules) {
    const key = m.unit_id + '|' + normalizeKey(m.title);
    if (!modByKey[key] || (m.created_date || '') > (modByKey[key].created_date || '')) modByKey[key] = m;
  }

  // Indexar lecciones por module_id + título normalizado, manteniendo la más reciente
  const lessonByKey = {};
  for (const l of allLessons) {
    const key = l.module_id + '|' + normalizeKey(l.title);
    if (!lessonByKey[key] || (l.created_date || '') > (lessonByKey[key].created_date || '')) lessonByKey[key] = l;
  }

  const missingUnits = [], missingModules = [], missingLessons = [], completedLessons = [];
  const missingSelection = [];
  let totalSyllabus = 0;

  for (const [ui, unitBp] of structure.entries()) {
    const existingUnit = unitByKey[normalizeKey(unitBp.title)];

    if (!existingUnit) {
      missingUnits.push(unitBp);
      for (const [mi, modBp] of unitBp.modules.entries()) {
        missingModules.push({ unit_title: unitBp.title, ...modBp });
        for (const [li, lessonBp] of modBp.lessons.entries()) {
          totalSyllabus++;
          missingLessons.push({ unit_title: unitBp.title, module_title: modBp.title, ...lessonBp });
          missingSelection.push({ unit_index: ui, module_index: mi, lesson_index: li });
        }
      }
      continue;
    }

    for (const [mi, modBp] of unitBp.modules.entries()) {
      const modKey = existingUnit.id + '|' + normalizeKey(modBp.title);
      const existingMod = modByKey[modKey];

      if (!existingMod) {
        missingModules.push({ unit_title: unitBp.title, ...modBp });
        for (const [li, lessonBp] of modBp.lessons.entries()) {
          totalSyllabus++;
          missingLessons.push({ unit_title: unitBp.title, module_title: modBp.title, ...lessonBp });
          missingSelection.push({ unit_index: ui, module_index: mi, lesson_index: li });
        }
        continue;
      }

      for (const [li, lessonBp] of modBp.lessons.entries()) {
        totalSyllabus++;
        const lessonKey = existingMod.id + '|' + normalizeKey(lessonBp.topic);
        const existingLesson = lessonByKey[lessonKey];
        if (!existingLesson || !existingLesson.generation_completed) {
          missingLessons.push({ unit_title: unitBp.title, module_title: modBp.title, ...lessonBp });
          missingSelection.push({ unit_index: ui, module_index: mi, lesson_index: li });
        } else {
          completedLessons.push(existingLesson);
        }
      }
    }
  }

  const completionPercentage = totalSyllabus > 0
    ? Math.round((completedLessons.length / totalSyllabus) * 100)
    : 0;

  return { missingUnits, missingModules, missingLessons, completedLessons, completionPercentage, missingSelection, totalSyllabus };
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { subject_id, overwrite = false, preview_only = false, force_unlock = false, lesson_selection = null, detect_missing = false } = body;
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

    // ── Protección contra concurrencia ──
    const activeJob = (await base44.asServiceRole.entities.CurriculumGenerationJob.filter({ subject_id }))
      .find(j => j.status === 'processing' || j.status === 'pending');
    if (activeJob) {
      return Response.json({ error: 'Ya existe una generación en progreso para esta materia.', locked: true, active_job_id: activeJob.id }, { status: 409 });
    }

    const subject = (await base44.asServiceRole.entities.Subject.filter({ id: subject_id }))[0];
    if (!subject) return Response.json({ error: 'Materia no encontrada' }, { status: 404 });

    const syllabus = (await base44.asServiceRole.entities.SubjectSyllabus.filter({ subject_id, is_active: true }))[0];
    if (!syllabus?.units?.length) return Response.json({ error: 'Sin temario activo.', no_syllabus: true }, { status: 422 });

    const structure = buildStructure(syllabus);

    // ── Modo detect_missing ──
    if (detect_missing) {
      const result = await detectMissingLessons(base44, subject_id, structure);
      return Response.json({
        detect_missing: true,
        subject_name: subject.name,
        syllabus_units: structure.length,
        syllabus_modules: structure.reduce((s, u) => s + u.modules.length, 0),
        syllabus_lessons: result.totalSyllabus,
        completed_count: result.completedLessons.length,
        missing_count: result.missingLessons.length,
        missing_modules_count: result.missingModules.length,
        completion_percentage: result.completionPercentage,
        missing_selection: result.missingSelection,
      });
    }

    // ── Filtrar por lesson_selection (índices en estructura) ──
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

    // Preview — devuelve estructura COMPLETA
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

    // ── Protección: overwrite sin selección explícita es peligroso ──
    if (overwrite && (!lesson_selection || !Array.isArray(lesson_selection) || lesson_selection.length === 0)) {
      throw new Error('lesson_selection is required. Refusing full-subject overwrite.');
    }

    // Solo bloquear si hay contenido existente Y no hay selección explícita
    if (!overwrite && (!lesson_selection || lesson_selection.length === 0)) {
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

        // Cleanup selectivo por clave semántica
        if (overwrite) {
          const selectionSummary = filteredStructure.map(u => u.title).join(', ');
          await cleanupSelectedContent(base44, subject_id, filteredStructure, log, selectionSummary);
        }

        for (const unitBp of filteredStructure) {
          const freshCheck = (await base44.asServiceRole.entities.CurriculumGenerationJob.filter({ id: job.id }))[0];
          if (freshCheck?.status === 'failed') { await log('[' + ts() + '] 🛑 Cancelado'); return; }

          const unit = await upsertUnit(base44, subject_id, unitBp.order, unitBp.title);

          for (const modBp of unitBp.modules) {
            const fresh = (await base44.asServiceRole.entities.CurriculumGenerationJob.filter({ id: job.id }))[0];
            if (fresh?.status === 'failed') { await log('[' + ts() + '] 🛑 Cancelado'); return; }

            const module = await upsertModule(base44, unit.id, subject_id, modBp.order, modBp.title);

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

        await validateAndCleanDuplicates(base44, subject_id, log);

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