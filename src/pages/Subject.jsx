import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  X
} from "lucide-react";
import SubjectAnalytics from '../components/analytics/SubjectAnalytics';

export default function Subject() {
  const urlParams = new URLSearchParams(window.location.search);
  const subjectId = urlParams.get('id');
  
  const [user, setUser] = useState(null);
  const [newError, setNewError] = useState('');
  const [difficultyRating, setDifficultyRating] = useState(0);
  const sessionStartRef = useRef(Date.now());
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const { data: subject } = useQuery({
    queryKey: ['subject', subjectId],
    queryFn: async () => {
      const subjects = await base44.entities.Subject.filter({ id: subjectId });
      return subjects[0];
    },
    enabled: !!subjectId,
  });

  const { data: progressData } = useQuery({
    queryKey: ['subjectProgress', user?.email, subjectId],
    queryFn: async () => {
      const progress = await base44.entities.SubjectProgress.filter({ 
        user_email: user?.email,
        subject_id: subjectId
      });
      return progress[0];
    },
    enabled: !!user?.email && !!subjectId,
  });

  // Sync difficulty rating from loaded data
  useEffect(() => {
    if (progressData?.difficulty_rating) {
      setDifficultyRating(progressData.difficulty_rating);
    }
  }, [progressData]);

  // Save session time on unmount
  useEffect(() => {
    return () => {
      if (!user?.email || !subjectId) return;
      const durationMinutes = Math.round((Date.now() - sessionStartRef.current) / 60000);
      if (durationMinutes < 1) return;
      // Fire and forget — update time spent
      base44.entities.SubjectProgress.filter({ user_email: user.email, subject_id: subjectId })
        .then(results => {
          const existing = results[0];
          if (!existing) return;
          const sessions = [...(existing.sessions || []), {
            date: new Date().toISOString(),
            duration_minutes: durationMinutes,
            progress_at_end: existing.progress_percent || 0
          }];
          base44.entities.SubjectProgress.update(existing.id, {
            time_spent_minutes: (existing.time_spent_minutes || 0) + durationMinutes,
            sessions
          });
        });
    };
  }, [user, subjectId]);

  const updateProgressMutation = useMutation({
    mutationFn: async (newProgress) => {
      if (progressData) {
        await base44.entities.SubjectProgress.update(progressData.id, {
          progress_percent: newProgress,
          completed: newProgress >= 100,
          last_activity: new Date().toISOString()
        });
      } else {
        await base44.entities.SubjectProgress.create({
          user_email: user.email,
          subject_id: subjectId,
          progress_percent: newProgress,
          completed: newProgress >= 100,
          last_activity: new Date().toISOString(),
          time_spent_minutes: 0,
          sessions: [],
          errors_noted: []
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['subjectProgress']);
    }
  });

  const updateDifficultyMutation = useMutation({
    mutationFn: async (rating) => {
      if (progressData) {
        await base44.entities.SubjectProgress.update(progressData.id, { difficulty_rating: rating });
      }
    },
    onSuccess: () => queryClient.invalidateQueries(['subjectProgress'])
  });

  const addErrorMutation = useMutation({
    mutationFn: async (error) => {
      if (!progressData) return;
      const errors = [...(progressData.errors_noted || []), error];
      await base44.entities.SubjectProgress.update(progressData.id, { errors_noted: errors });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['subjectProgress']);
      setNewError('');
    }
  });

  const removeErrorMutation = useMutation({
    mutationFn: async (index) => {
      if (!progressData) return;
      const errors = (progressData.errors_noted || []).filter((_, i) => i !== index);
      await base44.entities.SubjectProgress.update(progressData.id, { errors_noted: errors });
    },
    onSuccess: () => queryClient.invalidateQueries(['subjectProgress'])
  });

  const currentProgress = progressData?.progress_percent || 0;
  const isCompleted = progressData?.completed || false;

  if (!subject) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => window.location.href = createPageUrl(`Level?level=${subject.level}`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{subject.name}</h1>
              {isCompleted && (
                <Badge className="bg-green-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Completada
                </Badge>
              )}
            </div>
            <p className="text-gray-500">Nivel {subject.level}</p>
          </div>
        </div>

        {/* Progress Card */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">Tu Progreso</h3>
              <span className="text-2xl font-bold text-blue-600">{Math.round(currentProgress)}%</span>
            </div>
            <Progress value={currentProgress} className="h-4 mb-4" />
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-3">Actualiza tu avance manualmente:</p>
              <Slider
                value={[currentProgress]}
                max={100}
                step={5}
                onValueChange={(value) => updateProgressMutation.mutate(value[0])}
                className="mb-2"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Placeholder */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Contenido del Curso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Temario Próximamente</h3>
              <p className="text-sm">
                El contenido de esta materia se agregará próximamente.
                <br />
                Por ahora, puedes registrar tu avance manualmente.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Description */}
        {subject.description && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Descripción</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">{subject.description}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}