import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useGamificationProfile(userEmail) {
  return useQuery({
    queryKey: ['gamificationProfile', userEmail],
    queryFn: async () => {
      const result = await base44.entities.GamificationProfile.filter({ user_email: userEmail });
      if (!result || result.length === 0) {
        return null;
      }
      return result[0];
    },
    enabled: !!userEmail,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}