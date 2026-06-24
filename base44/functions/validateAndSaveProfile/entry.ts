import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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