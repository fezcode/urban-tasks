/**
 * Theme tokens mirrored 1:1 from the web app (frontend/src/index.css).
 * Keep both in sync when adjusting palette.
 */

export type ThemeMode = 'light' | 'dark';

export interface Palette {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  surface: string;
  surfaceHover: string;
  surfaceRaised: string;
  border: string;
  borderLight: string;
  borderFocus: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  accent: string;
  accentHover: string;
  accentLight: string;
  accentMuted: string;
  statusActive: string;
  statusActiveBg: string;
  statusWarning: string;
  statusWarningBg: string;
  danger: string;
  dangerBg: string;
}

const rgb = (r: number, g: number, b: number) => `rgb(${r}, ${g}, ${b})`;

export const lightPalette: Palette = {
  bg: rgb(250, 249, 246),
  bgSecondary: rgb(243, 240, 234),
  bgTertiary: rgb(235, 231, 223),
  surface: rgb(255, 255, 255),
  surfaceHover: rgb(247, 245, 240),
  surfaceRaised: rgb(255, 255, 255),
  border: rgb(229, 224, 216),
  borderLight: rgb(237, 233, 227),
  borderFocus: rgb(201, 100, 66),
  textPrimary: rgb(26, 26, 26),
  textSecondary: rgb(111, 105, 98),
  textTertiary: rgb(156, 149, 141),
  textInverse: rgb(255, 255, 255),
  accent: rgb(201, 100, 66),
  accentHover: rgb(181, 88, 56),
  accentLight: rgb(245, 230, 224),
  accentMuted: rgb(232, 213, 204),
  statusActive: rgb(91, 138, 114),
  statusActiveBg: rgb(232, 242, 237),
  statusWarning: rgb(201, 160, 66),
  statusWarningBg: rgb(245, 240, 224),
  danger: rgb(220, 70, 70),
  dangerBg: rgb(254, 242, 242),
};

export const darkPalette: Palette = {
  bg: rgb(23, 23, 23),
  bgSecondary: rgb(30, 30, 30),
  bgTertiary: rgb(40, 40, 40),
  surface: rgb(38, 38, 38),
  surfaceHover: rgb(45, 45, 45),
  surfaceRaised: rgb(48, 48, 48),
  border: rgb(55, 55, 55),
  borderLight: rgb(48, 48, 48),
  borderFocus: rgb(210, 120, 86),
  textPrimary: rgb(237, 234, 230),
  textSecondary: rgb(160, 155, 148),
  textTertiary: rgb(115, 110, 104),
  textInverse: rgb(23, 23, 23),
  accent: rgb(210, 120, 86),
  accentHover: rgb(225, 140, 105),
  accentLight: rgb(50, 35, 28),
  accentMuted: rgb(60, 42, 35),
  statusActive: rgb(110, 168, 140),
  statusActiveBg: rgb(30, 48, 40),
  statusWarning: rgb(210, 175, 90),
  statusWarningBg: rgb(48, 42, 28),
  danger: rgb(240, 100, 100),
  dangerBg: rgb(50, 30, 30),
};

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
};

export const typography = {
  displayFamily: 'Fraunces_400Regular',
  displayFamilySemi: 'Fraunces_600SemiBold',
  sansFamily: 'Inter_400Regular',
  sansFamilyMedium: 'Inter_500Medium',
  sansFamilySemi: 'Inter_600SemiBold',
};
