import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type CalendarNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Calendar'>;

export default function CalendarScreen() {
  const navigation = useNavigation<CalendarNavigationProp>();
  const [markedDates, setMarkedDates] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTours();
  }, []);

  const fetchTours = async () => {
    try {
      const response = await apiClient.get('/driver/tours');
      if (response.data?.success) {
        const tours = response.data.data;
        const marks: any = {};
        
        tours.forEach((tour: any) => {
          // Format date as YYYY-MM-DD
          const d = new Date(tour.startDate);
          const dateString = d.toISOString().split('T')[0];
          
          let color = '#3b82f6'; // blue (CONFIRMED)
          if (tour.status === 'ONGOING') color = '#22c55e'; // green
          else if (tour.status === 'PENDING') color = '#f59e0b'; // orange

          marks[dateString] = {
            marked: true,
            dotColor: color,
            selected: true,
            selectedColor: color,
            selectedTextColor: '#ffffff',
            tourData: tour
          };
        });
        
        setMarkedDates(marks);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 py-3.5 bg-white border-b border-gray-200 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
            <Text className="text-blue-600 text-base font-bold">← Back</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-800">Booking Calendar</Text>
        </View>

        <View className="flex-row items-center bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
          <Image 
            source={require('../../assets/logo-icon.png')} 
            style={{ width: 14, height: 14 }} 
            resizeMode="contain" 
          />
          <Text className="text-white text-[10px] font-bold ml-1 tracking-wider">VIGIL</Text>
        </View>
      </View>

      <View className="flex-1 p-4">
        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" className="mt-10" />
        ) : (
          <View className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <Calendar
              markedDates={markedDates}
              theme={{
                todayTextColor: '#2563eb',
                arrowColor: '#2563eb',
                monthTextColor: '#1f2937',
                textMonthFontWeight: 'bold',
              }}
              onDayPress={(day: any) => {
                const mark = markedDates[day.dateString];
                if (mark && mark.tourData) {
                  // Navigate to tour details when a booked date is clicked
                  navigation.navigate('ActiveTour', { bookingId: mark.tourData.id });
                }
              }}
            />
            
            <View className="p-4 border-t border-gray-100 bg-gray-50 flex-row justify-around">
              <View className="flex-row items-center">
                <View className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
                <Text className="text-xs text-gray-600">Confirmed</Text>
              </View>
              <View className="flex-row items-center">
                <View className="w-3 h-3 rounded-full bg-green-500 mr-2" />
                <Text className="text-xs text-gray-600">Ongoing</Text>
              </View>
              <View className="flex-row items-center">
                <View className="w-3 h-3 rounded-full bg-orange-500 mr-2" />
                <Text className="text-xs text-gray-600">Pending</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
