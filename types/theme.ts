import { Theme, StarColor } from './database';

export interface ThemeColors {
  background: {
    start: string;
    end: string;
  };
  stars: string;
  nebula: string;
  text: {
    primary: string;
    secondary: string;
  };
  card: string;
  accent: string;
}

export const themes: Record<Theme, ThemeColors> = {
  night_sky: {
    background: {
      start: '#0A0A2A',
      end: '#1A1A40',
    },
    stars: '#FFFFFF',
    nebula: 'rgba(138, 43, 226, 0.2)',
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
    card: 'rgba(255, 255, 255, 0.1)',
    accent: '#FFD700',
  },
  dawn_sky: {
    background: {
      start: '#1A1A3E',
      end: '#4A4A7E',
    },
    stars: '#FFFFFF',
    nebula: 'rgba(255, 182, 193, 0.3)',
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255, 255, 255, 0.8)',
    },
    card: 'rgba(255, 255, 255, 0.15)',
    accent: '#FFB6C1',
  },
  royal_purple: {
    background: {
      start: '#2A0A3E',
      end: '#4A1A5E',
    },
    stars: '#FFFFFF',
    nebula: 'rgba(186, 85, 211, 0.25)',
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255, 255, 255, 0.75)',
    },
    card: 'rgba(255, 255, 255, 0.12)',
    accent: '#BA55D3',
  },
};

export const starColors: Record<StarColor, string> = {
  gold: '#FFD700',
  silver: '#C0C0C0',
  pink: '#FFB6C1',
};
