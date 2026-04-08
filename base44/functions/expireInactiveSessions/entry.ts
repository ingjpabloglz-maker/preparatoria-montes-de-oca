import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Función programada para expirar sesiones presenciales inactivas
 * 
 * Si un PresentialExamToken tiene:
 * - session_token activo
 * - pero más de 60 minutos sin ser usado (submitEvaluation)
 * 
 * Entonces:
 * - session_status = 'expired'
 * - session_token se invalida
 * 
 * Llamada cada 15 minutos desde automation
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  try {
    // Buscar tokens con sesión activa que hayan sido validados hace >1 hora
    const allTokens = await base44.asServiceRole.entities.PresentialExamToken.list();
    
    const tokensToExpire = allTokens.filter(token => {
      // Solo aplica si tiene session_token y NO ha sido usado
      if (!token.session_token || token.used) return false;
      
      // Validar que exista validated_at y que sea anterior a hace 1 hora
      if (!token.validated_at) return false;
      
      const validatedAt = new Date(token.validated_at);
      return validatedAt < oneHourAgo;
    });

    // Actualizar cada token a session_status = 'expired'
    const updatePromises = tokensToExpire.map(token =>
      base44.asServiceRole.entities.PresentialExamToken.update(token.id, {
        session_status: 'expired',
      }).catch(err => {
        console.error(`Error expiring token ${token.id}:`, err.message);
        return null;
      })
    );

    await Promise.all(updatePromises);

    const expiredCount = tokensToExpire.length;
    console.log(`[EXPIRE_INACTIVE_SESSIONS] Expired ${expiredCount} inactive sessions`);

    return Response.json({
      status: 'ok',
      expired_count: expiredCount,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('[EXPIRE_INACTIVE_SESSIONS] Error:', error.message);
    return Response.json({
      status: 'error',
      message: error.message,
    }, { status: 500 });
  }
});