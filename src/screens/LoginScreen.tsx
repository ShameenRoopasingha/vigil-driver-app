import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { DriverLoginInputSchema } from '../validations';
import { toast } from '../utils/toast';
import { colors, themeStyles } from '../theme';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null);
  const navigation = useNavigation<LoginScreenNavigationProp>();

  const handleLogin = async () => {
    const validation = DriverLoginInputSchema.safeParse({ email, password });
    if (!validation.success) {
      toast.warning('Validation Error', validation.error.issues[0]?.message || 'Invalid email or password');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/driver/login', { 
        email: validation.data.email, 
        password: validation.data.password 
      });
      
      if (response.data?.success && response.data?.data?.token) {
        await AsyncStorage.setItem('driverToken', response.data.data.token);
        await AsyncStorage.setItem('driverData', JSON.stringify(response.data.data.driver));
        toast.success('Welcome back!', 'Authenticated to VIGIL Fleet Radar');
        navigation.replace('Dashboard');
      } else {
        toast.error('Login Failed', response.data?.error || 'Invalid credentials');
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Login Failed', error.response?.data?.error || 'Cannot connect to server. Check IP address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.day.background, justifyContent: 'center', paddingHorizontal: 24 }}>
      {/* Brand Header */}
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <View
          style={{
            backgroundColor: colors.day.card,
            padding: 16,
            borderRadius: 26,
            borderWidth: 1.5,
            borderColor: colors.day.cardBorder,
            marginBottom: 14,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.day.foreground,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          <Image 
            source={require('../../assets/logo-icon.png')} 
            style={{ width: 64, height: 64 }} 
            resizeMode="contain" 
          />
        </View>

        <Text style={{ fontSize: 32, fontWeight: '900', color: colors.day.foreground, letterSpacing: 2 }}>
          VIGIL
        </Text>

        {/* Signature Matte Orange Pill Chip */}
        <View
          style={{
            backgroundColor: colors.primary[50],
            borderWidth: 1.2,
            borderColor: colors.primary[400],
            paddingHorizontal: 12,
            paddingVertical: 3.5,
            borderRadius: 20,
            marginTop: 6,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary[500], marginRight: 6 }} />
          <Text style={{ color: colors.primary[600], fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Chauffeur & Fleet Portal
          </Text>
        </View>

        <Text style={{ color: colors.day.mutedForeground, fontSize: 12, fontWeight: '600', marginTop: 6 }}>
          Tour Operations & Telematics
        </Text>
      </View>

      {/* Login Card */}
      <View
        style={{
          backgroundColor: colors.day.card,
          padding: 24,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.day.cardBorder,
          shadowColor: colors.day.foreground,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.07,
          shadowRadius: 16,
          elevation: 5,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '900', color: colors.day.foreground, marginBottom: 4, textAlign: 'center' }}>
          Driver Sign In
        </Text>
        <Text style={{ fontSize: 12, color: colors.day.mutedForeground, marginBottom: 22, textAlign: 'center' }}>
          Access your assigned tours & GPS radar
        </Text>
        
        {/* Email Field */}
        <Text style={{ color: colors.day.foreground, marginBottom: 6, fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3 }}>
          EMAIL ADDRESS
        </Text>
        <TextInput 
          style={[
            themeStyles.input,
            {
              marginBottom: 16,
              borderColor: focusedInput === 'email' ? colors.primary[500] : colors.day.cardBorder,
              backgroundColor: focusedInput === 'email' ? '#FFFFFF' : colors.day.input,
            },
          ]}
          onFocus={() => setFocusedInput('email')}
          onBlur={() => setFocusedInput(null)}
          placeholder="Enter your driver email"
          placeholderTextColor={colors.day.mutedForeground}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {/* Password Field */}
        <Text style={{ color: colors.day.foreground, marginBottom: 6, fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3 }}>
          PASSWORD
        </Text>
        <TextInput 
          style={[
            themeStyles.input,
            {
              marginBottom: 24,
              borderColor: focusedInput === 'password' ? colors.primary[500] : colors.day.cardBorder,
              backgroundColor: focusedInput === 'password' ? '#FFFFFF' : colors.day.input,
            },
          ]}
          onFocus={() => setFocusedInput('password')}
          onBlur={() => setFocusedInput(null)}
          placeholder="Enter your password"
          placeholderTextColor={colors.day.mutedForeground}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {/* Sign In Button (Signature Matte Orange with tactile amber glow) */}
        <TouchableOpacity 
          style={[
            themeStyles.btnPrimary,
            { opacity: loading ? 0.75 : 1 },
          ]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={themeStyles.btnPrimaryText}>SIGN IN</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
