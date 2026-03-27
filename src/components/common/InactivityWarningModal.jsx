import { Button } from '@/components/ui/button';

export default function InactivityWarningModal({ onStayActive }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⏱️</span>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Sesión por expirar</h2>
        <p className="text-gray-500 text-sm mb-6">
          Tu sesión se cerrará en <strong>2 minutos</strong> por inactividad.
        </p>
        <Button
          onClick={onStayActive}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
        >
          Seguir activo
        </Button>
      </div>
    </div>
  );
}