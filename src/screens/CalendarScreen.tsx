import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { colors, themeStyles } from '../theme';

type CalendarNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Calendar'>;

export default function CalendarScreen() {
  const navigation = useNavigation<CalendarNavigationProp>();
  const [markedDates, setMarkedDates] = useState<any>({});
  const [loading, setLoading] = useState(true);

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
          
          let color: string = colors.primary[500]; // Signature Matte Orange (CONFIRMED)
          if (tour.status === 'ONGOING') color = colors.telemetry.moving; // Emerald (ONGOING)
          else if (tour.status === 'PENDING') color = colors.telemetry.idle; // Amber (PENDING)

          marks[dateString] = {
            marked: true,
            dotColor: color,
            selected: true,
            selectedColor: color,
            selectedTextColor: '#FFFFFF',
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

  useEffect(() => {
    fetchTours();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.day.background }}>
      {/* Top Header matching Admin App */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.day.card, borderBottomWidth: 1, borderBottomColor: colors.day.cardBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={[themeStyles.btnSecondary, { paddingHorizontal: 12, paddingVertical: 6, marginRight: 10 }]}
          >
            <Text style={themeStyles.btnSecondaryText}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '900', color: colors.day.foreground }}>Tour Calendar</Text>
        </View>

        {/* Space reserved for Top-Right Arc Nav Button */}
        <View style={{ width: 44, height: 40 }} />
      </View>

      <View style={{ flex: 1, padding: 16 }}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
        ) : (
          <View style={{ backgroundColor: colors.day.card, borderRadius: 22, borderWidth: 1, borderColor: colors.day.cardBorder, overflow: 'hidden', shadowColor: colors.day.foreground, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
            <Calendar
              markedDates={markedDates}
              theme={{
                calendarBackground: colors.day.card,
                todayTextColor: colors.primary[500],
                arrowColor: colors.primary[500],
                monthTextColor: colors.day.foreground,
                dayTextColor: colors.day.foreground,
                textSectionTitleColor: colors.day.mutedForeground,
                textMonthFontWeight: '900',
                textDayHeaderFontWeight: '800',
                textDayFontWeight: '600',
              }}
              onDayPress={(day: any) => {
                const mark = markedDates[day.dateString];
                if (mark && mark.tourData) {
                  // Navigate to tour details when a booked date is clicked
                  navigation.navigate('ActiveTour', { bookingId: mark.tourData.id });
                }
              }}
            />
            
            <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.day.cardBorder, backgroundColor: colors.day.input, flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary[500], marginRight: 6 }} />
                <Text style={{ fontSize: 11.5, color: colors.day.foreground, fontWeight: '800' }}>Confirmed</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.telemetry.moving, marginRight: 6 }} />
                <Text style={{ fontSize: 11.5, color: colors.day.foreground, fontWeight: '800' }}>Ongoing</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.telemetry.idle, marginRight: 6 }} />
                <Text style={{ fontSize: 11.5, color: colors.day.foreground, fontWeight: '800' }}>Pending</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
