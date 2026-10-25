import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Image, Linking, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { locationService } from '../services/locationService';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, themeStyles } from '../theme';
import { useTheme } from '../context/ThemeContext';

type DashboardNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

interface HandoverDetails {
  isHandover?: boolean;
  needsTakeover?: boolean;
  previousDriverName?: string | null;
  meterReading?: string | null;
  reason?: string | null;
  location?: string;
  instructions?: string | null;
  coordinates?: { lat: number; lon: number } | null;
  googleMapsUrl?: string | null;
  wazeUrl?: string | null;
}

interface Tour {
  id: string;
  customerName: string;
  vehicleNo: string;
  startDate: string;
  endDate: string | null;
  destination: string | null;
  status: string;
  needsTakeover?: boolean;
  handoverDetails?: HandoverDetails | null;
}

interface DriverProfile {
  id?: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
  companyName?: string;
  companyLogoUrl?: string | null;
  companyPhone?: string | null;
}

let hasShownWelcomeThisSession = false;

export default function DashboardScreen({ navigation: propNavigation }: { navigation?: DashboardNavigationProp }) {
  const { isDark, colors: themeColors } = useTheme();
  const [driverData, setDriverData] = useState<DriverProfile>({});
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(false);
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  const hookNavigation = useNavigation<DashboardNavigationProp>();
  const navigation = propNavigation || hookNavigation;

  const loadData = async () => {
    try {
      const driverStr = await AsyncStorage.getItem('driverData');
      if (driverStr) {
        try {
          const parsed = JSON.parse(driverStr);
          setDriverData(parsed);
        } catch {}
      }

      const response = await apiClient.get('/driver/tours');
      if (response.data?.success) {
        setTours(response.data.data);
        setSyncError(null);

        // Update driver profile if returned by API
        if (response.data.driver) {
          setDriverData(response.data.driver);
          await AsyncStorage.setItem('driverData', JSON.stringify(response.data.driver));
        }

        // Auto-resume live location tracking if an ongoing tour exists
        const ongoing = response.data.data.find((t: Tour) => t.status === 'ONGOING');
        if (ongoing) {
          if (!locationService.isTripTrackingActive() || locationService.getActiveBookingId() !== ongoing.id) {
            locationService.startTripTracking(ongoing.id);
          }
        } else if (locationService.isTripTrackingActive()) {
          locationService.stopTripTracking();
        }
      }
    } catch (error: any) {
      console.error('[Dashboard] Error fetching tours:', error);
      setSyncError(
        error?.friendlyMessage || 
        error?.response?.data?.error || 
        'Could not sync tours with office. Please check your mobile signal.'
      );
    } finally {
      setLoading(false);
      if (!hasShownWelcomeThisSession) {
        hasShownWelcomeThisSession = true;
        setShowWelcomeIntro(true);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();

      // Periodically poll every 20 seconds so newly assigned tours sync automatically
      const pollInterval = setInterval(() => {
        loadData();
      }, 20000);

      return () => {
        clearInterval(pollInterval);
      };
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);



  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const renderTour = ({ item }: { item: Tour }) => {
    const isOngoing = item.status === 'ONGOING';

    if (isOngoing) {
      // Signature Admin Desktop App Active Tour Card (Matte Orange & Obsidian Telematics)
      return (
        <View
          key={item.id}
          style={{
            backgroundColor: '#0D0D0D',
            borderRadius: 22,
            borderWidth: 1.5,
            borderColor: colors.primary[500],
            padding: 18,
            marginBottom: 16,
            shadowColor: colors.primary[500],
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          {/* Header Row: Live Radar Badge & Vehicle Plate */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderWidth: 1,
                borderColor: colors.telemetry.moving,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 20,
              }}
            >
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.telemetry.moving, marginRight: 6 }} />
              <Text style={{ color: colors.telemetry.moving, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }}>
                ACTIVE TOUR • LIVE RADAR
              </Text>
            </View>

            {/* Tactical Vehicle Plate */}
            <View style={themeStyles.vehiclePlate}>
              <Text style={themeStyles.vehiclePlateText}>
                {item.vehicleNo}
              </Text>
            </View>
          </View>

          {/* Customer Name */}
          <Text style={{ color: '#FFFFFF', fontSize: 19, fontWeight: '900', marginBottom: 6, letterSpacing: 0.3 }}>
            {item.customerName}
          </Text>

          {/* Destination */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 13, marginRight: 6 }}>📍</Text>
            <Text style={{ color: '#CBD5E1', fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
              {item.destination || 'Destination not specified'}
            </Text>
          </View>

          {/* Dates */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 13, marginRight: 6 }}>📅</Text>
            <Text style={{ color: colors.night.mutedForeground, fontSize: 12, fontWeight: '500' }}>
              Started {new Date(item.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {item.endDate ? ` → ${new Date(item.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ' → Ongoing'}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={{
                flex: 1.4,
                backgroundColor: colors.primary[500],
                borderRadius: 14,
                paddingVertical: 13,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: colors.primary[500],
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.45,
                shadowRadius: 8,
                elevation: 5,
              }}
              onPress={() => navigation.navigate('ActiveTour', { bookingId: item.id })}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '900', letterSpacing: 0.5 }}>
                ⚡ View Live Tour & GPS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.18)',
                borderRadius: 14,
                paddingVertical: 13,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => navigation.navigate('AddExpense', { bookingId: item.id, vehicleNo: item.vehicleNo })}
            >
              <Text style={{ color: '#F8FAFC', fontSize: 12.5, fontWeight: '800' }}>
                + Add Expense
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Standard Tour Card (Theme aware: Alabaster Ceramic in Day, Obsidian Abyss in Night)
    return (
      <View
        key={item.id}
        style={{
          backgroundColor: themeColors.card,
          borderRadius: 20,
          borderWidth: item.needsTakeover ? 2 : 1,
          borderColor: item.needsTakeover ? colors.telemetry.idle : themeColors.cardBorder,
          padding: 16,
          marginBottom: 14,
          shadowColor: isDark ? '#000000' : colors.day.foreground,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 16.5, fontWeight: '900', color: themeColors.textPrimary }}>{item.customerName}</Text>
          <View
            style={{
              backgroundColor: item.needsTakeover
                ? colors.telemetry.idleBg
                : item.status === 'CONFIRMED'
                ? (isDark ? 'rgba(232, 115, 42, 0.18)' : colors.primary[50])
                : (isDark ? '#1e293b' : colors.day.secondary),
              borderColor: item.needsTakeover
                ? colors.telemetry.idleBorder
                : item.status === 'CONFIRMED'
                ? colors.primary[400]
                : (isDark ? 'rgba(255, 255, 255, 0.12)' : colors.day.secondaryBorder),
              borderWidth: 1,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '900',
                letterSpacing: 0.5,
                color: item.needsTakeover
                  ? colors.telemetry.idleDark
                  : item.status === 'CONFIRMED'
                  ? colors.primary[500]
                  : themeColors.textMuted,
              }}
            >
              {item.needsTakeover ? '⚡ TAKEOVER' : item.status}
            </Text>
          </View>
        </View>

        {/* Mid-Tour Handover Notification & Direct Navigation Card */}
        {item.needsTakeover && item.handoverDetails && (
          <View style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB', borderWidth: 1, borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#FDE68A', borderRadius: 14, padding: 12, marginVertical: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.telemetry.idle, marginRight: 6 }} />
                <Text style={{ color: isDark ? '#FDE68A' : '#92400E', fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>
                  Mid-Tour Handover Assigned
                </Text>
              </View>
              <View style={{ backgroundColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#FDE68A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: isDark ? '#FDE68A' : '#78350F', fontSize: 9, fontWeight: '800' }}>ACTION REQUIRED</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
              <Text style={{ color: isDark ? '#FDE68A' : '#92400E', fontSize: 11, fontWeight: '700', width: 75 }}>📍 Location:</Text>
              <Text style={{ color: themeColors.textPrimary, fontSize: 11, fontWeight: '600', flex: 1 }} numberOfLines={2}>
                {item.handoverDetails.location || 'Vehicle Handover Point'}
              </Text>
            </View>

            {item.handoverDetails.previousDriverName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ color: isDark ? '#FDE68A' : '#92400E', fontSize: 11, fontWeight: '700', width: 75 }}>👤 Driver:</Text>
                <Text style={{ color: themeColors.textSecondary, fontSize: 11, fontWeight: '500', flex: 1 }}>
                  From {item.handoverDetails.previousDriverName} {item.handoverDetails.reason ? `(${item.handoverDetails.reason})` : ''}
                </Text>
              </View>
            ) : null}

            {item.handoverDetails.meterReading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ color: isDark ? '#FDE68A' : '#92400E', fontSize: 11, fontWeight: '700', width: 75 }}>🚗 Odometer:</Text>
                <Text style={{ color: themeColors.textPrimary, fontSize: 11, fontWeight: '700', fontFamily: 'monospace', flex: 1 }}>
                  {item.handoverDetails.meterReading} km
                </Text>
              </View>
            ) : null}

            {item.handoverDetails.googleMapsUrl ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  Linking.openURL(item.handoverDetails!.googleMapsUrl!);
                }}
                style={{ backgroundColor: colors.telemetry.idleDark, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11 }}>
                  🗺️ Navigate to Handover (Google Maps)
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        
        {/* Vehicle Plate Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12, width: 85, fontWeight: '600' }}>Vehicle:</Text>
          <View style={{ backgroundColor: colors.plate.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
            <Text style={{ color: colors.plate.text, fontSize: 11.5, fontWeight: '800', fontFamily: 'monospace', letterSpacing: 1 }}>
              {item.vehicleNo}
            </Text>
          </View>
        </View>
        
        {/* Destination */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12, width: 85, fontWeight: '600' }}>Destination:</Text>
          <Text style={{ color: themeColors.textPrimary, fontSize: 12.5, fontWeight: '600', flex: 1 }} numberOfLines={1}>
            {item.destination || 'Not specified'}
          </Text>
        </View>

        {/* Dates */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12, width: 85, fontWeight: '600' }}>Tour Date:</Text>
          <Text style={{ color: themeColors.textPrimary, fontSize: 12, fontWeight: '600' }}>
            {new Date(item.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: themeColors.cardBorder, gap: 8 }}>
          <TouchableOpacity 
            activeOpacity={0.85}
            style={{
              backgroundColor: item.needsTakeover ? colors.telemetry.idleDark : colors.primary[500],
              flex: 1.2,
              paddingVertical: 11,
              borderRadius: 12,
              alignItems: 'center',
              shadowColor: item.needsTakeover ? colors.telemetry.idleDark : colors.primary[500],
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 2,
            }}
            onPress={() => navigation.navigate('ActiveTour', { bookingId: item.id })}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 12.5, letterSpacing: 0.3 }}>
              {item.needsTakeover ? '⚡ Take Over Tour' : 'Start / View Tour'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.8}
            style={{
              backgroundColor: isDark ? '#1e293b' : colors.day.secondary,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : colors.day.secondaryBorder,
              flex: 0.9,
              paddingVertical: 11,
              borderRadius: 12,
              alignItems: 'center',
            }}
            onPress={() => navigation.navigate('AddExpense', { bookingId: item.id, vehicleNo: item.vehicleNo })}
          >
            <Text style={{ color: themeColors.textPrimary, fontWeight: '800', fontSize: 12 }}>+ Expense</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      {/* Top Branding & Action Bar (Day/Night Theme aware) */}
      <View
        style={{
          backgroundColor: themeColors.card,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.cardBorder,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* VIGIL Platform Brand */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ 
            width: 40, 
            height: 40, 
            backgroundColor: themeColors.surfaceElevated, 
            borderRadius: 12, 
            borderWidth: 1.5, 
            borderColor: themeColors.cardBorder, 
            justifyContent: 'center', 
            alignItems: 'center',
            shadowColor: isDark ? '#000000' : colors.day.foreground,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 3,
            elevation: 2,
            marginRight: 10
          }}>
            <Image 
              source={require('../../assets/logo-icon.png')} 
              style={{ width: 28, height: 28 }} 
              resizeMode="contain" 
            />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: themeColors.textPrimary, letterSpacing: 1.5 }}>
                VIGIL
              </Text>
              <View style={themeStyles.brandBadge}>
                <Text style={themeStyles.brandBadgeText}>
                  DRIVER
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 10.5, color: themeColors.textMuted, fontWeight: '600', marginTop: 1 }}>
              Fleet Operations & Telematics
            </Text>
          </View>
        </View>

        {/* Empty Spacer reserved for Top-Right Arc Nav Dial Button */}
        <View style={{ width: 44, height: 40 }} />
      </View>

      {/* Driver & Tour Operating Company Profile Hero Card */}
      <TouchableOpacity 
        onPress={() => navigation.navigate('Profile')}
        activeOpacity={0.8}
        style={{
          backgroundColor: themeColors.card,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.cardBorder,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, paddingRight: 10 }}>
          {driverData.avatarUrl ? (
            <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.primary[500], padding: 2, marginRight: 12, backgroundColor: colors.primary[50], alignItems: 'center', justifyContent: 'center' }}>
              <Image 
                source={{ uri: driverData.avatarUrl }} 
                style={{ width: 40, height: 40, borderRadius: 20 }} 
                resizeMode="cover" 
              />
            </View>
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary[50], alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.primary[300], marginRight: 12 }}>
              <Text style={{ color: colors.primary[600], fontWeight: '900', fontSize: 16 }}>
                {(driverData.name || 'DR').substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? colors.primary[400] : colors.primary[700], letterSpacing: 0.6, textTransform: 'uppercase' }} numberOfLines={1}>
                {driverData.companyName || 'Tour Transport Company'}
              </Text>
              {driverData.companyLogoUrl ? (
                <Image 
                  source={{ uri: driverData.companyLogoUrl }} 
                  style={{ width: 14, height: 14, borderRadius: 3 }} 
                  resizeMode="contain" 
                />
              ) : null}
            </View>
            <Text style={{ fontSize: 17, fontWeight: '900', color: themeColors.textPrimary, marginTop: 1 }} numberOfLines={1}>
              {getGreeting()}, {driverData.name || 'Driver'}! 👋
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.telemetry.moving, marginRight: 6 }} />
              <Text style={{ fontSize: 11, color: isDark ? '#34D399' : colors.telemetry.movingDark, fontWeight: '700' }}>Live GPS Radar Synchronized</Text>
            </View>
          </View>
        </View>

        <View style={isDark ? { backgroundColor: '#161E2E', borderWidth: 1, borderColor: '#28354D', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' } : themeStyles.btnSecondary}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: themeColors.textPrimary }}>Edit</Text>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '900', marginLeft: 2 }}>›</Text>
        </View>
      </TouchableOpacity>

      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingHorizontal: 2 }}>
          <Text style={{ fontSize: 17, fontWeight: '900', color: themeColors.textPrimary }}>My Assigned Tours</Text>
          <View style={{ backgroundColor: isDark ? '#161E2E' : colors.day.secondary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: isDark ? '#28354D' : colors.day.secondaryBorder }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: themeColors.textPrimary }}>{tours.length}</Text>
          </View>
        </View>

        {syncError && (
          <View style={{ marginBottom: 12, backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB', borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#FDE68A', borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ color: isDark ? '#FDE68A' : '#92400E', fontWeight: '800', fontSize: 12 }}>Sync Notice</Text>
              <Text style={{ color: isDark ? '#CBD5E1' : '#B45309', fontSize: 11, marginTop: 2 }}>{syncError}</Text>
            </View>
            <TouchableOpacity 
              onPress={() => { setLoading(true); setSyncError(null); loadData(); }}
              style={{ backgroundColor: colors.primary[500], paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {loading ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
            <View style={{ backgroundColor: themeColors.card, padding: 14, borderRadius: 20, borderWidth: 1, borderColor: themeColors.cardBorder, marginBottom: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Image 
                source={require('../../assets/logo-icon.png')} 
                style={{ width: 44, height: 44 }} 
                resizeMode="contain" 
              />
            </View>
            <ActivityIndicator size="small" color={colors.primary[500]} style={{ marginBottom: 8 }} />
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '600' }}>Syncing tours with office radar...</Text>
          </View>
        ) : (
          <FlatList
            data={tours}
            keyExtractor={(item) => item.id}
            renderItem={renderTour}
            contentContainerStyle={{ paddingBottom: 30 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
            ListEmptyComponent={
              <View style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: themeColors.cardBorder, borderRadius: 20, padding: 32, alignItems: 'center', marginTop: 12, backgroundColor: themeColors.card }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? '#161E2E' : colors.day.secondary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 26 }}>🚗</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '900', color: themeColors.textPrimary, marginBottom: 4 }}>
                  No Active Tour
                </Text>
                <Text style={{ fontSize: 12, color: themeColors.textSecondary, textAlign: 'center', lineHeight: 18, maxWidth: 260 }}>
                  {syncError 
                    ? 'Could not connect to tour server. Tap Retry above to reconnect.' 
                    : "You don't have any active tours assigned right now. Your tour manager will dispatch tours here."}
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Welcome Intro Greeting Overlay Modal (Bitgard System Design) */}
      <Modal
        visible={showWelcomeIntro}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWelcomeIntro(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(4, 5, 4, 0.85)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: themeColors.card, borderRadius: 26, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center', elevation: 12, shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, borderWidth: 1, borderColor: themeColors.cardBorder }}>
            
            {/* Top Close Button */}
            <TouchableOpacity 
              onPress={() => setShowWelcomeIntro(false)}
              style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? '#161E2E' : colors.day.secondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isDark ? '#28354D' : colors.day.secondaryBorder }}
            >
              <Text style={{ color: themeColors.textSecondary, fontSize: 14, fontWeight: '800' }}>✕</Text>
            </TouchableOpacity>

            {/* Glowing Avatar Ring */}
            <View style={{ marginTop: 8, marginBottom: 16, padding: 4, borderRadius: 9999, borderWidth: 3, borderColor: colors.primary[500], backgroundColor: isDark ? 'rgba(232, 115, 42, 0.15)' : colors.primary[50] }}>
              {driverData.avatarUrl ? (
                <Image 
                  source={{ uri: driverData.avatarUrl }} 
                  style={{ width: 84, height: 84, borderRadius: 42 }} 
                  resizeMode="cover" 
                />
              ) : (
                <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary[500], alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900' }}>
                    {(driverData.name || 'DR').substring(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            {/* Greeting Tag */}
            <View style={{ backgroundColor: isDark ? 'rgba(232, 115, 42, 0.18)' : colors.primary[50], borderColor: colors.primary[400], borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 10 }}>
              <Text style={{ color: isDark ? '#FDBA74' : colors.primary[700], fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>
                AYUBOWAN • CHAUFFEUR PORTAL
              </Text>
            </View>

            {/* Welcome Heading */}
            <Text style={{ fontSize: 22, fontWeight: '900', color: themeColors.textPrimary, textAlign: 'center', marginBottom: 4 }}>
              Welcome, {driverData.name || 'Driver'}!
            </Text>

            <Text style={{ fontSize: 12, color: themeColors.textSecondary, textAlign: 'center', marginBottom: 18, lineHeight: 18 }}>
              {driverData.companyName || 'Tour Transport Company'} fleet radar is active and synchronized with office dispatch.
            </Text>

            {/* Quick Status / Tours Summary */}
            <View style={{ width: '100%', backgroundColor: isDark ? '#141C2B' : colors.day.input, borderColor: themeColors.cardBorder, borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: themeColors.textSecondary, fontWeight: '700' }}>Assigned Tours</Text>
                <Text style={{ fontSize: 13, color: themeColors.textPrimary, fontWeight: '900' }}>
                  {tours.length} Tour{tours.length === 1 ? '' : 's'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.telemetry.moving, marginRight: 6 }} />
                <Text style={{ fontSize: 11, color: isDark ? '#34D399' : colors.telemetry.movingDark, fontWeight: '800' }}>
                  GPS Telematics Online
                </Text>
              </View>
            </View>

            {/* Start Shift Button (Signature Matte Orange) */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowWelcomeIntro(false)}
              style={[
                themeStyles.btnPrimary,
                { width: '100%' },
              ]}
            >
              <Text style={themeStyles.btnPrimaryText}>
                LET&apos;S GO / START SHIFT 🚀
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
