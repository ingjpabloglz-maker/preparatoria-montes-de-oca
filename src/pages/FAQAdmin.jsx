import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil, Trash2, Image, Save, X, Upload } from "lucide-react";
import { Link } from 'react-router-dom';

const OWNER_EMAIL = 'ing.jpablo.glz@gmail.com';

const CATEGORIAS = [
  "Lecciones y Actividades",
  "Gamificación",
  "Pagos y Colegiaturas",
  "Exámenes",
  "Soporte"
];

const EMPTY_FORM = { pregunta: '', respuesta: '', categoria: 'Lecciones y Actividades', imagen_url: '', orden: 0 };

export default function FAQAdmin() {
  const [authorized, setAuthorized] = useState(false);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // faq objeto o 'new'
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user?.email === OWNER_EMAIL) {
        setAuthorized(true);
        loadFaqs();
      } else {
        window.location.href = '/app/Dashboard';
      }
    });
  }, []);

  const loadFaqs = async () => {
    setLoading(true);
    const data = await base44.entities.FAQ.list('orden', 200);
    setFaqs(data);
    setLoading(false);
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditing('new');
  };

  const openEdit = (faq) => {
    setForm({ pregunta: faq.pregunta, respuesta: faq.respuesta, categoria: faq.categoria, imagen_url: faq.imagen_url || '', orden: faq.orden || 0 });
    setEditing(faq);
  };

  const handleSave = async () => {
    if (!form.pregunta.trim() || !form.respuesta.trim()) return;
    setSaving(true);
    const payload = { ...form, orden: Number(form.orden) || 0 };
    if (editing === 'new') {
      await base44.entities.FAQ.create(payload);
    } else {
      await base44.entities.FAQ.update(editing.id, payload);
    }
    setEditing(null);
    setSaving(false);
    await loadFaqs();
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta pregunta?')) return;
    await base44.entities.FAQ.delete(id);
    setFaqs(prev => prev.filter(f => f.id !== id));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImg(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, imagen_url: file_url }));
    setUploadingImg(false);
  };

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/app/Profile">
              <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión de FAQs</h1>
              <p className="text-sm text-gray-500">Panel exclusivo del owner</p>
            </div>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Nueva pregunta
          </Button>
        </div>

        {/* Formulario inline */}
        {editing && (
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">{editing === 'new' ? 'Nueva pregunta' : 'Editar pregunta'}</h2>

            <div className="space-y-1">
              <Label>Categoría</Label>
              <Select value={form.categoria} onValueChange={val => setForm(f => ({ ...f, categoria: val }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Pregunta</Label>
              <Input value={form.pregunta} onChange={e => setForm(f => ({ ...f, pregunta: e.target.value }))} placeholder="¿Cómo...?" />
            </div>

            <div className="space-y-1">
              <Label>Respuesta</Label>
              <Textarea value={form.respuesta} onChange={e => setForm(f => ({ ...f, respuesta: e.target.value }))} rows={5} placeholder="Escribe la respuesta aquí..." />
            </div>

            <div className="space-y-1">
              <Label>Orden (número)</Label>
              <Input type="number" value={form.orden} onChange={e => setForm(f => ({ ...f, orden: e.target.value }))} className="w-24" />
            </div>

            <div className="space-y-2">
              <Label>Imagen de apoyo (opcional)</Label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 hover:border-blue-400 text-sm text-gray-500 hover:text-blue-500 transition-colors">
                    <Upload className="w-4 h-4" />
                    {uploadingImg ? 'Subiendo...' : 'Subir imagen'}
                  </div>
                </label>
                {form.imagen_url && (
                  <div className="flex items-center gap-2">
                    <img src={form.imagen_url} alt="preview" className="h-10 w-10 rounded-lg object-cover border" />
                    <button onClick={() => setForm(f => ({ ...f, imagen_url: '' }))} className="text-red-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving || uploadingImg} className="gap-2">
                <Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            </div>
          </div>
        )}

        {/* Lista de FAQs */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {faqs.length === 0 && (
              <p className="text-center text-gray-400 py-10">No hay preguntas. ¡Crea la primera!</p>
            )}
            {faqs.map(faq => (
              <div key={faq.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{faq.categoria}</Badge>
                    <span className="text-xs text-gray-400">orden: {faq.orden}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate">{faq.pregunta}</p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{faq.respuesta}</p>
                  {faq.imagen_url && <Image className="w-4 h-4 text-blue-400 mt-1" />}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(faq)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600" onClick={() => handleDelete(faq.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}