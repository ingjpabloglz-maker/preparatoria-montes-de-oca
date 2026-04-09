import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const SEVERITY_OPTIONS = [
  { value: "warning", label: "⚠️ Advertencia", desc: "Sin ban — descuento leve de XP", color: "border-yellow-400 bg-yellow-50 text-yellow-800" },
  { value: "medium",  label: "🔴 Media",        desc: "Ban 3 días — descuento de XP y racha", color: "border-orange-400 bg-orange-50 text-orange-800" },
  { value: "severe",  label: "🚫 Grave",         desc: "Ban 7 días — penalización fuerte",   color: "border-red-500 bg-red-50 text-red-800" },
];

export default function PenalizeUserModal({ open, onClose, targetUserEmail, targetUserName }) {
  const [severity, setSeverity] = useState("warning");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) { toast.error("Escribe una razón para la penalización"); return; }
    setLoading(true);
    const res = await base44.functions.invoke("applyManualPenalty", {
      user_email: targetUserEmail,
      reason: reason.trim(),
      severity,
    });
    setLoading(false);
    if (res.data?.success) {
      toast.success(`Penalización aplicada a ${targetUserName || targetUserEmail}`);
      setReason("");
      setSeverity("warning");
      onClose();
    } else {
      toast.error(res.data?.error || "Error al aplicar penalización");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <ShieldAlert className="w-5 h-5" />
            Penalizar Usuario
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-gray-50 border text-sm">
            <span className="text-gray-500">Usuario: </span>
            <span className="font-semibold text-gray-800">{targetUserName || targetUserEmail}</span>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Severidad</p>
            <div className="space-y-2">
              {SEVERITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSeverity(opt.value)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${severity === opt.value ? opt.color + " border-opacity-100" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                >
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs opacity-75 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Razón (obligatoria)</p>
            <Textarea
              placeholder="Describe la razón de la penalización..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            Esta acción queda registrada en auditoría con tu nombre y rol.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
            {loading ? "Aplicando..." : "Aplicar penalización"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}