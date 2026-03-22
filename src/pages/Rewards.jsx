import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Trophy, Star, Flame, Zap, Swords, Target, BookOpen, Award, Lock, Droplets, CalendarDays, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGamificationProfile } from '@/hooks/useGamification';
import confetti from 'canvas-confetti';

const ICON_MAP = {
  Trophy, Star, Flame, Zap, Swords, Target, BookOpen, Award, Sparkles, CalendarDays,
};

const RARITY_STYLES = {
  common:    { badge: 'bg-gray-100 text-gray-600 border-gray-200',    card: 'border-gray-200',    glow: '' },
  rare:      { badge: 'bg-blue-100 text-blue-700 border-blue-200',    card: 'border-blue-200',    glow: 'shadow-blue-100' },
  epic:      { badge: 'bg-purple-100 text-purple-700 border-purple-200', card: 'border-purple-200', glow: 'shadow-purple-100' },
  legendary: { badge: 'bg-amber-100 text-amber-700 border-amber-200', card: 'border-amber-300',   glow: 'shadow-amber-100 shadow-lg' },
};

const RARITY_LABELS = { common: 'Común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario' };

export default function Rewards() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: profile } = useGamificationProfile(user?.email);

  const { data: allAchievements = [] } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => base44.entities.Achievement.list(),
    staleTime: Infinity,
  });

  const { data: userAchievements = [] } = useQuery({
    queryKey: ['userAchievements', user?.email],
    queryFn: () => base44.entities.UserAchievement.filter({ user_email: user?.email }),
    enabled: !!user?.email,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const unlockedMap = {};
  userAchievements.forEach(ua => {
    unlockedMap[ua.achievement_id] = ua;
  });

  const unlockedCount = userAchievements.filter(ua => ua.is_unlocked).length;

  // Curva de XP tipo RPG (igual que backend)
  const getXpForLevel = (lvl) => Math.floor(50 * Math.pow(lvl, 1.5));

  const xp = profile?.xp_points || 0;
  const level = profile?.level || 1;
  const xpForCurrentLevel = getXpForLevel(level);
  const xpForNextLevel = getXpForLevel(level + 1);
  const xpInLevel = xp - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  const xpProgress = Math.max(0, Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)));

  const today = new Date().toISOString().split('T')[0];
  const canDoExam = profile?.last_surprise_exam_date_normalized !== today;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-8 h-8 text-amber-500" />
              Mis Recompensas
            </h1>
            <p className="text-gray-500 mt-1">{unlockedCount} de {allAchievements.length} logros desbloqueados</p>
          </div>
          <Link to="/SurpriseExam">
            <Button
              disabled={!canDoExam}
              className="bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold shadow-lg"
            >
              <Swords className="w-4 h-4 mr-2" />
              {canDoExam ? '¡Desafío Diario!' : 'Vuelve mañana'}
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-orange-100">
            <CardContent className="p-4 flex items-center gap-3">
              <Flame className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold text-orange-700">{profile?.streak_days || 0}</p>
                <p className="text-xs text-orange-500">Racha actual</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-amber-100">
            <CardContent className="p-4 flex items-center gap-3">
              <Star className="w-8 h-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold text-amber-700">{profile?.total_stars || 0}</p>
                <p className="text-xs text-amber-500">Estrellas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-4 flex items-center gap-3">
              <Droplets className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-blue-700">{profile?.water_tokens || 0}</p>
                <p className="text-xs text-blue-500">Tokens de agua</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-violet-50 to-violet-100">
            <CardContent className="p-4 flex items-center gap-3">
              <Zap className="w-8 h-8 text-violet-500" />
              <div>
                <p className="text-2xl font-bold text-violet-700">{profile?.xp_points || 0}</p>
                <p className="text-xs text-violet-500">XP total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Nivel y Progreso XP */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-lg">
                  {level}
                </div>
                <div>
                  <p className="font-bold text-gray-800">Nivel {level}</p>
                  <p className="text-xs text-gray-500">{xp} XP totales</p>
                </div>
              </div>
              <p className="text-xs text-gray-400">Próx. nivel: {xpForNextLevel} XP</p>
            </div>
            <Progress value={xpProgress} className="h-3" />
            <p className="text-xs text-gray-400 mt-1">{xpProgress}% hacia el Nivel {level + 1}</p>
          </CardContent>
        </Card>

        {/* Racha máxima */}
        {(profile?.max_streak || 0) > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700">
            <Flame className="w-4 h-4" />
            <span>Mejor racha histórica: <strong>{profile.max_streak} días</strong></span>
          </div>
        )}

        {/* Logros */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Mis Logros
          </h2>
          {allAchievements.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="p-8 text-center text-gray-400">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No hay logros configurados aún.</p>
                <p className="text-sm mt-1">El administrador puede añadirlos desde el panel.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allAchievements.map((ach) => {
                const ua = unlockedMap[ach.id];
                const isUnlocked = ua?.is_unlocked || false;
                const progress = ua?.progress_current || 0;
                const target = ach.condition_value || 1;
                const pct = Math.min(100, Math.round((progress / target) * 100));
                const styles = RARITY_STYLES[ach.rarity] || RARITY_STYLES.common;
                const IconComp = ICON_MAP[ach.icon_name] || Award;

                return (
                  <Card
                    key={ach.id}
                    className={`border transition-all ${styles.card} ${styles.glow} ${!isUnlocked ? 'opacity-50 grayscale' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isUnlocked ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gray-200'}`}>
                          {isUnlocked
                            ? <IconComp className="w-6 h-6 text-white" />
                            : <Lock className="w-5 h-5 text-gray-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm text-gray-800">{ach.name}</p>
                            <Badge className={`text-xs ${styles.badge}`}>
                              {RARITY_LABELS[ach.rarity]}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{ach.description}</p>
                          {!isUnlocked && target > 1 && (
                            <div className="mt-2">
                              <Progress value={pct} className="h-1.5" />
                              <p className="text-xs text-gray-400 mt-1">{progress}/{target}</p>
                            </div>
                          )}
                          {isUnlocked && ua?.unlocked_date && (
                            <p className="text-xs text-green-500 mt-1">
                              ✓ {new Date(ua.unlocked_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}