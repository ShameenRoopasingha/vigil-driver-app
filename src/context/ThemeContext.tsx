import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'dark' | 'light';

export interface ThemeColors {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceElevated: string;
  card: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  primaryGlow: string;
  accent: string;
  accentGlow: string;
  danger: string;
  warning: string;
  success: string;
  // Arc Navbar specific tokens
  navBackground: string;
  navBorder: string;
  navConcentricOuter: string;
  navConcentricInner: string;
  squircleBg: string;
  squircleBorder: string;
  squircleFocusedBg: string;
  squircleFocusedBorder: string;
  detailCardBg: string;
  detailCardBorder: string;
  modalOverlay: string;
  modalBg: string;
  modalBorder: string;
  triggerBg: string;
  triggerBorder: string;
  dialBarColor: string;
}

const darkColors: ThemeColors = {
  isDark: true,
  background: '#040504',
  surface: '#0D0D0D',
  surfaceElevated: '#161E2E',
  card: '#0E131F',
  cardBorder: '#222F45',
  textPrimary: '#FFFFFF',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  primary: '#E8732A',
  primaryLight: '#FDF2EC',
  primaryGlow: 'rgba(232, 115, 42, 0.35)',
  accent: '#10B981',
  accentGlow: 'rgba(16, 185, 129, 0.25)',
  danger: '#E11D48',
  warning: '#F59E0B',
  success: '#10B981',
  // Arc Navbar Tokens (Obsidian Cockpit Night Mode)
  navBackground: '#0E131F',
  navBorder: 'rgba(232, 115, 42, 0.55)',
  navConcentricOuter: 'rgba(232, 115, 42, 0.35)',
  navConcentricInner: 'rgba(255, 255, 255, 0.12)',
  squircleBg: '#161E2E',
  squircleBorder: '#28354D',
  squircleFocusedBg: '#E8732A',
  squircleFocusedBorder: '#EC8353',
  detailCardBg: '#0E131F',
  detailCardBorder: 'rgba(232, 115, 42, 0.5)',
  modalOverlay: 'rgba(0, 0, 0, 0.85)',
  modalBg: '#111827',
  modalBorder: '#28354D',
  triggerBg: '#111827',
  triggerBorder: '#28354D',
  dialBarColor: '#E8732A',
};

const lightColors: ThemeColors = {
  isDark: false,
  background: '#FBF9F5',
  surface: '#FFFFFF',
  surfaceElevated: '#EFECE6',
  card: '#FFFFFF',
  cardBorder: '#E2DDD4',
  textPrimary: '#1F1D1A',
  textSecondary: '#475569',
  textMuted: '#7B736B',
  primary: '#E8732A',
  primaryLight: '#FDF2EC',
  primaryGlow: 'rgba(232, 115, 42, 0.25)',
  accent: '#10B981',
  accentGlow: 'rgba(16, 185, 129, 0.2)',
  danger: '#E11D48',
  warning: '#F59E0B',
  success: '#10B981',
  // Arc Navbar Tokens (Alabaster Ceramic Day Mode)
  navBackground: '#FFFFFF',
  navBorder: '#E8732A',
  navConcentricOuter: 'rgba(232, 115, 42, 0.35)',
  navConcentricInner: '#E2DDD4',
  squircleBg: '#FFFFFF',
  squircleBorder: '#E2DDD4',
  squircleFocusedBg: '#E8732A',
  squircleFocusedBorder: '#C75C1D',
  detailCardBg: '#FFFFFF',
  detailCardBorder: '#E8732A',
  modalOverlay: 'rgba(4, 5, 4, 0.6)',
  modalBg: '#FFFFFF',
  modalBorder: '#E2DDD4',
  triggerBg: '#FFFFFF',
  triggerBorder: '#E2DDD4',
  dialBarColor: '#E8732A',
};

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = 'vigil_app_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setThemeState(saved);
      } else {
        setThemeState('dark');
      }
    });
  }, [systemScheme]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  const isDark = theme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
