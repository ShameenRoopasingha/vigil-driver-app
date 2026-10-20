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

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
        toast.success('Welcome back!', 'Logged in successfully');
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc', justifyContent: 'center', paddingHorizontal: 24 }}>
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <View style={{ backgroundColor: '#ffffff', padding: 14, borderRadius: 24, borderWidth: 1.5, borderColor: '#e2e8f0', marginBottom: 12, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 }}>
          <Image 
            source={require('../../assets/logo-icon.png')} 
            style={{ width: 64, height: 64 }} 
            resizeMode="contain" 
          />
        </View>
        <Text style={{ fontSize: 32, fontWeight: '900', color: '#0f172a', letterSpacing: 1.5 }}>VIGIL</Text>
        <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', borderWidth: 1, borderColor: '#10b981', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 20, marginTop: 6 }}>
          <Text style={{ color: '#047857', fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>
            Chauffeur & Fleet Portal
          </Text>
        </View>
        <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 4 }}>Fleet & Travel Management</Text>
      </View>

      <View style={{ backgroundColor: '#ffffff', padding: 22, borderRadius: 24, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 4, textAlign: 'center' }}>Driver Sign In</Text>
        <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 20, textAlign: 'center' }}>Access your assigned tours & GPS radar</Text>
        
        <Text style={{ color: '#334155', marginBottom: 6, fontSize: 13, fontWeight: '800' }}>Email Address</Text>
        <TextInput 
          style={{ backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, fontSize: 14, color: '#0f172a' }}
          placeholder="Enter your driver email"
          placeholderTextColor="#94a3b8"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={{ color: '#334155', marginBottom: 6, fontSize: 13, fontWeight: '800' }}>Password</Text>
        <TextInput 
          style={{ backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 22, fontSize: 14, color: '#0f172a' }}
          placeholder="Enter your password"
          placeholderTextColor="#94a3b8"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity 
          style={{ backgroundColor: '#10b981', borderRadius: 14, paddingVertical: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 }}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 16, letterSpacing: 0.5 }}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
