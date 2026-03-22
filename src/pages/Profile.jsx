import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Volume2, Bell } from "lucide-react";
import ProfileForm from '../components/profile/ProfileForm';
import { useSound } from '@/contexts/SoundContext';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [gamProfile, setGamProfile] = useState(null);
  const { isSoundEnabled, toggleSound } = useSound();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.location.href = createPageUrl('Dashboard')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
        </div>
        {user && <ProfileForm user={user} onSaved={handleSaved} />}
      </div>
    </div>
  );
}