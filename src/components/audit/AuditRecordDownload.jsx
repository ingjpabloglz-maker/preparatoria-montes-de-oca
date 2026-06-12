import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Download, Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';

export default function AuditRecordDownload() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchTimeout = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelected(null);
      setShowDropdown(false);
    }
  }, [open]);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await base44.functions.invoke('searchStudents', { query, page: 1, page_size: 10 });
        setResults(res.data?.students || []);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query]);

  const handleSelect = (student) => {
    setSelected(student);
    setQuery(student.user_email);
    setShowDropdown(false);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
  };

  const handleDownload = async (e) => {
    e.preventDefault();
    const email = selected?.user_email || query.trim();
    if (!email) {
      toast.error('Selecciona un alumno');
      return;
    }
    try {
      setLoading(true);
      const response = await base44.functions.invoke('generateAuditableStudentRecordPDF', {
        user_email: email,
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expediente_auditable_${email}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Expediente auditable descargado');
      setOpen(false);
    } catch (error) {
      toast.error(error.message || 'Error al descargar expediente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Descargar Expediente SEP
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Descargar Expediente Auditable (SEP)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleDownload} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Correo del Alumno
            </label>
            <div className="relative" ref={wrapperRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                placeholder="Buscar por nombre o correo..."
                disabled={loading}
                className="w-full pl-9 pr-8 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
                autoComplete="off"
              />
              {query && (
                <button type="button" onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
              {showDropdown && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {results.map((s) => (
                    <button
                      key={s.user_email}
                      type="button"
                      onClick={() => handleSelect(s)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-900">{s.full_name || s.nombres || 'Sin nombre'}</p>
                      <p className="text-xs text-gray-500">{s.user_email}</p>
                    </button>
                  ))}
                </div>
              )}
              {searching && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow p-3 text-center text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Buscando...
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 gap-2" disabled={loading || !query.trim()}>
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Generando...</>
              ) : (
                <><Download className="w-4 h-4" />Descargar</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}