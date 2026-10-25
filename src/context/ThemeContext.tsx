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
  surface: '#0a0f1d',
  surfaceElevated: '#111827',
  card: '#0c1220',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  primary: '#E8732A',
  primaryLight: '#f97316',
  primaryGlow: 'rgba(232, 115, 42, 0.25)',
  accent: '#10b981',
  accentGlow: 'rgba(16, 185, 129, 0.25)',
  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
  // Arc Navbar Tokens (Obsidian Cockpit Night Mode)
  navBackground: '#070b14',
  navBorder: 'rgba(16, 185, 129, 0.45)',
  navConcentricOuter: 'rgba(16, 185, 129, 0.35)',
  navConcentricInner: 'rgba(255, 255, 255, 0.08)',
  squircleBg: '#0f172a',
  squircleBorder: 'rgba(255, 255, 255, 0.12)',
  squircleFocusedBg: '#1e293b',
  squircleFocusedBorder: '#10b981',
  detailCardBg: '#0a0f1d',
  detailCardBorder: 'rgba(16, 185, 129, 0.4)',
  modalOverlay: 'rgba(0, 0, 0, 0.8)',
  modalBg: '#090d16',
  modalBorder: 'rgba(255, 255, 255, 0.12)',
  triggerBg: '#090d16',
  triggerBorder: 'rgba(16, 185, 129, 0.45)',
  dialBarColor: '#34d399',
};

const lightColors: ThemeColors = {
  isDark: false,
  background: '#FBF9F5',
  surface: '#ffffff',
  surfaceElevated: '#f1f5f9',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  primary: '#E8732A',
  primaryLight: '#ea580c',
  primaryGlow: 'rgba(232, 115, 42, 0.2)',
  accent: '#059669',
  accentGlow: 'rgba(5, 150, 105, 0.2)',
  danger: '#dc2626',
  warning: '#d97706',
  success: '#059669',
  // Arc Navbar Tokens (Alabaster Ceramic Day Mode)
  navBackground: '#ffffff',
  navBorder: 'rgba(16, 185, 129, 0.5)',
  navConcentricOuter: 'rgba(16, 185, 129, 0.35)',
  navConcentricInner: 'rgba(226, 232, 240, 0.9)',
  squircleBg: '#ffffff',
  squircleBorder: '#e2e8f0',
  squircleFocusedBg: '#ecfdf5',
  squircleFocusedBorder: '#10b981',
  detailCardBg: '#ffffff',
  detailCardBorder: '#e2e8f0',
  modalOverlay: 'rgba(15, 23, 42, 0.6)',
  modalBg: '#ffffff',
  modalBorder: '#e2e8f0',
  triggerBg: '#ffffff',
  triggerBorder: '#e2e8f0',
  dialBarColor: '#059669',
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
      } else if (systemScheme === 'light') {
        setThemeState('light');
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
