import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminGuard({ children }) {
  const [status, setStatus] = useState('loading'); // loading | authorized | unauthorized

  useEffect(() => {
    const check = async () => {
      try {
        const user = await base44.auth.me();
        if (user?.role === 'admin') {
          setStatus('authorized');
        } else {
          setStatus('unauthorized');
        }
      } catch {
        setStatus('unauthorized');
      }
    };
    check();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Shield className="w-10 h-10 text-gray-300" />
          <p className="text-gray-400">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthorized') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h2>
          <p className="text-gray-500 mb-6">
            No tienes permisos para acceder a esta sección. Solo los administradores pueden ingresar.
          </p>
          <Button onClick={() => window.location.href = createPageUrl('Dashboard')}>
            Ir a Mi Progreso
          </Button>
        </div>
      </div>
    );
  }

  return children;
}