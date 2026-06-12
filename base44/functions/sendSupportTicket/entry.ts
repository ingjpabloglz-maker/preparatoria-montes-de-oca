import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const OWNER_EMAIL = 'ing.jpablo.glz@gmail.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ticket_type, subject, description, image_urls = [] } = await req.json();

    if (!ticket_type || !subject || !description) {
      return Response.json({ error: 'Campos requeridos faltantes.' }, { status: 400 });
    }

    const typeLabels = {
      administrativo: 'Administrativo',
      curso: 'Contenido del Curso',
      pagos: 'Pagos y Colegiaturas',
      tecnico: 'Problema Técnico',
      acceso: 'Acceso a la Plataforma',
      otro: 'Otro',
    };

    const typeLabel = typeLabels[ticket_type] || ticket_type;
    const now = new Date().toLocaleString('es-MX', { timeZone: 'America/Matamoros' });

    const imagesHtml = image_urls.length > 0
      ? `<p><strong>Imágenes adjuntas:</strong></p>${image_urls.map((url, i) => `<p><a href="${url}" target="_blank">Ver imagen ${i + 1}</a></p>`).join('')}`
      : '<p><em>Sin imágenes adjuntas.</em></p>';

    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #1e40af; padding: 20px 24px;">
          <h2 style="color: white; margin: 0; font-size: 18px;">🎫 Nuevo Ticket de Soporte</h2>
          <p style="color: #bfdbfe; margin: 4px 0 0; font-size: 13px;">${now}</p>
        </div>
        <div style="padding: 24px; background: #f9fafb;">
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
            <tr style="background: #eff6ff;">
              <td style="padding: 10px 16px; font-weight: bold; color: #1e40af; width: 40%;">Tipo de Ticket</td>
              <td style="padding: 10px 16px;">${typeLabel}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; font-weight: bold; color: #374151;">Asunto</td>
              <td style="padding: 10px 16px;">${subject}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px 16px; font-weight: bold; color: #374151; vertical-align: top;">Descripción</td>
              <td style="padding: 10px 16px; white-space: pre-wrap;">${description}</td>
            </tr>
          </table>

          <h3 style="margin: 20px 0 8px; color: #374151; font-size: 15px;">👤 Datos del Usuario</h3>
          <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
            <tr style="background: #eff6ff;">
              <td style="padding: 10px 16px; font-weight: bold; color: #1e40af; width: 40%;">Nombre</td>
              <td style="padding: 10px 16px;">${user.full_name || 'No especificado'}</td>
            </tr>
            <tr>
              <td style="padding: 10px 16px; font-weight: bold; color: #374151;">Correo de Contacto</td>
              <td style="padding: 10px 16px;"><a href="mailto:${user.email}">${user.email}</a></td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px 16px; font-weight: bold; color: #374151;">ID de Usuario</td>
              <td style="padding: 10px 16px; font-size: 12px; color: #6b7280;">${user.id}</td>
            </tr>
          </table>

          <div style="margin-top: 20px;">
            ${imagesHtml}
          </div>

          <div style="margin-top: 20px; padding: 12px 16px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
            <p style="margin: 0; font-size: 13px; color: #92400e;">
              <strong>Recuerda:</strong> Responde directamente al correo del alumno <strong>${user.email}</strong> en un plazo de 24 a 48 horas hábiles.
            </p>
          </div>
        </div>
      </div>
    `;

    await base44.integrations.Core.SendEmail({
      to: OWNER_EMAIL,
      subject: `[Soporte] ${typeLabel} — ${subject}`,
      body: emailBody,
      from_name: 'Sistema de Soporte Montes de Oca',
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});