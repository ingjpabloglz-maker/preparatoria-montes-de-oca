import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import AuditFilters from '@/components/audit/AuditFilters';
import AuditAttemptList from '@/components/audit/AuditAttemptList';
import AuditAttemptDetail from '@/components/audit/AuditAttemptDetail';
import AuditKPIs from '@/components/audit/AuditKPIs';
import { Shield, AlertTriangle } from 'lucide-react';
import { hasPermission } from '@/lib/permissions';

export default function AuditDashboard() {
  const [user, setUser] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [filters, setFilters] = useState({});
  const [subjects, setSubjects] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const listRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    base44.entities.Subject.list()
      .then(s => setSubjects(s || []))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadAttempts(1);
    setCurrentPage(1);
  }, [user, filters]);

  async function loadAttempts(page = currentPage) {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getEvaluationAttempts', { ...filters, page, limit: 20 });
      setAttempts(res.data?.attempts || []);
      setTotalCount(res.data?.total_count || 0);
      setTotalPages(res.data?.total_pages || 1);
      setCurrentPage(page);
      // Scroll to list top
      if (listRef.current) listRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleReview({ attempt_id, score, passed, feedback }) {
    await base44.functions.invoke('reviewEvaluationAttempt', { attempt_id, score, passed, feedback });
    setSelectedAttempt(null);
    loadAttempts();
  }

  if (!user) return null;

  if (!hasPermission(user, 'audit.access')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-bold text-gray-800">Acceso denegado</h2>
        <p className="text-gray-500">Solo administradores y docentes pueden acceder a la Auditoría Académica.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditoría Académica</h1>
          <p className="text-sm text-gray-500">Trazabilidad completa de evaluaciones — Cumplimiento SEP</p>
        </div>
      </div>

      {/* KPIs */}
      {!selectedAttempt && <AuditKPIs attempts={attempts} />}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar filtros */}
        {!selectedAttempt && (
          <div className="w-full lg:w-64 shrink-0">
            <AuditFilters subjects={subjects} onFilter={setFilters} />
          </div>
        )}

        {/* Contenido principal */}
        <div className="flex-1 min-w-0" ref={listRef}>
          {selectedAttempt ? (
            <AuditAttemptDetail
              attempt={selectedAttempt}
              onBack={() => setSelectedAttempt(null)}
              onReview={handleReview}
              userRole={user.role}
            />
          ) : (
            <AuditAttemptList
              attempts={attempts}
              loading={loading}
              onSelect={setSelectedAttempt}
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              onPageChange={loadAttempts}
            />
          )}
        </div>
      </div>
    </div>
  );
}