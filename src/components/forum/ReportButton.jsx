import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Flag } from "lucide-react";
import { toast } from "sonner";

export default function ReportButton({ postId, threadId, reportedBy }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReport = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    await base44.entities.ForumReport.create({
      post_id: postId || undefined,
      thread_id: threadId || undefined,
      reported_by: reportedBy,
      reason: reason.trim(),
      status: "pending",
    });
    setLoading(false);
    setOpen(false);
    setReason("");
    toast.success("Reporte enviado. Un moderador lo revisará pronto.");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
      >
        <Flag className="w-3 h-3" />
        Reportar
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reportar contenido</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            ¿Por qué consideras que este contenido viola las normas del foro?
          </p>
          <Textarea
            placeholder="Describe brevemente el problema (ej: está compartiendo respuestas de examen)..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleReport}
              disabled={!reason.trim() || loading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? "Enviando..." : "Enviar reporte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}