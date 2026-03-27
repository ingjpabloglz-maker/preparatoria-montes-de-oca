import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import LevelAccessGuard from "@/components/common/LevelAccessGuard";
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Trophy, Star, Flame, Zap, Swords, Target, BookOpen, Award, Lock, Droplets, CalendarDays, Sparkles, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGamificationProfile } from '@/hooks/useGamification';
import confetti from 'canvas-confetti';
import TreeVisualization from '@/components/gamification/TreeVisualization';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
  const [buyingShield, setBuyingShield] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: profile } = useGamificationProfile(user?.email);

  const handleBuyShield = async () => {
    setBuyingShield(true);
    const res = await base44.functions.invoke('purchaseStreakShield', {});
    if (res.data?.success) {
      toast.success('🛡️ Protección de racha activada');
      queryClient.invalidateQueries({ queryKey: ['gamificationProfile', user?.email] });
    } else {
      toast.error(res.data?.error || 'No se pudo comprar la protección');
    }
    setBuyingShield(false);
  };

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

  const xp = profile?.xp_points || 0;
  const level = Math.max(1, Math.floor(Math.sqrt(xp / 10)));
  const minXP = Math.pow(level, 2) * 10;
  const nextLevelXP = Math.pow(level + 1, 2) * 10;
  const xpInLevel = xp - minXP;
  const xpNeeded = nextLevelXP - minXP;
  const xpProgress = Math.max(0, Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)));

  const today = new Date().toISOString().split('T')[0];
  const alreadyDone = profile?.last_surprise_exam_date_normalized === today;
  const canDoExam = !alreadyDone;

  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!alreadyDone) return;
    const update = () => {
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      const diffMs = tomorrow - now;
      const totalSecs = Math.max(0, Math.floor(diffMs / 1000));
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      setTimeLeft(`${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [alreadyDone]);

  return (
    <LevelAccessGuard>
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
          <div className="flex flex-col items-end gap-1">
            <Link to={canDoExam ? '/SurpriseExam' : '#'} onClick={e => !canDoExam && e.preventDefault()}>
              <Button
                disabled={!canDoExam}
                className="bg-gradient-to-r from-violet-600 to-blue-600 text-white font-bold shadow-lg disabled:opacity-60"
              >
                <Swords className="w-4 h-4 mr-2" />
                {canDoExam ? '¡Desafío Diario!' : 'Ya completaste el desafío de hoy ✅'}
              </Button>
            </Link>
            {alreadyDone && timeLeft && (
              <p className="text-xs text-gray-400 text-right">
                Nuevo desafío en <span className="font-semibold text-violet-600">{timeLeft}</span>
              </p>
            )}
          </div>
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

        {/* Protección de Racha */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-sky-50 to-indigo-50 border border-sky-100">
          <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-800">Protección de Racha</p>
                <p className="text-sm text-gray-500">Evita perder tu racha si un día no estudias.</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm font-semibold text-indigo-700">
                    🛡️ {profile?.streak_shields || 0} / 2 activas
                  </span>
                  <span className="text-xs text-gray-400">Costo: 10 ⭐</span>
                </div>
              </div>
            </div>
            <Button
              onClick={handleBuyShield}
              disabled={buyingShield || (profile?.streak_shields || 0) >= 2 || (profile?.total_stars || 0) < 10}
              className="bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-bold shadow w-full sm:w-auto flex-shrink-0"
            >
              {buyingShield ? 'Comprando...' :
               (profile?.streak_shields || 0) >= 2 ? 'Máximo alcanzado' :
               (profile?.total_stars || 0) < 10 ? 'Estrellas insuficientes' :
               'Comprar protección'}
            </Button>
          </CardContent>
        </Card>

        {/* Árbol del Conocimiento */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              🌳 Árbol del Conocimiento
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <TreeVisualization profile={profile} />
          </CardContent>
        </Card>

        {/* Rango XP */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold text-lg">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-gray-800">⚡ Rango XP {level}</p>
                  <p className="text-xs text-gray-500">{xp} XP totales</p>
                </div>
              </div>
              <p className="text-xs text-gray-400">{Math.max(0, xpInLevel)} / {xpNeeded} XP</p>
            </div>
            <Progress value={xpProgress} className="h-3" />
            <p className="text-xs text-gray-400 mt-1">{xpProgress}% hacia el Rango {level + 1}</p>
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
    </LevelAccessGuard>
  );
}