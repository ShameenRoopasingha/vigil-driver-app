import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Alert, Image, Linking, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { locationService } from '../services/locationService';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

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
  const [driverData, setDriverData] = useState<DriverProfile>({});
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(false);
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  let hookNavigation: DashboardNavigationProp | null = null;
  try {
    hookNavigation = useNavigation<DashboardNavigationProp>();
  } catch {
    // Fallback gracefully if context is mounting
  }
  const navigation = (propNavigation || hookNavigation)!;

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
          // Tour was completed or handed over to another driver
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

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Sign Out', 
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.clear();
          navigation.replace('Login');
        }
      }
    ]);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const renderTour = ({ item }: { item: Tour }) => {
    const isOngoing = item.status === 'ONGOING';

    if (isOngoing) {
      // Signature Admin App Active Tour Card (Obsidian & Emerald Glow)
      return (
        <View
          key={item.id}
          style={{
            backgroundColor: '#090d16',
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: 'rgba(16, 185, 129, 0.45)',
            padding: 16,
            marginBottom: 16,
            shadowColor: '#10b981',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 8,
          }}
        >
          {/* Header Row: Live Radar Badge & Vehicle Plate */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderWidth: 1,
                borderColor: '#10b981',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 20,
              }}
            >
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#10b981', marginRight: 6 }} />
              <Text style={{ color: '#34d399', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }}>
                ACTIVE TOUR • LIVE RADAR
              </Text>
            </View>

            {/* Vehicle Number Plate */}
            <View
              style={{
                backgroundColor: '#1e293b',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.12)',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: '#f8fafc', fontSize: 12, fontWeight: '800', fontFamily: 'monospace' }}>
                {item.vehicleNo}
              </Text>
            </View>
          </View>

          {/* Customer Name */}
          <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900', marginBottom: 6 }}>
            {item.customerName}
          </Text>

          {/* Destination */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ color: '#38bdf8', fontSize: 13, marginRight: 6 }}>📍</Text>
            <Text style={{ color: '#cbd5e1', fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
              {item.destination || 'Destination not specified'}
            </Text>
          </View>

          {/* Dates */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ color: '#818cf8', fontSize: 13, marginRight: 6 }}>📅</Text>
            <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '500' }}>
              Started {new Date(item.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={{
                flex: 1.4,
                backgroundColor: '#10b981',
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#10b981',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 6,
                elevation: 4,
              }}
              onPress={() => navigation.navigate('ActiveTour', { bookingId: item.id })}
            >
              <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '900' }}>
                ⚡ View Live Tour & GPS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => navigation.navigate('AddExpense', { bookingId: item.id, vehicleNo: item.vehicleNo })}
            >
              <Text style={{ color: '#f1f5f9', fontSize: 12, fontWeight: '700' }}>
                + Add Expense
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Standard Tour Card (Alabaster / Tactile Hardware Skeuomorphic)
    return (
      <View
        key={item.id}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 18,
          borderWidth: item.needsTakeover ? 2 : 1,
          borderColor: item.needsTakeover ? '#f59e0b' : '#e2e8f0',
          padding: 16,
          marginBottom: 14,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{item.customerName}</Text>
          <View
            style={{
              backgroundColor: item.needsTakeover ? '#fef3c7' : item.status === 'CONFIRMED' ? '#eff6ff' : '#f8fafc',
              borderColor: item.needsTakeover ? '#fde68a' : item.status === 'CONFIRMED' ? '#bfdbfe' : '#e2e8f0',
              borderWidth: 1,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '800',
                color: item.needsTakeover ? '#92400e' : item.status === 'CONFIRMED' ? '#1d4ed8' : '#475569',
              }}
            >
              {item.needsTakeover ? '⚡ TAKEOVER' : item.status}
            </Text>
          </View>
        </View>

        {/* Mid-Tour Handover Notification & Direct Navigation Card */}
        {item.needsTakeover && item.handoverDetails && (
          <View style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 12, marginVertical: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b', marginRight: 6 }} />
                <Text style={{ color: '#92400e', fontWeight: '900', fontSize: 11, textTransform: 'uppercase' }}>
                  Mid-Tour Handover Assigned
                </Text>
              </View>
              <View style={{ backgroundColor: '#fde68a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: '#78350f', fontSize: 9, fontWeight: '800' }}>ACTION REQUIRED</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
              <Text style={{ color: '#92400e', fontSize: 11, fontWeight: '700', width: 75 }}>📍 Location:</Text>
              <Text style={{ color: '#0f172a', fontSize: 11, fontWeight: '600', flex: 1 }} numberOfLines={2}>
                {item.handoverDetails.location || 'Vehicle Handover Point'}
              </Text>
            </View>

            {item.handoverDetails.previousDriverName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ color: '#92400e', fontSize: 11, fontWeight: '700', width: 75 }}>👤 Driver:</Text>
                <Text style={{ color: '#334155', fontSize: 11, fontWeight: '500', flex: 1 }}>
                  From {item.handoverDetails.previousDriverName} {item.handoverDetails.reason ? `(${item.handoverDetails.reason})` : ''}
                </Text>
              </View>
            ) : null}

            {item.handoverDetails.meterReading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ color: '#92400e', fontSize: 11, fontWeight: '700', width: 75 }}>🚗 Odometer:</Text>
                <Text style={{ color: '#334155', fontSize: 11, fontWeight: '600', flex: 1 }}>
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
                style={{ backgroundColor: '#d97706', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 11 }}>
                  🗺️ Navigate to Handover (Google Maps)
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ color: '#64748b', fontSize: 12, width: 85 }}>Vehicle Plate:</Text>
          <Text style={{ color: '#0f172a', fontSize: 12, fontWeight: '700', fontFamily: 'monospace' }}>{item.vehicleNo}</Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ color: '#64748b', fontSize: 12, width: 85 }}>Destination:</Text>
          <Text style={{ color: '#0f172a', fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>
            {item.destination || 'Not specified'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ color: '#64748b', fontSize: 12, width: 85 }}>Tour Date:</Text>
          <Text style={{ color: '#0f172a', fontSize: 12, fontWeight: '600' }}>
            {new Date(item.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 8 }}>
          <TouchableOpacity 
            style={{
              backgroundColor: item.needsTakeover ? '#d97706' : '#2563eb',
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              alignItems: 'center',
            }}
            onPress={() => navigation.navigate('ActiveTour', { bookingId: item.id })}
          >
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 12 }}>
              {item.needsTakeover ? '⚡ Take Over Tour' : 'Start / View Tour'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{
              backgroundColor: '#ecfdf5',
              borderWidth: 1,
              borderColor: '#a7f3d0',
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              alignItems: 'center',
            }}
            onPress={() => navigation.navigate('AddExpense', { bookingId: item.id, vehicleNo: item.vehicleNo })}
          >
            <Text style={{ color: '#065f46', fontWeight: '800', fontSize: 12 }}>+ Add Expense</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Top Branding & Action Bar */}
      <View style={{ backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* VIGIL Platform Brand */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ 
            width: 40, 
            height: 40, 
            backgroundColor: '#ffffff', 
            borderRadius: 10, 
            borderWidth: 1.5, 
            borderColor: '#e2e8f0', 
            justifyContent: 'center', 
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 2,
            elevation: 2,
            marginRight: 10
          }}>
            <Image 
              source={require('../../assets/logo-icon.png')} 
              style={{ width: 30, height: 30 }} 
              resizeMode="contain" 
            />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a', letterSpacing: 1.2 }}>
                VIGIL
              </Text>
              <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, marginLeft: 6, borderWidth: 1, borderColor: '#a7f3d0' }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#047857', letterSpacing: 0.5 }}>
                  DRIVER
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '600', marginTop: 1 }}>
              Fleet & Travel Management
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          onPress={() => navigation.navigate('Profile')} 
          activeOpacity={0.7}
          style={{ 
            backgroundColor: '#f8fafc', 
            paddingHorizontal: 14, 
            paddingVertical: 8, 
            borderRadius: 9999, 
            borderWidth: 1.2, 
            borderColor: '#cbd5e1',
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
          }}
        >
          <Text style={{ color: '#334155', fontWeight: '800', fontSize: 12 }}>⚙️ Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Driver & Tour Operating Company Profile Hero Card (Admin Platform Design) */}
      <TouchableOpacity 
        onPress={() => navigation.navigate('Profile')}
        activeOpacity={0.8}
        style={{
          backgroundColor: '#ffffff',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: '#e2e8f0',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, paddingRight: 10 }}>
          {driverData.avatarUrl ? (
            <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#10b981', padding: 1.5, marginRight: 12, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' }}>
              <Image 
                source={{ uri: driverData.avatarUrl }} 
                style={{ width: 42, height: 42, borderRadius: 21 }} 
                resizeMode="cover" 
              />
            </View>
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#bfdbfe', marginRight: 12 }}>
              <Text style={{ color: '#1d4ed8', fontWeight: '900', fontSize: 16 }}>
                {(driverData.name || 'DR').substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#6366f1', letterSpacing: 0.6, textTransform: 'uppercase' }} numberOfLines={1}>
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
            <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a', marginTop: 1 }} numberOfLines={1}>
              {getGreeting()}, {driverData.name || 'Driver'}! 👋
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#10b981', marginRight: 6 }} />
              <Text style={{ fontSize: 11, color: '#059669', fontWeight: '700' }}>Live GPS Radar Synchronized</Text>
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#334155', marginRight: 2 }}>Edit</Text>
          <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '900' }}>›</Text>
        </View>
      </TouchableOpacity>

      <View className="flex-1 px-4 pt-4">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingHorizontal: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>My Assigned Tours</Text>
            <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#475569' }}>{tours.length}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
              onPress={() => navigation.navigate('Calendar')}
            >
              <Text style={{ color: '#1d4ed8', fontSize: 11, fontWeight: '800' }}>📅 Calendar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 4, elevation: 2 }}
              onPress={() => navigation.navigate('AddExpense', {})}
            >
              <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800' }}>+ Expense</Text>
            </TouchableOpacity>
          </View>
        </View>

        {syncError && (
          <View style={{ marginBottom: 12, backgroundColor: '#fffbeb', borderColor: '#fef3c7', borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ color: '#92400e', fontWeight: '700', fontSize: 12 }}>Sync Notice</Text>
              <Text style={{ color: '#b45309', fontSize: 11, marginTop: 2 }}>{syncError}</Text>
            </View>
            <TouchableOpacity 
              onPress={() => { setLoading(true); setSyncError(null); loadData(); }}
              style={{ backgroundColor: '#d97706', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {loading ? (
          <View className="items-center justify-center py-20">
            <View className="bg-white p-3 rounded-2xl border border-gray-100 mb-3 items-center justify-center">
              <Image 
                source={require('../../assets/logo-icon.png')} 
                style={{ width: 44, height: 44 }} 
                resizeMode="contain" 
              />
            </View>
            <ActivityIndicator size="small" color="#2563eb" className="mb-2" />
            <Text className="text-gray-500 text-xs font-medium">Syncing tours with office...</Text>
          </View>
        ) : (
          <FlatList
            data={tours}
            keyExtractor={(item) => item.id}
            renderItem={renderTour}
            contentContainerStyle={{ paddingBottom: 30 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: '#cbd5e1', borderRadius: 20, padding: 32, alignItems: 'center', marginTop: 12, backgroundColor: '#f8fafc' }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 26 }}>🚗</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 4 }}>
                  No Active Tour
                </Text>
                <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 18, maxWidth: 260 }}>
                  {syncError 
                    ? 'Could not connect to tour server. Tap Retry above to reconnect.' 
                    : "You don't have any active tours assigned right now. Your tour manager will dispatch tours here."}
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Welcome Intro Greeting Overlay Modal */}
      <Modal
        visible={showWelcomeIntro}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWelcomeIntro(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 28, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center', elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10 }}>
            
            {/* Top Close Button */}
            <TouchableOpacity 
              onPress={() => setShowWelcomeIntro(false)}
              style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#64748b', fontSize: 16, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>

            {/* Glowing Avatar Ring */}
            <View style={{ marginTop: 8, marginBottom: 16, padding: 4, borderRadius: 9999, borderWidth: 3, borderColor: '#10b981', backgroundColor: '#ecfdf5' }}>
              {driverData.avatarUrl ? (
                <Image 
                  source={{ uri: driverData.avatarUrl }} 
                  style={{ width: 84, height: 84, borderRadius: 42 }} 
                  resizeMode="cover" 
                />
              ) : (
                <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#ffffff', fontSize: 32, fontWeight: '900' }}>
                    {(driverData.name || 'DR').substring(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            {/* Greeting Tag */}
            <View style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 10 }}>
              <Text style={{ color: '#1d4ed8', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
                AYUBOWAN • CHAUFFEUR PORTAL
              </Text>
            </View>

            {/* Welcome Heading */}
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#0f172a', textAlign: 'center', marginBottom: 4 }}>
              Welcome, {driverData.name || 'Driver'}!
            </Text>

            <Text style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 18, lineHeight: 18 }}>
              {driverData.companyName || 'Tour Transport Company'} fleet radar is active and synchronized with office dispatch.
            </Text>

            {/* Quick Status / Tours Summary */}
            <View style={{ width: '100%', backgroundColor: '#f8fafc', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: '#475569', fontWeight: '700' }}>Assigned Tours</Text>
                <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '900' }}>
                  {tours.length} Tour{tours.length === 1 ? '' : 's'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginRight: 6 }} />
                <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '800' }}>
                  GPS Tracking Ready
                </Text>
              </View>
            </View>

            {/* Start Shift / Dismiss Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowWelcomeIntro(false)}
              style={{ width: '100%', backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 16, alignItems: 'center', elevation: 4, shadowColor: '#2563eb', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 5 }}
            >
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '800' }}>
                Let&apos;s Go / Start Shift 🚀
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
