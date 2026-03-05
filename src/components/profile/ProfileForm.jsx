import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, Save } from "lucide-react";

export default function ProfileForm({ user, onSaved, readOnly = false, onUpdate }) {
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
    await base44.auth.updateMe(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved?.();
  };

  const handleAdminUpdate = async () => {
    setSaving(true);
    await onUpdate(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fields = [
    { key: 'nombres', label: 'Nombres', required: true },
    { key: 'apellido_paterno', label: 'Apellido Paterno', required: true },
    { key: 'apellido_materno', label: 'Apellido Materno', required: false },
    { key: 'telefono_personal', label: 'Teléfono Personal', required: true },
    { key: 'telefono_tutor', label: 'Teléfono del Tutor', required: false },
    { key: 'correo_contacto', label: 'Correo Electrónico de Contacto', required: true },
  ];

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
          {fields.map(({ key, label, required }) => (
            <div key={key} className="space-y-1">
              <Label>
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                value={form[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                disabled={readOnly}
                placeholder={label}
              />
            </div>
          ))}
        </div>

        {!readOnly && (
          <Button
            onClick={handleSave}
            disabled={saving || !isComplete}
            className="w-full mt-2"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar Información'}
          </Button>
        )}

        {onUpdate && !readOnly === false && (
          <Button
            onClick={handleAdminUpdate}
            disabled={saving}
            className="w-full mt-2"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar Cambios'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}