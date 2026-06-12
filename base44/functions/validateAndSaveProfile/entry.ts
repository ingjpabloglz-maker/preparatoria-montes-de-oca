import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Utilidades de normalización ──────────────────────────────────────────────

const ACCENTS = { Á:'A',É:'E',Í:'I',Ó:'O',Ú:'U',Ü:'U',Ñ:'X',
                  á:'A',é:'E',í:'I',ó:'O',ú:'U',ü:'U',ñ:'X' };

function normalize(str) {
  if (!str) return '';
  return str
    .split('')
    .map(c => ACCENTS[c] || c)
    .join('')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

// Palabras que se omiten del nombre si hay más de una palabra (norma CURP)
const SKIP_WORDS = new Set([
  'JOSE','MARIA','MA','J','DE','DEL','LAS','LOS','LA','Y','MC','MAC',
  'VAN','VON','DER','DI','DU','DA'
]);

function firstUsableName(nombreCompleto) {
  const parts = normalize(nombreCompleto).split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const filtered = parts.filter(p => !SKIP_WORDS.has(p));
  return filtered[0] || parts[0];
}

// Primera vocal INTERNA (a partir del índice 1)
function firstInternalVowel(word) {
  const VOWELS = new Set(['A','E','I','O','U']);
  for (let i = 1; i < word.length; i++) {
    if (VOWELS.has(word[i])) return word[i];
  }
  return 'X'; // fallback según norma
}

// ── Generador del prefijo de 4 letras ────────────────────────────────────────
/**
 * Genera el prefijo de 4 caracteres de la CURP según la norma mexicana:
 *   [1ª letra AP] [1ª vocal interna AP] [1ª letra AM] [1ª letra nombre]
 */
function generateCURPPrefix(nombre, apellidoPaterno, apellidoMaterno) {
  const ap = normalize(apellidoPaterno);
  const am = normalize(apellidoMaterno);
  const nom = firstUsableName(nombre);

  const c1 = ap[0] || 'X';
  const c2 = firstInternalVowel(ap);
  const c3 = (am[0]) || 'X';
  const c4 = nom[0] || 'X';

  return c1 + c2 + c3 + c4;
}

// ── Validador CURP completo ───────────────────────────────────────────────────
const CURP_REGEX = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$/;

function validateCURP(curp, nombre, apellidoPaterno, apellidoMaterno) {
  if (!curp || curp.length !== 18) return { ok: false, reason: 'formato' };
  if (!CURP_REGEX.test(curp)) return { ok: false, reason: 'formato' };

  const expectedPrefix = generateCURPPrefix(nombre, apellidoPaterno, apellidoMaterno);
  const curpPrefix = curp.substring(0, 4).toUpperCase();

  if (curpPrefix !== expectedPrefix) {
    return {
      ok: false,
      reason: 'nombre',
      detail: `Se esperaba prefijo ${expectedPrefix}, se recibió ${curpPrefix}`,
    };
  }

  return { ok: true };
}

// ── Handler principal ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const {
    nombres,
    apellido_paterno,
    apellido_materno,
    telefono_personal,
    telefono_tutor,
    correo_contacto,
    curp,
    // Para uso admin: target_user_id
    target_user_id,
  } = body;

  // Si viene target_user_id, sólo admins pueden usarlo
  if (target_user_id && user.role !== 'admin') {
    return Response.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  // Campos obligatorios
  if (!nombres || !apellido_paterno || !telefono_personal || !correo_contacto || !curp) {
    return Response.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
  }

  // Validar CURP contra el nombre
  const validation = validateCURP(
    curp,
    nombres,
    apellido_paterno,
    apellido_materno || ''
  );

  if (!validation.ok) {
    if (validation.reason === 'nombre') {
      return Response.json(
        { error: 'La CURP no coincide con el nombre del alumno' },
        { status: 422 }
      );
    }
    return Response.json(
      { error: 'Formato de CURP inválido' },
      { status: 422 }
    );
  }

  // Construir payload de actualización
  const updatePayload = {
    nombres,
    apellido_paterno,
    apellido_materno: apellido_materno || '',
    telefono_personal,
    telefono_tutor: telefono_tutor || '',
    correo_contacto,
    curp: curp.toUpperCase(),
    curp_validated: true,
    curp_validated_at: new Date().toISOString(),
  };

  // Resolver el email del alumno objetivo
  let targetEmail = user.email;
  let targetProfileId = null;
  if (target_user_id) {
    // target_user_id es el ID del registro UserProfile (student.id desde el frontend)
    const profile = await base44.asServiceRole.entities.UserProfile.get(target_user_id).catch(() => null);
    if (!profile) {
      return Response.json({ error: 'No se encontró el perfil del alumno' }, { status: 404 });
    }
    targetEmail = profile.user_email;
    targetProfileId = profile.id;
  } else {
    await base44.auth.updateMe(updatePayload);
  }

  // Solo procesar UserProfile para alumnos (role 'user')
  const effectiveRole = target_user_id ? 'user' : user.role;

  if (effectiveRole !== 'user') {
    return Response.json({ success: true, curp_validated: true });
  }

  try {
    const emailToSync = targetEmail;
    const parts = [updatePayload.apellido_paterno, updatePayload.apellido_materno, updatePayload.nombres].filter(Boolean);
    const full_name = parts.length > 0 ? parts.join(' ') : emailToSync;
    const profile_completed = !!(updatePayload.nombres && updatePayload.apellido_paterno && updatePayload.curp && updatePayload.telefono_personal && updatePayload.correo_contacto);

    // Preservar el rol original del perfil; nunca sobreescribir con el rol del admin que edita
    let preservedRole = 'user';
    if (targetProfileId) {
      const existingProfile = await base44.asServiceRole.entities.UserProfile.get(targetProfileId).catch(() => null);
      preservedRole = existingProfile?.role || 'user';
    } else {
      preservedRole = user.role || 'user';
    }

    const profilePayload = {
      user_email: emailToSync,
      nombres: updatePayload.nombres || '',
      apellido_paterno: updatePayload.apellido_paterno || '',
      apellido_materno: updatePayload.apellido_materno || '',
      full_name,
      curp: updatePayload.curp || '',
      curp_validated: true,
      curp_validated_at: updatePayload.curp_validated_at,
      telefono_personal: updatePayload.telefono_personal || '',
      telefono_tutor: updatePayload.telefono_tutor || '',
      correo_contacto: updatePayload.correo_contacto || '',
      role: preservedRole,
      status: 'active',
      profile_completed,
      last_synced_at: new Date().toISOString(),
    };

    const profileIdToUpdate = targetProfileId || null;
    if (profileIdToUpdate) {
      await base44.asServiceRole.entities.UserProfile.update(profileIdToUpdate, profilePayload);
    } else {
      const existing = await base44.asServiceRole.entities.UserProfile.filter({ user_email: emailToSync });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.UserProfile.update(existing[0].id, profilePayload);
      } else {
        await base44.asServiceRole.entities.UserProfile.create(profilePayload);
      }
    }
  } catch (_) { /* sync no-op: no bloquea el flujo principal */ }

  return Response.json({ success: true, curp_validated: true });
});