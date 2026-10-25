/**
 * ==============================================================================
 * MASTER DESIGN SYSTEM: VIGIL (BITGARD DUAL-THEME ARCHITECTURE)
 * Synchronized directly with the Vigil Tour Management Platform Admin Desktop App.
 *
 * Core Accent: Signature Matte Orange (#E8732A)
 * Day Mode: Alabaster Silk & Titanium Ceramic (#FBF9F5 / #EFECE6 / #E2DDD4)
 * Night Mode: Deep Midnight Obsidian (#040504 / #0D0D0D / #1F1F1F)
 * Telemetry: Emerald (#10B981) for Active/Moving, Amber (#F59E0B) for Idle/Parked, Crimson (#E11D48) for Alerts
 * ==============================================================================
 */

export const colors = {
  // Signature Matte Orange (Matches Admin Desktop App primary tokens)
  primary: {
    50: '#FDF2EC',
    100: '#FBE4D8',
    200: '#F6C4AC',
    300: '#F1A47F',
    400: '#EC8353',
    500: '#E8732A', // Signature Core Accent
    600: '#C75C1D',
    700: '#994716',
    800: '#6E3310',
    900: '#441F0A',
    DEFAULT: '#E8732A',
  },

  // Daylight Ceramic Theme (Alabaster Silk & Titanium)
  day: {
    background: '#FBF9F5',      // Alabaster Silk Ceramic canvas
    foreground: '#1F1D1A',      // Obsidian Graphite typography
    card: '#FFFFFF',            // Crisp frosted surface
    cardBorder: '#E2DDD4',      // Precision milled ceramic hairline
    secondary: '#EFECE6',       // Warm titanium keycap fill
    secondaryForeground: '#262320',
    secondaryBorder: '#DCD5CB', // Hairline keycap border
    muted: '#F3F0EA',           // Recessed telemetry wells
    mutedForeground: '#7B736B', // Supporting labels & timestamps
    input: '#F7F4EE',           // Input surface
    borderSpecular: 'rgba(255, 255, 255, 0.95)',
    accent: '#FDF2EC',          // Matte Orange soft tint
    accentForeground: '#994716',
  },

  // Night Theme (Midnight Obsidian Abyss - High Contrast Telematics)
  night: {
    background: '#040504',      // Deep midnight void
    backgroundAlt: '#0D0D0D',   // Secondary dark void
    foreground: '#FFFFFF',      // Crisp high-contrast titanium white
    card: '#0E131F',            // Distinct card surface lifted from void
    cardBorder: '#222F45',      // Precision milled hairline separation
    secondary: '#161E2E',       // Tactical keycap fill
    secondaryForeground: '#F8FAFC',
    secondaryBorder: '#28354D', // Hairline keycap border
    muted: '#141C2B',           // Recessed wells
    mutedForeground: '#94A3B8', // Crisp readable secondary labels (Slate 400)
    input: '#101623',           // Input surface
    borderSpecular: 'rgba(255, 255, 255, 0.12)',
    accent: '#3A2316',          // Warm obsidian amber tint
    accentForeground: '#EC8353',
  },

  // Telemetry & Hardware Indicators
  telemetry: {
    moving: '#10B981',          // Emerald glow (Active Tour / GPS live)
    movingDark: '#059669',
    movingBg: 'rgba(16, 185, 129, 0.12)',
    movingBorder: '#10B981',
    idle: '#F59E0B',            // Amber glow (Idle / Resting)
    idleDark: '#D97706',
    idleBg: 'rgba(245, 158, 11, 0.12)',
    idleBorder: '#F59E0B',
    alert: '#E11D48',           // Crimson alert (Breakdown / SOS)
    alertBg: 'rgba(225, 29, 72, 0.12)',
    alertBorder: '#E11D48',
  },

  // Vehicle Number Plate Styling (Tactile high-contrast metal plate)
  plate: {
    bg: '#141516',
    border: '#2E3035',
    text: '#F8FAFC',
    accent: '#E8732A',
  },
} as const;

export const themeStyles = {
  // Screen Canvas (Alabaster Silk)
  screenContainer: {
    flex: 1,
    backgroundColor: colors.day.background,
  },

  // Tactical Header Bar
  headerBar: {
    backgroundColor: colors.day.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.day.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Standard Tactical Card
  card: {
    backgroundColor: colors.day.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.day.cardBorder,
    shadowColor: colors.day.foreground,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },

  // Signature Matte Orange Primary Button
  btnPrimary: {
    backgroundColor: colors.primary[500],
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '900' as const,
    fontSize: 15,
    letterSpacing: 0.6,
  },

  // Tactile Keycap Secondary Button (Daylight Titanium Ceramic)
  btnSecondary: {
    backgroundColor: colors.day.secondary,
    borderWidth: 1,
    borderColor: colors.day.secondaryBorder,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  btnSecondaryText: {
    color: colors.day.foreground,
    fontWeight: '800' as const,
    fontSize: 13,
  },

  // Input Field
  input: {
    backgroundColor: colors.day.input,
    borderWidth: 1.5,
    borderColor: colors.day.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.day.foreground,
  },

  // High-Contrast Vehicle License Plate Badge
  vehiclePlate: {
    backgroundColor: colors.plate.bg,
    borderWidth: 1,
    borderColor: colors.plate.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  vehiclePlateText: {
    color: colors.plate.text,
    fontSize: 13,
    fontWeight: '900' as const,
    letterSpacing: 1.5,
    fontFamily: 'monospace',
  },

  // Telemetry Badge (Active / Radar)
  telemetryBadgeMoving: {
    backgroundColor: colors.telemetry.movingBg,
    borderWidth: 1,
    borderColor: colors.telemetry.movingBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  telemetryBadgeMovingText: {
    color: colors.telemetry.movingDark,
    fontSize: 11,
    fontWeight: '900' as const,
    letterSpacing: 0.8,
  },

  // Brand Badge (VIGIL DRIVER in Signature Matte Orange)
  brandBadge: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  brandBadgeText: {
    color: colors.primary[600],
    fontSize: 10,
    fontWeight: '900' as const,
    letterSpacing: 0.8,
  },
} as const;

export default {
  colors,
  themeStyles,
};
