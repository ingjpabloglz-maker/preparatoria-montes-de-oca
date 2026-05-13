import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// DEPRECATED — El sistema de enrichments on-demand fue eliminado.
// Todo el contenido se pregena desde el panel admin via generateSubjectCurriculum.

Deno.serve(async (req) => {
  return Response.json(
    { error: 'generateActivityEnrichment está desactivado. Todo el contenido es pregenerado por admin.' },
    { status: 501 }
  );
});