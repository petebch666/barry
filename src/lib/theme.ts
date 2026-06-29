import { Platform } from 'react-native';

export const colors = {
  bg: '#000000',
  surface: 'rgba(255,255,255,0.06)',
  surfaceHigh: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.10)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.55)',
  textTertiary: 'rgba(255,255,255,0.28)',
  accent: '#7C3AED',
  accentSoft: 'rgba(124,58,237,0.25)',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
} as const;

export const radii = { sm: 12, md: 18, lg: 24, pill: 100 } as const;

export const font = { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, xxl: 36 } as const;

// Vertical space content must clear above the floating tab bar (tab bar height + margin + max safe area)
export const BOTTOM_TAB_PADDING = 120;

// Height of the barry header bar at the top of every screen (includes status-bar safe area on native)
export const BARRY_HEADER_HEIGHT = Platform.select({ ios: 104, android: 80, default: 64 }) as number;
