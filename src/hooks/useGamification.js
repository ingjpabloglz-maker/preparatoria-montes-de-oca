import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9';

export function useGamificationProfile(userEmail) {
  return useQuery({
    queryKey: ['gamificationProfile', userEmail],
    queryFn: () => base44.entities.GamificationProfile.filter({ user_email: userEmail }),
    enabled: !!userEmail,
    staleTime: 30 * 1000, // 30s
    refetchInterval: (query) => {
      // Solo polling activo si la pestaña está visible
      return document.visibilityState === 'visible' ? 15000 : false;
    },
    select: (data) => data[0] || null,
  });
}

export async function dispatchUserEvent(eventType, eventData = {}) {
  const eventId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36);
  const response = await base44.functions.invoke('handleUserEvent', {
    event_id: eventId,
    event_type: eventType,
    event_data: eventData,
  });
  return response.data;
}