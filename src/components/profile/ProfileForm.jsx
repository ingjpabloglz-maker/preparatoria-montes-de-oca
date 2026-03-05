import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, Save } from "lucide-react";

const FIELDS = [
  { key: 'nombres', label: 'Nombres', required: true },
  { key: 'apellido_paterno', label: 'Apellido Paterno', required: true },
  { key: 'apellido_materno', label: 'Apellido Materno', required: false },
  { key: 'telefono_personal', label: 'Teléfono Personal', required: true },
  { key: 'telefono_tutor', label: 'Teléfono del Tutor (opcional)', required: false },
  { key: 'correo_contacto', label: 'Correo Electrónico de Contacto', required: true },
];

// mode: 'student' = alumno edita su propio perfil | 'admin' = admin edita datos del alumno
export default function ProfileForm({ user, onSaved, onAdminUpdate, mode = 'student' }) {
  const [form, setForm] = useState({
    nombres: user?.nombres || '',
    apellido_paterno: user?.apellido_paterno || '',
    apellido_materno: user?.apellido_materno || '',
    telefono_personal: user?.telefono_personal || '',
    telefono_tutor: user?.telefono_tutor || '',
    correo_contacto: user?.correo_contacto || user?.email || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    if (mode === 'admin') {
      await onAdminUpdate?.(form);
    } else {
      await base44.auth.updateMe(form);
      onSaved?.();
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const isComplete = form.nombres && form.apellido_paterno && form.telefono_personal && form.correo_contacto;

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCircle className="w-5 h-5" />
          Información Personal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {FIELDS.map(({ key, label, required }) => (
            <div key={key} className="space-y-1">
              <Label>
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                value={form[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={label}
              />
            </div>
          ))}
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || !isComplete}
          className="w-full mt-2"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : saved ? '¡Guardado exitosamente!' : 'Guardar Información'}
        </Button>
      </CardContent>
    </Card>
  );
}