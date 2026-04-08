import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { BookOpen, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasPermission } from '@/lib/permissions';

/**
 * Guard que permite el acceso a admin y docente.
 * Usa el sistema de permisos centralizado.
 */
export default function DocenteGuard({ children, permission = 'audit.access' }) {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    base44.auth.me()
      .then(user => {
        setStatus(hasPermission(user, permission) ? 'authorized' : 'unauthorized');
      })
      .catch(() => setStatus('unauthorized'));
  }, [permission]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <BookOpen className="w-10 h-10 text-gray-300" />
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
            Esta sección es exclusiva para administradores y docentes.
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