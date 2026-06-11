import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { GraduationCap } from 'lucide-react';
import ProfileForm from '@/components/profile/ProfileForm';

export default function OnboardingProfile({ user, onProfileCompleted }) {
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    // Cargar perfil existente si lo hay (parcialmente lleno)
    base44.entities.UserProfile.filter({ user_email: user.email })
      .then(results => {
        if (results.length > 0) setProfileData(results[0]);
      })
      .catch(() => {});
  }, [user.email]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-2xl">

        {/* Header institucional */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            ¡Bienvenido a la<br />
            <span className="text-blue-700">Escuela Preparatoria<br />Fernando Montes de Oca</span>!
          </h1>
          <p className="text-sm text-gray-500 mt-2">Modalidad en línea — Bachillerato General</p>
        </div>

        {/* Instrucciones */}
        <div className="bg-blue-50 rounded-xl p-4 mb-6 text-sm text-blue-800 border border-blue-100">
          <p className="font-medium mb-1">📋 Paso 1 de 2 — Completa tu perfil</p>
          <p>Antes de ingresar a la plataforma, necesitamos tus datos personales para crear tu expediente académico. Todos los campos marcados con <span className="text-red-500 font-bold">*</span> son obligatorios.</p>
        </div>

        {/* Formulario reutilizando ProfileForm en modo alumno */}
        <ProfileForm
          user={profileData || { email: user.email, correo_contacto: user.email }}
          mode="student"
          onSaved={onProfileCompleted}
        />

        <p className="text-center text-xs text-gray-400 mt-4">
          Tus datos son confidenciales y solo serán utilizados con fines académicos.
        </p>
      </div>
    </div>
  );
}