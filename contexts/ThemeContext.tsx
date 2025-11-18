import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Theme, StarColor, UserSettings } from '@/types/database';
import { ThemeColors, themes, starColors } from '@/types/theme';
import { supabase } from '@/lib/supabase';
import { updateMoodWidget } from '@/utils/moodWidget';

interface ThemeContextType {
  theme: Theme;
  starColor: StarColor;
  colors: ThemeColors;
  centralStarColor: string;
  setTheme: (theme: Theme) => void;
  setStarColor: (color: StarColor) => void;
  loadSettings: () => Promise<void>;
  partnerUserId: string | null;
  partnerDisplayName: string | null;
  partnerShareCode: string | null;
  updatePartnerSettings: (settings: {
    partnerUserId?: string | null;
    partnerDisplayName?: string | null;
    partnerShareCode?: string | null;
  }) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('night_sky');
  const [starColor, setStarColorState] = useState<StarColor>('gold');
  const [userId, setUserId] = useState<string | null>(null);
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);
  const [partnerDisplayName, setPartnerDisplayName] = useState<string | null>(null);
  const [partnerShareCode, setPartnerShareCode] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        loadSettings();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`partner_moods_widget_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'moods',
        filter: `recipient_user_id=eq.${userId}`,
      }, (payload) => {
        const m: any = payload.new;
        try {
          updateMoodWidget(m.emoji, m.mood, m?.note ?? '', m?.gif_url ?? null);
        } catch {}
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('moods')
        .select('emoji, mood, note, gif_url, created_at')
        .eq('recipient_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const m: any = data[0];
        try {
          updateMoodWidget(m.emoji, m.mood, m?.note ?? '', m?.gif_url ?? null);
        } catch {}
      }
    })();
  }, [userId]);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setThemeState(data.theme);
      setStarColorState(data.central_star_color);
      setPartnerUserId(data.partner_user_id ?? null);
      setPartnerDisplayName(data.partner_display_name ?? null);
      if (data.partner_share_code) {
        setPartnerShareCode(data.partner_share_code);
      } else {
        const generatedCode = user.id.slice(0, 8).toUpperCase();
        setPartnerShareCode(generatedCode);
        await supabase
          .from('user_settings')
          .update({ partner_share_code: generatedCode })
          .eq('user_id', user.id);
      }
    } else if (!error) {
      const { error: insertError } = await supabase
        .from('user_settings')
        .insert({
          user_id: user.id,
          theme: 'night_sky',
          central_star_color: 'gold',
        });
      if (!insertError) {
        setPartnerUserId(null);
        setPartnerDisplayName(null);
        setPartnerShareCode(null);
      }
    }
  };

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_settings')
        .update({ theme: newTheme })
        .eq('user_id', user.id);
    }
  };

  const setStarColor = async (newColor: StarColor) => {
    setStarColorState(newColor);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('user_settings')
        .update({ central_star_color: newColor })
        .eq('user_id', user.id);
    }
  };

  const updatePartnerSettings = async ({
    partnerUserId: newPartnerUserId,
    partnerDisplayName: newPartnerDisplayName,
    partnerShareCode: newPartnerShareCode,
  }: {
    partnerUserId?: string | null;
    partnerDisplayName?: string | null;
    partnerShareCode?: string | null;
  }) => {
    setPartnerUserId((prev) => (newPartnerUserId !== undefined ? newPartnerUserId : prev));
    setPartnerDisplayName((prev) => (newPartnerDisplayName !== undefined ? newPartnerDisplayName : prev));
    setPartnerShareCode((prev) => (newPartnerShareCode !== undefined ? newPartnerShareCode : prev));

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const payload: Record<string, string | null | undefined> = {};
      if (newPartnerUserId !== undefined) payload.partner_user_id = newPartnerUserId;
      if (newPartnerDisplayName !== undefined) payload.partner_display_name = newPartnerDisplayName;
      if (newPartnerShareCode !== undefined) payload.partner_share_code = newPartnerShareCode;
      if (Object.keys(payload).length) {
        await supabase
          .from('user_settings')
          .update(payload)
          .eq('user_id', user.id);
      }
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        starColor,
        colors: themes[theme],
        centralStarColor: starColors[starColor],
        setTheme,
        setStarColor,
        loadSettings,
        partnerUserId,
        partnerDisplayName,
        partnerShareCode,
        updatePartnerSettings,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
