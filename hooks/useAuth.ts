import { useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      setIsLoading(false);

      if (!session) {
        router.replace('/auth');
      } else if (segments[0] === 'auth') {
        router.replace('/(tabs)');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    setIsLoading(false);

    if (!session && segments[0] !== 'auth') {
      router.replace('/auth');
    }
  };

  return { isAuthenticated, isLoading };
}
