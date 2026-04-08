import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserCircle, Save, Trash2 } from "lucide-react";

const CURP_REGEX = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$/;

function validateCurp(value) {
  if (!value) return null; // optional
  if (value.length !== 18) return 'La CURP debe tener exactamente 18 caracteres';
  if (!CURP_REGEX.test(value)) return 'Formato de CURP inválido';
  return null;
}

const TEXT_FIELDS = [
  { key: 'nombres', label: 'Nombres', required: true, type: 'text' },
  { key: 'apellido_paterno', label: 'Apellido Paterno', required: true, type: 'text' },
  { key: 'apellido_materno', label: 'Apellido Materno', required: false, type: 'text' },
  { key: 'correo_contacto', label: 'Correo Electrónico de Contacto', required: true, type: 'text' },
];

const PHONE_FIELDS = [
  { key: 'telefono_personal', label: 'Teléfono Personal', required: true },
  { key: 'telefono_tutor', label: 'Teléfono del Tutor (opcional)', required: false },
];

function validatePhone(value) {
  if (!value) return true; // handled by required check
  return /^\d{10}$/.test(value);
}

export default function ProfileForm({ user, onSaved, onAdminUpdate, onAdminClearField, mode = 'student' }) {
  const [form, setForm] = useState({
    nombres: user?.nombres || '',
    apellido_paterno: user?.apellido_paterno || '',
    apellido_materno: user?.apellido_materno || '',
    telefono_personal: user?.telefono_personal || '',
    telefono_tutor: user?.telefono_tutor || '',
    correo_contacto: user?.correo_contacto || user?.email || '',
    curp: user?.curp || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [phoneErrors, setPhoneErrors] = useState({});
  const [curpError, setCurpError] = useState(null);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePhoneChange = (field, value) => {
    // Only allow digits
    const digits = value.replace(/\D/g, '').slice(0, 10);
    setForm(prev => ({ ...prev, [field]: digits }));
    if (digits.length > 0 && digits.length < 10) {
      setPhoneErrors(prev => ({ ...prev, [field]: 'Debe tener exactamente 10 dígitos' }));
    } else {
      setPhoneErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleCurpChange = (value) => {
    const upper = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 18);
    setForm(prev => ({ ...prev, curp: upper }));
    setCurpError(validateCurp(upper));
  };

  const isValid = () => {
    const requiredOk = form.nombres && form.apellido_paterno && form.telefono_personal && form.correo_contacto;
    const phonesOk = validatePhone(form.telefono_personal) && validatePhone(form.telefono_tutor);
    const curpOk = !validateCurp(form.curp);
    return requiredOk && phonesOk && curpOk;
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form };
    if (!payload.curp) delete payload.curp; // don't overwrite with empty string
    if (mode === 'admin') {
      await onAdminUpdate?.(payload);
    } else {
      await base44.auth.updateMe(payload);
      onSaved?.();
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleClear = async (field) => {
    if (mode === 'admin' && onAdminClearField) {
      await onAdminClearField(field);
      setForm(prev => ({ ...prev, [field]: '' }));
    }
  };

  const allFields = [...TEXT_FIELDS, ...PHONE_FIELDS];

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
          {TEXT_FIELDS.map(({ key, label, required }) => (
            <div key={key} className="space-y-1">
              <Label>
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <div className="flex gap-2">
                <Input
                  value={form[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder={label}
                  className="flex-1"
                />
                {mode === 'admin' && form[key] && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                    title="Borrar campo"
                    onClick={() => handleClear(key)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {/* CURP Field */}
          <div className="space-y-1 sm:col-span-2">
            <Label>
              CURP <span className="text-gray-400 font-normal text-xs">(opcional)</span>
            </Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={form.curp}
                  onChange={(e) => handleCurpChange(e.target.value)}
                  placeholder="Ej: GOMJ960101HNLPRN09"
                  maxLength={18}
                  className={`font-mono uppercase ${curpError ? 'border-red-400' : form.curp.length === 18 && !curpError ? 'border-green-400' : ''}`}
                />
                {curpError && <p className="text-xs text-red-500 mt-1">{curpError}</p>}
                {!curpError && form.curp.length > 0 && form.curp.length < 18 && (
                  <p className="text-xs text-gray-400 mt-1">{form.curp.length} / 18 caracteres</p>
                )}
                {!curpError && form.curp.length === 18 && (
                  <p className="text-xs text-green-600 mt-1">✓ CURP válida</p>
                )}
              </div>
              {mode === 'admin' && form.curp && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                  title="Borrar CURP"
                  onClick={() => handleClear('curp')}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {PHONE_FIELDS.map(({ key, label, required }) => (
            <div key={key} className="space-y-1">
              <Label>
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    value={form[key]}
                    onChange={(e) => handlePhoneChange(key, e.target.value)}
                    placeholder="10 dígitos"
                    maxLength={10}
                    inputMode="numeric"
                    className={phoneErrors[key] ? 'border-red-400' : ''}
                  />
                  {phoneErrors[key] && (
                    <p className="text-xs text-red-500 mt-1">{phoneErrors[key]}</p>
                  )}
                </div>
                {mode === 'admin' && form[key] && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                    title="Borrar campo"
                    onClick={() => handleClear(key)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || !isValid()}
          className="w-full mt-2"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : saved ? '¡Guardado exitosamente!' : 'Guardar Información'}
        </Button>
      </CardContent>
    </Card>
  );
}