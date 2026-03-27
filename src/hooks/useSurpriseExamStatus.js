import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useHasCompletedSurpriseExam(userEmail) {
  const today = new Date().toISOString().split('T')[0];

  const { data } = useQuery({
    queryKey: ['surpriseExamStatus', userEmail],
    queryFn: async () => {
      const attempts = await base44.entities.SurpriseExamAttempt.filter({ user_email: userEmail, date: today });
      return attempts.length > 0;
    },
    enabled: !!userEmail,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  return data ?? false;
}