import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function ModeratorActions({ targetEmail, targetName, threadId, commentId, currentUser }) {
  const [showReport, setShowReport] = useState(false);
  const [showPenalty, setShowPenalty] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("warning");
  const [loading, setLoading] = useState(false);

  const isMod = currentUser?.role === 'docente' || currentUser?.role === 'admin';
  if (!isMod || targetEmail === currentUser?.email) return null;

  async function handleReport() {
    if (!reason.trim()) return;
    setLoading(true);
    await base44.entities.UserReport.create({
      reported_user_email: targetEmail,
      reported_user_name: targetName || targetEmail,
      reported_by: currentUser.email,
      reported_by_role: currentUser.role,
      reason,
      description,
      thread_id: threadId || null,
      comment_id: commentId || null,
      status: 'pending',
    });
    toast.success("Reporte enviado correctamente");
    setReason(""); setDescription("");
    setShowReport(false);
    setLoading(false);
  }

  async function handlePenalty() {
    if (!reason.trim()) return;
    setLoading(true);
    const res = await base44.functions.invoke('applyManualPenalty', {
      target_email: targetEmail,
      target_name: targetName,
      reason,
      severity,
    });
    if (res.data?.success) {
      toast.success(`Penalización aplicada (${severity}). Ban hasta: ${new Date(res.data.banned_until).toLocaleDateString('es-MX')}`);
    }
    setReason(""); setSeverity("warning");
    setShowPenalty(false);
    setLoading(false);
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setShowReport(true)} className="text-amber-600 hover:bg-amber-50 text-xs h-7 px-2">
        <Flag className="w-3.5 h-3.5 mr-1" /> Reportar
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setShowPenalty(true)} className="text-red-600 hover:bg-red-50 text-xs h-7 px-2">
        <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Penalizar
      </Button>

      {/* Dialog: Reportar */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar a {targetName || targetEmail}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Razón *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar razón..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Contenido inapropiado">Contenido inapropiado</SelectItem>
                  <SelectItem value="Trampa o deshonestidad académica">Trampa / deshonestidad académica</SelectItem>
                  <SelectItem value="Acoso o lenguaje ofensivo">Acoso o lenguaje ofensivo</SelectItem>
                  <SelectItem value="Spam">Spam</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descripción adicional</Label>
              <Textarea
                className="mt-1"
                placeholder="Detalla la situación..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReport(false)}>Cancelar</Button>
            <Button onClick={handleReport} disabled={!reason || loading}>
              {loading ? "Enviando..." : "Enviar reporte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Penalizar */}
      <Dialog open={showPenalty} onOpenChange={setShowPenalty}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Penalizar a {targetName || targetEmail}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Severidad</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warning">⚠️ Advertencia (ban 1 día)</SelectItem>
                  <SelectItem value="medium">🔶 Media (ban 3 días)</SelectItem>
                  <SelectItem value="severe">🔴 Severa (ban 7 días)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Razón de la penalización *</Label>
              <Textarea
                className="mt-1"
                placeholder="Explica el motivo de la penalización..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPenalty(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handlePenalty} disabled={!reason.trim() || loading}>
              {loading ? "Aplicando..." : "Aplicar penalización"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}