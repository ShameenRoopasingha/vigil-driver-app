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
import { useTheme } from '../context/ThemeContext';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const { isDark, colors: themeColors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'email' | 'password' | null>(null);
  const navigation = useNavigation<LoginScreenNavigationProp>();

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    const validation = DriverLoginInputSchema.safeParse({ email: trimmedEmail, password: trimmedPassword });
    if (!validation.success) {
      toast.warning('Validation Error', validation.error.issues[0]?.message || 'Please enter your driver email and password');
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
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background, justifyContent: 'center', paddingHorizontal: 24 }}>
      {/* Brand Header */}
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <View
          style={{
            backgroundColor: themeColors.card,
            padding: 16,
            borderRadius: 26,
            borderWidth: 1.5,
            borderColor: themeColors.cardBorder,
            marginBottom: 14,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
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

        <Text style={{ fontSize: 32, fontWeight: '900', color: themeColors.textPrimary, letterSpacing: 2 }}>
          VIGIL
        </Text>

        {/* Signature Matte Orange Pill Chip */}
        <View
          style={{
            backgroundColor: isDark ? 'rgba(232, 115, 42, 0.18)' : colors.primary[50],
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
          <Text style={{ color: isDark ? '#FDBA74' : colors.primary[700], fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Chauffeur & Fleet Portal
          </Text>
        </View>

        <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 6 }}>
          Tour Operations & Telematics
        </Text>
      </View>

      {/* Login Card */}
      <View
        style={{
          backgroundColor: themeColors.card,
          padding: 24,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: themeColors.cardBorder,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.15,
          shadowRadius: 16,
          elevation: 5,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '900', color: themeColors.textPrimary, marginBottom: 4, textAlign: 'center' }}>
          Driver Sign In
        </Text>
        <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 22, textAlign: 'center' }}>
          Access your assigned tours & GPS radar
        </Text>
        
        {/* Email Field */}
        <Text style={{ color: themeColors.textPrimary, marginBottom: 6, fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3 }}>
          EMAIL ADDRESS
        </Text>
        <TextInput 
          style={[
            themeStyles.input,
            {
              marginBottom: 16,
              borderColor: focusedInput === 'email' ? colors.primary[500] : themeColors.cardBorder,
              backgroundColor: focusedInput === 'email' ? (isDark ? '#161E2E' : '#FFFFFF') : (isDark ? '#141C2B' : colors.day.input),
              color: themeColors.textPrimary,
            },
          ]}
          onFocus={() => setFocusedInput('email')}
          onBlur={() => setFocusedInput(null)}
          placeholder="Enter your driver email"
          placeholderTextColor={themeColors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {/* Password Field */}
        <Text style={{ color: themeColors.textPrimary, marginBottom: 6, fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3 }}>
          PASSWORD
        </Text>
        <TextInput 
          style={[
            themeStyles.input,
            {
              marginBottom: 24,
              borderColor: focusedInput === 'password' ? colors.primary[500] : themeColors.cardBorder,
              backgroundColor: focusedInput === 'password' ? (isDark ? '#161E2E' : '#FFFFFF') : (isDark ? '#141C2B' : colors.day.input),
              color: themeColors.textPrimary,
            },
          ]}
          onFocus={() => setFocusedInput('password')}
          onBlur={() => setFocusedInput(null)}
          placeholder="Enter your password"
          placeholderTextColor={themeColors.textMuted}
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
