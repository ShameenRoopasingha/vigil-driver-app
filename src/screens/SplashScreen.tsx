import React, { useEffect } from 'react';
import { View, Text, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, navigationRef } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        // Smooth brand exposure pause (800ms)
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (!isMounted) return;

        const token = await AsyncStorage.getItem('driverToken');
        const targetRoute = token ? 'Dashboard' : 'Login';

        if (navigation?.reset) {
          navigation.reset({ index: 0, routes: [{ name: targetRoute }] });
        } else if (navigationRef.isReady()) {
          navigationRef.reset({ index: 0, routes: [{ name: targetRoute }] });
        }
      } catch (e) {
        if (isMounted) {
          if (navigation?.reset) {
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          } else if (navigationRef.isReady()) {
            navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
          }
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [navigation]);

  return (
    <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center px-6">
      <View className="items-center">
        {/* VIGIL Logo Card */}
        <View className="bg-white p-4 rounded-3xl shadow-2xl mb-4 items-center justify-center border border-slate-800">
          <Image 
            source={require('../../assets/logo-icon.png')} 
            style={{ width: 84, height: 84 }} 
            resizeMode="contain" 
          />
        </View>

        <Text className="text-3xl font-black text-white tracking-widest">VIGIL</Text>
        <Text className="text-emerald-400 font-bold text-xs uppercase tracking-widest mt-1">
          Driver Fleet Portal
        </Text>
        <Text className="text-slate-400 text-xs mt-1 text-center">
          Real-time GPS Radar & Travel Management
        </Text>

        <View className="mt-8 flex-row items-center gap-2 bg-slate-900/90 px-4 py-2 rounded-full border border-slate-800">
          <ActivityIndicator size="small" color="#10b981" />
          <Text className="text-slate-300 text-xs font-medium">Initializing workspace...</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
