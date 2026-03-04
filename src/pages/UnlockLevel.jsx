import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

import FolioValidator from '../components/payment/FolioValidator';

export default function UnlockLevel() {
  const urlParams = new URLSearchParams(window.location.search);
  const levelNum = parseInt(urlParams.get('level')) || 1;
  
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const { data: userProgress } = useQuery({
    queryKey: ['userProgress', user?.email],
    queryFn: () => base44.entities.UserProgress.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['levelSubjects', levelNum - 1],
    queryFn: () => base44.entities.Subject.filter({ level: levelNum - 1 }),
    enabled: levelNum > 1,
  });

  const { data: subjectProgress = [] } = useQuery({
    queryKey: ['subjectProgress', user?.email],
    queryFn: () => base44.entities.SubjectProgress.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const progress = userProgress?.[0];
  const currentLevel = progress?.current_level || 1;

  // Verificar si puede desbloquear este nivel
  const canUnlock = levelNum === currentLevel + 1;
  const alreadyUnlocked = levelNum <= currentLevel;

  // Verificar si el nivel anterior está completado
  const prevLevelSubjects = subjects;
  const prevLevelProgress = prevLevelSubjects.length > 0
    ? prevLevelSubjects.reduce((sum, subject) => {
        const sp = subjectProgress.find(p => p.subject_id === subject.id);
        return sum + (sp?.progress_percent || 0);
      }, 0) / prevLevelSubjects.length
    : 0;

  const testScores = progress?.test_scores || [];
  const prevLevelTests = testScores.filter(t => t.level === levelNum - 1);
  const test1Passed = prevLevelTests.find(t => t.test_number === 1 && t.passed);
  const test2Passed = prevLevelTests.find(t => t.test_number === 2 && t.passed);
  const allTestsPassed = test1Passed && test2Passed;

  const prevLevelComplete = prevLevelProgress >= 100 && allTestsPassed;

  const handleUnlockSuccess = async () => {
    // Actualizar el nivel del usuario
    if (progress) {
      await base44.entities.UserProgress.update(progress.id, {
        current_level: levelNum,
        level_start_date: new Date().toISOString()
      });
    } else {
      await base44.entities.UserProgress.create({
        user_email: user.email,
        current_level: levelNum,
        level_start_date: new Date().toISOString(),
        completed_subjects: [],
        test_scores: [],
        total_progress_percent: 0
      });
    }

    // Redirigir al nivel
    setTimeout(() => {
      window.location.href = createPageUrl(`Level?level=${levelNum}`);
    }, 1500);
  };

  if (alreadyUnlocked) {
    window.location.href = createPageUrl(`Level?level=${levelNum}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Header */}
      <div className="p-6">
        <Button 
          variant="ghost" 
          className="gap-2"
          onClick={() => window.location.href = createPageUrl('Dashboard')}
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        {canUnlock ? (
          <FolioValidator 
            levelToUnlock={levelNum}
            userEmail={user?.email}
            onSuccess={handleUnlockSuccess}
          />
        ) : (
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Nivel No Disponible
            </h2>
            <p className="text-gray-500 mb-6">
              Para desbloquear el Nivel {levelNum}, primero debes completar el Nivel {levelNum - 1}.
            </p>
            <Button onClick={() => window.location.href = createPageUrl('Dashboard')}>
              Ir al Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}