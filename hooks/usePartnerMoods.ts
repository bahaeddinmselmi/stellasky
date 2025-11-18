import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Mood } from '@/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { updateMoodWidget } from '@/utils/moodWidget';

interface UsePartnerMoodsOptions {
  currentUserId: string | null;
  partnerUserId: string | null;
  onNewMood: (mood: Mood) => void;
}

export function usePartnerMoods({ currentUserId, partnerUserId, onNewMood }: UsePartnerMoodsOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!currentUserId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel(`incoming_moods_${currentUserId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'moods',
        filter: `recipient_user_id=eq.${currentUserId}`,
      }, (payload) => {
        if (payload.new) {
          const m = payload.new as Mood;
          onNewMood(m);
          // Also update Android widget immediately
          try {
            updateMoodWidget(m.emoji, m.mood, (m as any).note ?? '', (m as any).gif_url ?? null);
          } catch {}
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [currentUserId, onNewMood]);
}
