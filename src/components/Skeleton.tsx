import React, { createContext, useContext, useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, StyleProp, ViewStyle, DimensionValue } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme';

// ==============================================================================
// 1. SHARED SKELETON PULSE PROVIDER (Synchronized 60FPS UI-Thread Shimmer)
// ==============================================================================

const SkeletonPulseContext = createContext<Animated.Value | null>(null);

export const SkeletonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <SkeletonPulseContext.Provider value={pulseAnim}>
      {children}
    </SkeletonPulseContext.Provider>
  );
};

// ==============================================================================
// 2. ATOMIC SKELETON ITEM
// ==============================================================================

export interface SkeletonItemProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  baseColor?: string;
  highlightColor?: string;
}

export const SkeletonItem: React.FC<SkeletonItemProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
  baseColor,
  highlightColor,
}) => {
  const { isDark } = useTheme();
  const contextPulse = useContext(SkeletonPulseContext);

  // Standalone fallback if outside SkeletonProvider
  const fallbackPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (contextPulse) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(fallbackPulse, {
          toValue: 1,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fallbackPulse, {
          toValue: 0,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [contextPulse, fallbackPulse]);

  const activePulse = contextPulse || fallbackPulse;

  const resolvedBase = baseColor || (isDark ? '#141C2B' : '#E8E4DC');
  const resolvedHighlight = highlightColor || (isDark ? '#243249' : '#F8F6F2');

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: resolvedBase,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: resolvedHighlight,
            opacity: activePulse,
          },
        ]}
      />
    </View>
  );
};

// ==============================================================================
// 3. DASHBOARD SKELETON (Tours list & status feed placeholders)
// ==============================================================================

export const DashboardSkeleton: React.FC<{ includeDriverHeader?: boolean }> = ({ includeDriverHeader = false }) => {
  const { isDark, colors: themeColors } = useTheme();

  return (
    <SkeletonProvider>
      <View style={{ width: '100%' }}>
        {/* Optional Driver Profile Header Skeleton */}
        {includeDriverHeader && (
          <View
            style={{
              backgroundColor: themeColors.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: themeColors.cardBorder,
              padding: 14,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <SkeletonItem width={48} height={48} borderRadius={24} style={{ marginRight: 12 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonItem width={120} height={10} borderRadius={5} />
                <SkeletonItem width={180} height={16} borderRadius={8} />
                <SkeletonItem width={140} height={10} borderRadius={5} />
              </View>
            </View>
            <SkeletonItem width={50} height={28} borderRadius={8} />
          </View>
        )}

        {/* Tour Card 1: Active Ongoing Tour Simulation */}
        <View
          style={{
            backgroundColor: isDark ? '#0D0D0D' : themeColors.card,
            borderRadius: 22,
            borderWidth: 1.5,
            borderColor: isDark ? 'rgba(232, 115, 42, 0.4)' : colors.primary[300],
            padding: 18,
            marginBottom: 16,
          }}
        >
          {/* Top Row: Badge & License Plate */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <SkeletonItem width={150} height={24} borderRadius={12} />
            <SkeletonItem width={90} height={24} borderRadius={6} />
          </View>

          {/* Customer Name */}
          <SkeletonItem width={220} height={22} borderRadius={10} style={{ marginBottom: 10 }} />

          {/* Destination */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
            <SkeletonItem width={16} height={16} borderRadius={8} />
            <SkeletonItem width="70%" height={14} borderRadius={7} />
          </View>

          {/* Dates */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
            <SkeletonItem width={16} height={16} borderRadius={8} />
            <SkeletonItem width="50%" height={12} borderRadius={6} />
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SkeletonItem width="60%" height={42} borderRadius={12} />
            <SkeletonItem width="36%" height={42} borderRadius={12} />
          </View>
        </View>

        {/* Tour Card 2: Confirmed Upcoming Tour Simulation */}
        <View
          style={{
            backgroundColor: themeColors.card,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: themeColors.cardBorder,
            padding: 16,
            marginBottom: 14,
          }}
        >
          {/* Top Row: Customer Name & Status Capsule */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <SkeletonItem width={180} height={18} borderRadius={9} />
            <SkeletonItem width={80} height={20} borderRadius={6} />
          </View>

          {/* Location info */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
            <SkeletonItem width={16} height={16} borderRadius={8} />
            <SkeletonItem width="65%" height={13} borderRadius={6} />
          </View>

          {/* Vehicle and Passenger pills */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <SkeletonItem width={100} height={22} borderRadius={8} />
            <SkeletonItem width={80} height={22} borderRadius={8} />
          </View>

          {/* Action button */}
          <SkeletonItem width="100%" height={38} borderRadius={12} />
        </View>

        {/* Tour Card 3: Additional Upcoming Tour Simulation */}
        <View
          style={{
            backgroundColor: themeColors.card,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: themeColors.cardBorder,
            padding: 16,
            marginBottom: 14,
            opacity: 0.7,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <SkeletonItem width={160} height={18} borderRadius={9} />
            <SkeletonItem width={75} height={20} borderRadius={6} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }}>
            <SkeletonItem width={16} height={16} borderRadius={8} />
            <SkeletonItem width="60%" height={13} borderRadius={6} />
          </View>
          <SkeletonItem width="100%" height={38} borderRadius={12} />
        </View>
      </View>
    </SkeletonProvider>
  );
};

// ==============================================================================
// 4. ACTIVE TOUR SKELETON (Telematics radar, itinerary & passenger card)
// ==============================================================================

export const ActiveTourSkeleton: React.FC = () => {
  const { colors: themeColors } = useTheme();

  return (
    <SkeletonProvider>
      <View style={{ flex: 1, padding: 16, gap: 14 }}>
        {/* Top Radar Hero Card */}
        <View
          style={{
            backgroundColor: themeColors.card,
            borderRadius: 22,
            borderWidth: 1.5,
            borderColor: themeColors.cardBorder,
            padding: 18,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <SkeletonItem width={140} height={24} borderRadius={12} />
            <SkeletonItem width={95} height={24} borderRadius={6} />
          </View>
          <SkeletonItem width={230} height={24} borderRadius={10} style={{ marginBottom: 10 }} />
          <SkeletonItem width={150} height={14} borderRadius={7} style={{ marginBottom: 14 }} />

          {/* Speed & GPS Telematics Wells */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SkeletonItem width="48%" height={54} borderRadius={12} />
            <SkeletonItem width="48%" height={54} borderRadius={12} />
          </View>
        </View>

        {/* Route & Itinerary Card */}
        <View
          style={{
            backgroundColor: themeColors.card,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: themeColors.cardBorder,
            padding: 16,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <SkeletonItem width={130} height={16} borderRadius={8} />
            <SkeletonItem width={70} height={14} borderRadius={7} />
          </View>

          {/* Stop 1 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <SkeletonItem width={14} height={14} borderRadius={7} />
            <View style={{ flex: 1, gap: 4 }}>
              <SkeletonItem width={110} height={11} borderRadius={5} />
              <SkeletonItem width="80%" height={15} borderRadius={7} />
            </View>
          </View>

          {/* Stop 2 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <SkeletonItem width={14} height={14} borderRadius={7} />
            <View style={{ flex: 1, gap: 4 }}>
              <SkeletonItem width={90} height={11} borderRadius={5} />
              <SkeletonItem width="65%" height={15} borderRadius={7} />
            </View>
          </View>

          {/* Destination */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <SkeletonItem width={14} height={14} borderRadius={7} />
            <View style={{ flex: 1, gap: 4 }}>
              <SkeletonItem width={120} height={11} borderRadius={5} />
              <SkeletonItem width="85%" height={15} borderRadius={7} />
            </View>
          </View>
        </View>

        {/* Guest & Contact Card */}
        <View
          style={{
            backgroundColor: themeColors.card,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: themeColors.cardBorder,
            padding: 16,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: 6 }}>
              <SkeletonItem width={100} height={11} borderRadius={5} />
              <SkeletonItem width={170} height={17} borderRadius={8} />
            </View>
            <SkeletonItem width={80} height={34} borderRadius={10} />
          </View>
        </View>

        {/* Bottom CTA Action Button */}
        <SkeletonItem width="100%" height={50} borderRadius={14} style={{ marginTop: 6 }} />
      </View>
    </SkeletonProvider>
  );
};

// ==============================================================================
// 5. CALENDAR SKELETON (Month grid, headers & schedule cards)
// ==============================================================================

export const CalendarSkeleton: React.FC = () => {
  const { colors: themeColors } = useTheme();

  return (
    <SkeletonProvider>
      <View style={{ width: '100%', gap: 14 }}>
        {/* Calendar Card */}
        <View
          style={{
            backgroundColor: themeColors.card,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: themeColors.cardBorder,
            padding: 16,
          }}
        >
          {/* Header Row: Month Name & Arrows */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingHorizontal: 6 }}>
            <SkeletonItem width={130} height={20} borderRadius={10} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <SkeletonItem width={24} height={24} borderRadius={12} />
              <SkeletonItem width={24} height={24} borderRadius={12} />
            </View>
          </View>

          {/* Days of Week Row (7 columns) */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <SkeletonItem key={i} width={34} height={12} borderRadius={6} />
            ))}
          </View>

          {/* Calendar Month Grid (5 rows of 7 day cells) */}
          <View style={{ gap: 10 }}>
            {[1, 2, 3, 4, 5].map((row) => (
              <View key={row} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                  <SkeletonItem
                    key={col}
                    width={34}
                    height={34}
                    borderRadius={10}
                    style={{ opacity: (row === 1 && col < 3) || (row === 5 && col > 5) ? 0.3 : 1 }}
                  />
                ))}
              </View>
            ))}
          </View>

          {/* Bottom Legend Row */}
          <View
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: themeColors.cardBorder,
              flexDirection: 'row',
              justifyContent: 'space-around',
            }}
          >
            <SkeletonItem width={70} height={14} borderRadius={7} />
            <SkeletonItem width={80} height={14} borderRadius={7} />
            <SkeletonItem width={75} height={14} borderRadius={7} />
          </View>
        </View>

        {/* Scheduled Tour Preview Cards */}
        <View
          style={{
            backgroundColor: themeColors.card,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: themeColors.cardBorder,
            padding: 14,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <SkeletonItem width={140} height={15} borderRadius={7} />
            <SkeletonItem width={70} height={18} borderRadius={6} />
          </View>
          <SkeletonItem width="80%" height={12} borderRadius={6} />
        </View>
      </View>
    </SkeletonProvider>
  );
};

// ==============================================================================
// 6. PROFILE SKELETON (Identity Hero, Telematics stats, Settings rows)
// ==============================================================================

export const ProfileSkeleton: React.FC = () => {
  const { colors: themeColors } = useTheme();

  return (
    <SkeletonProvider>
      <View style={{ width: '100%', gap: 14 }}>
        {/* Identity Hero Card */}
        <View
          style={{
            backgroundColor: themeColors.card,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: themeColors.cardBorder,
            padding: 18,
            alignItems: 'center',
          }}
        >
          <SkeletonItem width={80} height={80} borderRadius={40} style={{ marginBottom: 12 }} />
          <SkeletonItem width={180} height={20} borderRadius={10} style={{ marginBottom: 8 }} />
          <SkeletonItem width={120} height={14} borderRadius={7} style={{ marginBottom: 14 }} />

          {/* Tags */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <SkeletonItem width={90} height={22} borderRadius={8} />
            <SkeletonItem width={100} height={22} borderRadius={8} />
          </View>
        </View>

        {/* Quick Stats Row (3 Columns) */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: themeColors.card, borderRadius: 16, borderWidth: 1, borderColor: themeColors.cardBorder, padding: 12, alignItems: 'center', gap: 6 }}>
            <SkeletonItem width={40} height={18} borderRadius={9} />
            <SkeletonItem width={50} height={10} borderRadius={5} />
          </View>
          <View style={{ flex: 1, backgroundColor: themeColors.card, borderRadius: 16, borderWidth: 1, borderColor: themeColors.cardBorder, padding: 12, alignItems: 'center', gap: 6 }}>
            <SkeletonItem width={40} height={18} borderRadius={9} />
            <SkeletonItem width={50} height={10} borderRadius={5} />
          </View>
          <View style={{ flex: 1, backgroundColor: themeColors.card, borderRadius: 16, borderWidth: 1, borderColor: themeColors.cardBorder, padding: 12, alignItems: 'center', gap: 6 }}>
            <SkeletonItem width={40} height={18} borderRadius={9} />
            <SkeletonItem width={50} height={10} borderRadius={5} />
          </View>
        </View>

        {/* Personal Details Form Section */}
        <View
          style={{
            backgroundColor: themeColors.card,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: themeColors.cardBorder,
            padding: 16,
            gap: 12,
          }}
        >
          <SkeletonItem width={130} height={14} borderRadius={7} style={{ marginBottom: 4 }} />
          
          <View style={{ gap: 6 }}>
            <SkeletonItem width={80} height={11} borderRadius={5} />
            <SkeletonItem width="100%" height={40} borderRadius={10} />
          </View>

          <View style={{ gap: 6 }}>
            <SkeletonItem width={100} height={11} borderRadius={5} />
            <SkeletonItem width="100%" height={40} borderRadius={10} />
          </View>

          <View style={{ gap: 6 }}>
            <SkeletonItem width={70} height={11} borderRadius={5} />
            <SkeletonItem width="100%" height={40} borderRadius={10} />
          </View>
        </View>
      </View>
    </SkeletonProvider>
  );
};
