import React, { useEffect } from 'react';
import { View, Text, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { navigationRef } from '../navigation/navigationRef';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      <View style={{ alignItems: 'center' }}>
        {/* VIGIL Logo Card */}
        <View style={{ backgroundColor: '#ffffff', padding: 16, borderRadius: 24, marginBottom: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1e293b' }}>
          <Image 
            source={require('../../assets/logo-icon.png')} 
            style={{ width: 84, height: 84 }} 
            resizeMode="contain" 
          />
        </View>

        <Text style={{ fontSize: 30, fontWeight: '900', color: '#ffffff', letterSpacing: 4 }}>VIGIL</Text>
        <Text style={{ color: '#34d399', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, marginTop: 4 }}>
          Driver Fleet Portal
        </Text>
        <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4, textAlign: 'center' }}>
          Real-time GPS Radar & Travel Management
        </Text>

        <View style={{ marginTop: 32, flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999, borderWidth: 1, borderColor: '#1e293b' }}>
          <ActivityIndicator size="small" color="#10b981" />
          <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: '500', marginLeft: 8 }}>Initializing workspace...</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
