import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import './global.css';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import LiveLocationNotificationBar from './src/components/LiveLocationNotificationBar';

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Calendar: undefined;
  AddExpense: { bookingId?: string; vehicleNo?: string };
  ActiveTour: { bookingId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
        <NavigationContainer>
          <LiveLocationNotificationBar />
          <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Calendar" component={CalendarScreen} />
            <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
            <Stack.Screen name="ActiveTour" component={require('./src/screens/ActiveTourScreen').default} />
          </Stack.Navigator>
        </NavigationContainer>
    </SafeAreaProvider>
  );
}
