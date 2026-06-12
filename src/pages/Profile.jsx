import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Volume2, Bell, User, CreditCard, Volume1, Play, HelpCircle } from "lucide-react";
import { Link } from 'react-router-dom';

const OWNER_EMAIL = 'ing.jpablo.glz@gmail.com';
import ProfileForm from '../components/profile/ProfileForm';
import InstallmentsTab from '../components/profile/InstallmentsTab';
import { useSound } from '@/contexts/SoundContext';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [gamProfile, setGamProfile] = useState(null);
  const { isSoundEnabled, volume, toggleSound, setVolume, playSound } = useSound();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    base44.entities.GamificationProfile.filter({ user_email: user.email }).then(arr => {
      setGamProfile(arr[0] || null);
    });
  }, [user]);

  const handleSaved = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const isStudent = user?.role === 'user';
  const isOwner = user?.email === OWNER_EMAIL;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.location.href = createPageUrl('Dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
          {isOwner && (
            <Link to="/app/FAQAdmin" className="ml-auto">
              <Button variant="outline" size="sm" className="gap-2">
                <HelpCircle className="w-4 h-4" />
                Gestión FAQs
              </Button>
            </Link>
          )}
        </div>

        <Tabs defaultValue={window.location.hash === '#installments' ? 'installments' : 'profile'}>
          <TabsList className="bg-white shadow-sm">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Datos Personales
            </TabsTrigger>
            {isStudent && (
              <TabsTrigger value="installments" className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Colegiaturas
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="profile" className="mt-4 space-y-6">
            {user && <ProfileForm user={user} onSaved={handleSaved} />}

            {/* Preferencias — solo para alumnos */}
            {isStudent && (
              <Card className="border-0 shadow-md">
                <CardContent className="p-6 space-y-4">
                  <h2 className="font-semibold text-gray-800 text-base">Preferencias</h2>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-gray-500" />
                      <div>
                        <Label className="text-sm font-medium">Sonidos de actividades</Label>
                        <p className="text-xs text-gray-400">Retroalimentación auditiva al responder</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSoundEnabled && (
                        <button
                          onClick={() => playSound('correct_answer')}
                          title="Probar sonido"
                          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          <Play className="w-3 h-3" /> Probar
                        </button>
                      )}
                      <Switch checked={isSoundEnabled} onCheckedChange={toggleSound} />
                    </div>
                  </div>

                  {isSoundEnabled && (
                    <div className="flex items-center justify-between pl-6">
                      <div className="flex items-center gap-2">
                        <Volume1 className="w-4 h-4 text-gray-400" />
                        <Label className="text-sm text-gray-600">Volumen</Label>
                      </div>
                      <div className="flex gap-1">
                        {['low', 'medium', 'high'].map((level) => (
                          <button
                            key={level}
                            onClick={() => setVolume(level)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                              volume === level
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {level === 'low' ? 'Bajo' : level === 'medium' ? 'Medio' : 'Alto'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {gamProfile && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-gray-500" />
                        <div>
                          <Label className="text-sm font-medium">Notificaciones por email</Label>
                          <p className="text-xs text-gray-400">Recordatorios de estudio y actividad</p>
                        </div>
                      </div>
                      <Switch
                        checked={gamProfile.email_notifications_enabled !== false}
                        onCheckedChange={async (val) => {
                          const updated = { ...gamProfile, email_notifications_enabled: val };
                          setGamProfile(updated);
                          await base44.entities.GamificationProfile.update(gamProfile.id, { email_notifications_enabled: val });
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {isStudent && (
            <TabsContent value="installments" className="mt-4">
              <InstallmentsTab userEmail={user?.email} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}