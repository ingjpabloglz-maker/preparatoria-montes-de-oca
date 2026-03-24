import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";

/**
 * Protege el contenido de una sección con validación de folio de pago.
 * Muestra una pantalla de bloqueo si el usuario no tiene acceso.
 */
export default function LevelAccessGuard({ children }) {
  const [status, setStatus] = useState("loading"); // "loading" | "allowed" | "blocked"

  useEffect(() => {
    base44.functions.invoke("checkLevelAccess", {})
      .then((res) => {
        const data = res.data;
        setStatus(data?.has_access ? "allowed" : "blocked");
      })
      .catch(() => setStatus("blocked"));
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "blocked") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso bloqueado</h2>
        <p className="text-gray-500 mb-8 max-w-sm">
          Para acceder a esta sección debes activar tu nivel ingresando tu folio de pago.
        </p>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => window.location.href = createPageUrl("Dashboard")}
        >
          Ingresar folio de pago
        </Button>
      </div>
    );
  }

  return children;
}