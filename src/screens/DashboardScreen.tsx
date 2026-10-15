import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { locationService } from '../services/locationService';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type DashboardNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;

interface Tour {
  id: string;
  customerName: string;
  vehicleNo: string;
  startDate: string;
  endDate: string | null;
  destination: string | null;
  status: string;
}

interface DriverProfile {
  id?: string;
  name?: string;
  companyName?: string;
  companyLogoUrl?: string | null;
}

export default function DashboardScreen() {
  const [driverData, setDriverData] = useState<DriverProfile>({});
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<DashboardNavigationProp>();

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
    } catch (error) {
      console.error(error);
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
    <View className="bg-white p-4 rounded-xl mb-4 shadow-sm border border-gray-100">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="font-bold text-lg text-gray-800">{item.customerName}</Text>
        <View className="bg-blue-100 px-2 py-1 rounded-md">
          <Text className="text-blue-800 text-xs font-bold">{item.status}</Text>
        </View>
      </View>
      
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
          className="bg-blue-600 flex-1 py-3 rounded-lg items-center"
          onPress={() => navigation.navigate('ActiveTour', { bookingId: item.id })}
        >
          <Text className="text-white font-bold">Start / View Tour</Text>
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
      <View className="px-5 py-3 bg-white border-b border-gray-100 flex-row justify-between items-center">
        {/* VIGIL Platform Badge */}
        <View className="flex-row items-center bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
          <Image 
            source={require('../../assets/logo-icon.png')} 
            style={{ width: 18, height: 18 }} 
            resizeMode="contain" 
          />
          <Text className="text-white font-black text-xs tracking-wider ml-1.5">
            VIGIL <Text className="text-emerald-400 font-semibold">DRIVER</Text>
          </Text>
        </View>

        <TouchableOpacity 
          onPress={handleLogout} 
          className="bg-gray-100 px-3 py-1.5 rounded-full flex-row items-center active:bg-gray-200"
        >
          <Text className="text-red-500 font-bold text-xs">Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Driver & Tour Operating Company Profile Card */}
      <View className="px-5 py-3.5 bg-white border-b border-gray-200 flex-row items-center shadow-sm">
        {driverData.companyLogoUrl ? (
          <View className="w-13 h-13 bg-white rounded-xl shadow-sm border border-gray-200 p-1 items-center justify-center mr-3.5">
            <Image 
              source={{ uri: driverData.companyLogoUrl }} 
              style={{ width: 46, height: 46, borderRadius: 8 }} 
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
          <Text className="text-xs font-bold text-blue-700 tracking-wide uppercase">
            {driverData.companyName || 'Tour Transport Company'}
          </Text>
          <Text className="text-lg font-bold text-gray-900">
            {driverData.name ? `Welcome, ${driverData.name}` : 'Welcome, Driver'}
          </Text>
          <View className="flex-row items-center mt-0.5">
            <View className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
            <Text className="text-[11px] text-gray-500">Live GPS Radar Connected</Text>
          </View>
        </View>
      </View>

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
        
        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" className="mt-10" />
        ) : (
          <FlatList
            data={tours}
            keyExtractor={(item) => item.id}
            renderItem={renderTour}
            contentContainerStyle={{ paddingBottom: 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View className="items-center justify-center py-10">
                <Text className="text-gray-400 text-base">No tours assigned right now.</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
