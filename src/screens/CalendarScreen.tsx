import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

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
          
          let color = '#4f46e5'; // Indigo (CONFIRMED)
          if (tour.status === 'ONGOING') color = '#10b981'; // Emerald (ONGOING)
          else if (tour.status === 'PENDING') color = '#f59e0b'; // Amber (PENDING)

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Top Header matching Admin App */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: 10 }}
          >
            <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '800' }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>Tour Calendar</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' }}>
          <Image 
            source={require('../../assets/logo-icon.png')} 
            style={{ width: 18, height: 18, marginRight: 6 }} 
            resizeMode="contain" 
          />
          <Text style={{ color: '#0f172a', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>VIGIL</Text>
        </View>
      </View>

      <View style={{ flex: 1, padding: 16 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
        ) : (
          <View style={{ backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 }}>
            <Calendar
              markedDates={markedDates}
              theme={{
                todayTextColor: '#4f46e5',
                arrowColor: '#4f46e5',
                monthTextColor: '#0f172a',
                textMonthFontWeight: '900',
                textDayHeaderFontWeight: '700',
              }}
              onDayPress={(day: any) => {
                const mark = markedDates[day.dateString];
                if (mark && mark.tourData) {
                  // Navigate to tour details when a booked date is clicked
                  navigation.navigate('ActiveTour', { bookingId: mark.tourData.id });
                }
              }}
            />
            
            <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#f8fafc', flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4f46e5', marginRight: 6 }} />
                <Text style={{ fontSize: 11, color: '#334155', fontWeight: '700' }}>Confirmed</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginRight: 6 }} />
                <Text style={{ fontSize: 11, color: '#334155', fontWeight: '700' }}>Ongoing</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b', marginRight: 6 }} />
                <Text style={{ fontSize: 11, color: '#334155', fontWeight: '700' }}>Pending</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
