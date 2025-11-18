import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type Friend = {
  friend_user_id: string;
  display_name: string | null;
  share_code: string | null;
};

export function useFriends(userId: string | null) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('list_friends');
      if (error) throw error;
      setFriends((data ?? []) as Friend[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load friends');
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`friend_links_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_links' }, () => {
        fetchFriends();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchFriends]);

  const linkByCode = useCallback(async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return { ok: false, message: 'Code is required' };
    const { data, error } = await supabase.rpc('link_friend', { p_code: trimmed });
    if (error) return { ok: false, message: error.message };
    await fetchFriends();
    return { ok: true };
  }, [fetchFriends]);

  const unlinkFriend = useCallback(async (friendUserId: string) => {
    const { data, error } = await supabase.rpc('unlink_friend', { p_friend_id: friendUserId });
    if (error) return { ok: false, message: error.message };
    await fetchFriends();
    return { ok: true };
  }, [fetchFriends]);

  return { friends, loading, error, linkByCode, unlinkFriend, refresh: fetchFriends };
}
