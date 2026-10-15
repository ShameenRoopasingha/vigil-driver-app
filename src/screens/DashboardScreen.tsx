import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Alert } from 'react-native';
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

export default function DashboardScreen() {
  const [driverName, setDriverName] = useState('');
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<DashboardNavigationProp>();

  const loadData = async () => {
    try {
      const driverStr = await AsyncStorage.getItem('driverData');
      if (driverStr) {
        setDriverName(JSON.parse(driverStr).name);
      }

      const response = await apiClient.get('/driver/tours');
      if (response.data?.success) {
        setTours(response.data.data);

        // Auto-resume live location tracking if an ongoing tour exists
        const ongoing = response.data.data.find((t: Tour) => t.status === 'ONGOING');
        if (ongoing) {
          if (!locationService.isTripTrackingActive() || locationService.getActiveBookingId() !== ongoing.id) {
            locationService.startTripTracking(ongoing.id);
          }
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
      <View className="px-6 py-4 bg-white border-b border-gray-200 flex-row justify-between items-center">
        <View>
          <Text className="text-gray-500 text-sm">Welcome back,</Text>
          <Text className="text-xl font-bold text-gray-800">{driverName || 'Driver'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} className="bg-gray-100 p-2 rounded-full">
          <Text className="text-red-500 font-bold text-xs px-2">Logout</Text>
        </TouchableOpacity>
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
