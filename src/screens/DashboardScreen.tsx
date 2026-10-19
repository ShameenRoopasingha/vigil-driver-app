import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Alert, Image, Linking } from 'react-native';
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
  companyName?: string;
  companyLogoUrl?: string | null;
}

export default function DashboardScreen({ navigation: propNavigation }: { navigation?: DashboardNavigationProp }) {
  const [driverData, setDriverData] = useState<DriverProfile>({});
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

  const renderTour = ({ item }: { item: Tour }) => (
    <View className={`bg-white p-4 rounded-xl mb-4 shadow-sm border ${item.needsTakeover ? 'border-amber-300 ring-1 ring-amber-300/50' : 'border-gray-100'}`}>
      <View className="flex-row justify-between items-center mb-2">
        <Text className="font-bold text-lg text-gray-800">{item.customerName}</Text>
        <View className={`${item.needsTakeover ? 'bg-amber-100 border border-amber-300' : 'bg-blue-100'} px-2 py-1 rounded-md`}>
          <Text className={`${item.needsTakeover ? 'text-amber-900 font-extrabold' : 'text-blue-800 font-bold'} text-xs`}>
            {item.needsTakeover ? '⚡ TAKEOVER' : item.status}
          </Text>
        </View>
      </View>

      {/* Mid-Tour Handover Notification & Direct Navigation Card */}
      {item.needsTakeover && item.handoverDetails && (
        <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 my-2 shadow-xs">
          <View className="flex-row items-center justify-between mb-1.5">
            <View className="flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
              <Text className="text-amber-900 font-black text-xs uppercase tracking-wide">
                Mid-Tour Handover Assigned
              </Text>
            </View>
            <View className="bg-amber-200/80 px-2 py-0.5 rounded">
              <Text className="text-amber-900 text-[10px] font-extrabold">ACTION REQUIRED</Text>
            </View>
          </View>

          <View className="flex-row items-start mb-1">
            <Text className="text-amber-800 text-xs font-bold w-20">📍 Location:</Text>
            <Text className="text-gray-900 text-xs font-semibold flex-1" numberOfLines={2}>
              {item.handoverDetails.location || 'Vehicle Handover Point'}
            </Text>
          </View>

          {item.handoverDetails.previousDriverName ? (
            <View className="flex-row items-center mb-1">
              <Text className="text-amber-800 text-xs font-bold w-20">👤 Driver:</Text>
              <Text className="text-gray-700 text-xs font-medium flex-1">
                From {item.handoverDetails.previousDriverName} {item.handoverDetails.reason ? `(${item.handoverDetails.reason})` : ''}
              </Text>
            </View>
          ) : null}

          {item.handoverDetails.meterReading ? (
            <View className="flex-row items-center mb-1.5">
              <Text className="text-amber-800 text-xs font-bold w-20">🚗 Odometer:</Text>
              <Text className="text-gray-700 text-xs font-medium flex-1">
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
              className="bg-amber-600 active:bg-amber-700 py-2.5 px-3 rounded-lg flex-row items-center justify-center gap-1.5 shadow-sm mt-1"
            >
              <Text className="text-white font-extrabold text-xs">
                🗺️ Navigate to Handover (Google Maps)
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      
      <View className="flex-row items-center mb-1">
        <Text className="text-gray-500 text-sm w-24">Vehicle:</Text>
        <Text className="text-gray-800 font-medium">{item.vehicleNo}</Text>
      </View>
      
      <View className="flex-row items-center mb-1">
        <Text className="text-gray-500 text-sm w-24">Destination:</Text>
        <Text className="text-gray-800 font-medium">{item.destination || 'Not specified'}</Text>
      </View>

      <View className="flex-row items-center mb-1">
        <Text className="text-gray-500 text-sm w-24">Date:</Text>
        <Text className="text-gray-800 font-medium">
          {new Date(item.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      </View>
      
      <View className="flex-row items-center mt-3 pt-3 border-t border-gray-100 gap-2">
        <TouchableOpacity 
          className={`${item.needsTakeover ? 'bg-amber-600' : 'bg-blue-600'} flex-1 py-3 rounded-lg items-center`}
          onPress={() => navigation.navigate('ActiveTour', { bookingId: item.id })}
        >
          <Text className="text-white font-bold">
            {item.needsTakeover ? '⚡ Take Over Tour' : 'Start / View Tour'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className="bg-green-100 flex-1 py-3 rounded-lg items-center"
          onPress={() => navigation.navigate('AddExpense', { bookingId: item.id, vehicleNo: item.vehicleNo })}
        >
          <Text className="text-green-800 font-bold">Add Expense</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Profile')} 
            activeOpacity={0.7}
            style={{ 
              backgroundColor: '#eff6ff', 
              paddingHorizontal: 12, 
              paddingVertical: 7, 
              borderRadius: 9999, 
              borderWidth: 1, 
              borderColor: '#bfdbfe',
              flexDirection: 'row',
              alignItems: 'center'
            }}
          >
            <Text style={{ color: '#1d4ed8', fontWeight: '700', fontSize: 12 }}>⚙️ Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handleLogout} 
            activeOpacity={0.7}
            style={{ 
              backgroundColor: '#fef2f2', 
              paddingHorizontal: 12, 
              paddingVertical: 7, 
              borderRadius: 9999, 
              borderWidth: 1, 
              borderColor: '#fecaca',
              flexDirection: 'row',
              alignItems: 'center'
            }}
          >
            <Text style={{ color: '#dc2626', fontWeight: '700', fontSize: 12 }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Driver & Tour Operating Company Profile Card */}
      <TouchableOpacity 
        onPress={() => navigation.navigate('Profile')}
        activeOpacity={0.8}
        className="px-5 py-3.5 bg-white border-b border-gray-200 flex-row items-center justify-between"
      >
        <View className="flex-row items-center flex-1 min-w-0 pr-2">
          {driverData.companyLogoUrl ? (
            <View className="w-12 h-12 bg-white rounded-xl border border-gray-200 p-1 items-center justify-center mr-3.5">
              <Image 
                source={{ uri: driverData.companyLogoUrl }} 
                style={{ width: 44, height: 44, borderRadius: 8 }} 
                resizeMode="contain" 
              />
            </View>
          ) : (
            <View className="w-12 h-12 bg-blue-50 rounded-xl items-center justify-center border border-blue-200 mr-3.5">
              <Text className="text-blue-800 font-extrabold text-base">
                {(driverData.companyName || 'TC').substring(0, 2).toUpperCase()}
              </Text>
            </View>
          )}

          <View className="flex-1 min-w-0">
            <Text className="text-xs font-bold text-blue-700 tracking-wide uppercase" numberOfLines={1}>
              {driverData.companyName || 'Tour Transport Company'}
            </Text>
            <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
              {driverData.name ? `Welcome, ${driverData.name}` : 'Welcome, Driver'}
            </Text>
            <View className="flex-row items-center mt-0.5">
              <View className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
              <Text className="text-[11px] text-gray-500">Live GPS Radar Connected</Text>
            </View>
          </View>
        </View>

        <View className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex-row items-center">
          <Text className="text-xs font-bold text-slate-700 mr-1">Edit</Text>
          <Text className="text-slate-400 text-xs">›</Text>
        </View>
      </TouchableOpacity>

      <View className="flex-1 px-4 pt-4">
        <View className="flex-row justify-between items-center mb-4 px-2">
          <Text className="text-lg font-bold text-gray-800">My Assigned Tours</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity 
              className="bg-blue-100 px-3 py-1.5 rounded-md"
              onPress={() => navigation.navigate('Calendar')}
            >
              <Text className="text-blue-800 text-xs font-bold">📅 Calendar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className="bg-green-600 px-3 py-1.5 rounded-md"
              onPress={() => navigation.navigate('AddExpense', {})}
            >
              <Text className="text-white text-xs font-bold">+ Expense</Text>
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
            contentContainerStyle={{ paddingBottom: 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View className="items-center justify-center py-10">
                <Text className="text-gray-400 text-base">
                  {syncError ? 'Could not load assigned tours. Tap Retry to reconnect.' : 'No tours assigned right now.'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
