import React, { useEffect } from 'react';
import { View, Text, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { navigationRef } from '../navigation/navigationRef';
import { colors } from '../theme';

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
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.night.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
      }}
    >
      <View style={{ alignItems: 'center' }}>
        {/* VIGIL Logo Card (Obsidian glass with signature Matte Orange specular highlight) */}
        <View
          style={{
            backgroundColor: '#0D0D0D',
            padding: 18,
            borderRadius: 28,
            marginBottom: 20,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: 'rgba(232, 115, 42, 0.4)',
            shadowColor: colors.primary[500],
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 18,
            elevation: 10,
          }}
        >
          <Image
            source={require('../../assets/logo-icon.png')}
            style={{ width: 84, height: 84 }}
            resizeMode="contain"
          />
        </View>

        {/* Brand Heading */}
        <Text
          style={{
            fontSize: 32,
            fontWeight: '900',
            color: colors.night.foreground,
            letterSpacing: 4,
          }}
        >
          VIGIL
        </Text>

        {/* Tactical Accent Chip */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(232, 115, 42, 0.15)',
            borderWidth: 1,
            borderColor: colors.primary[500],
            paddingHorizontal: 12,
            paddingVertical: 3.5,
            borderRadius: 20,
            marginTop: 8,
          }}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.primary[500],
              marginRight: 6,
            }}
          />
          <Text
            style={{
              color: colors.primary[400],
              fontWeight: '900',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
            }}
          >
            Driver Telematics Portal
          </Text>
        </View>

        <Text
          style={{
            color: colors.night.mutedForeground,
            fontSize: 12,
            marginTop: 8,
            textAlign: 'center',
            fontWeight: '500',
          }}
        >
          Tour Operations & Real-Time GPS Radar
        </Text>

        {/* Initializing telemetry state */}
        <View
          style={{
            marginTop: 40,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.night.card,
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 9999,
            borderWidth: 1,
            borderColor: colors.night.cardBorder,
          }}
        >
          <ActivityIndicator size="small" color={colors.primary[500]} />
          <Text
            style={{
              color: colors.night.mutedForeground,
              fontSize: 12,
              fontWeight: '600',
              marginLeft: 10,
              letterSpacing: 0.3,
            }}
          >
            Synchronizing Bitgard Engine...
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
