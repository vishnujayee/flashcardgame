// lib/use-actor.ts
import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from './supabase-client';

export function useActor() {
  const [actorId, setActorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function getActor() {
      try {
        setIsLoading(true);
        const res = await fetch('/api/actor', {
          headers: {
            'Cache-Control': 'no-cache' // Prevent caching
          }
        });
        
        if (!isMounted) return;
        
        if (res.ok) {
          const data = await res.json();
          setActorId(data.actorId);
        } else {
          console.error('Failed to get actor ID:', res.status);
          setActorId(null);
        }
      } catch (error) {
        console.error('Failed to get actor ID:', error);
        if (isMounted) setActorId(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    
    getActor();

    // Listen for auth state changes
    const supabase = getSupabaseBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          getActor(); // Refresh actor ID on auth changes
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { actorId, isLoading };
}