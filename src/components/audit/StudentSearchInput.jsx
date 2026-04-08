import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';

export default function StudentSearchInput({ value, onChange }) {
  // value = { user_email, full_name } | null
  const [query, setQuery] = useState(value?.full_name || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Sync if value cleared externally
  useEffect(() => {
    if (!value) setQuery('');
  }, [value]);

  function handleInput(e) {
    const q = e.target.value;
    setQuery(q);
    onChange(null); // clear selection while typing

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('searchStudents', { query: q });
        setResults(res.data?.students || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function handleSelect(student) {
    setQuery(student.full_name);
    setResults([]);
    setOpen(false);
    onChange(student);
  }

  function handleClear() {
    setQuery('');
    setResults([]);
    setOpen(false);
    onChange(null);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Buscar alumno..."
          value={query}
          onChange={handleInput}
          className="h-8 text-sm pl-8 pr-7"
        />
        {(query || value) && (
          <button onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-xs text-gray-400">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Sin resultados</div>
          ) : (
            results.map(s => (
              <button
                key={s.user_email}
                className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors"
                onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
              >
                <span className="font-medium text-gray-800">{s.full_name}</span>
                <span className="text-xs text-gray-400 ml-2">{s.user_email}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}