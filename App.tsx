import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/utils/toast';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import './global.css';

import { RootStackParamList } from './src/navigation/types';
import { navigationRef } from './src/navigation/navigationRef';

import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import ActiveTourScreen from './src/screens/ActiveTourScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LiveLocationNotificationBar from './src/components/LiveLocationNotificationBar';
import ArcNavbar from './src/components/ArcNavbar';

export { RootStackParamList } from './src/navigation/types';
export { navigationRef } from './src/navigation/navigationRef';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppContent() {
  const { isDark, colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator initialRouteName="Dashboard" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Calendar" component={CalendarScreen} />
          <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
          <Stack.Screen name="ActiveTour" component={ActiveTourScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </Stack.Navigator>
        <LiveLocationNotificationBar />
        <ArcNavbar />
      </NavigationContainer>
      <Toast config={toastConfig} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
