import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useUserEvent(userEmail) {
  const queryClient = useQueryClient();

  const dispatchUserEvent = async (eventType, eventData = {}) => {
    const previousProfile = queryClient.getQueryData(['gamificationProfile', userEmail]);
    const previousAchievements = queryClient.getQueryData(['userAchievements', userEmail]);

    try {
      const eventId = crypto.randomUUID();

      const response = await base44.functions.invoke('handleUserEvent', {
        event_id: eventId,
        event_type: eventType,
        event_data: eventData,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['gamificationProfile', userEmail], exact: true }),
        queryClient.invalidateQueries({ queryKey: ['userAchievements', userEmail], exact: true }),
      ]);

      return response.data;

    } catch (error) {
      console.error('Error en dispatchUserEvent:', error);

      // Rollback en caso de error
      if (previousProfile !== undefined) {
        queryClient.setQueryData(['gamificationProfile', userEmail], previousProfile);
      }
      if (previousAchievements !== undefined) {
        queryClient.setQueryData(['userAchievements', userEmail], previousAchievements);
      }

      throw error;
    }
  };

  return { dispatchUserEvent };
}