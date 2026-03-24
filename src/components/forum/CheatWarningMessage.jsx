import { AlertTriangle } from "lucide-react";

export default function CheatWarningMessage({ reason }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-800">
          ⚠️ Este foro es para aprender, no para compartir respuestas directas
        </p>
        <p className="text-sm text-amber-700 mt-1">
          {reason || "Tu mensaje parece contener o solicitar respuestas de ejercicios o exámenes."}
        </p>
        <p className="text-sm text-amber-600 mt-2">
          💡 Intenta reformular tu pregunta para pedir una <strong>explicación del concepto</strong> o <strong>pistas para resolver el problema</strong>, en lugar de la solución directa.
        </p>
      </div>
    </div>
  );
}