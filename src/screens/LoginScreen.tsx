import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<LoginScreenNavigationProp>();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/driver/login', { email, password });
      
      if (response.data?.success && response.data?.data?.token) {
        await AsyncStorage.setItem('driverToken', response.data.data.token);
        await AsyncStorage.setItem('driverData', JSON.stringify(response.data.data.driver));
        navigation.replace('Dashboard');
      } else {
        Alert.alert('Login Failed', response.data?.error || 'Invalid credentials');
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert('Login Failed', error.response?.data?.error || 'Cannot connect to server. Check IP address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 justify-center px-6">
      <View className="items-center mb-8">
        <View className="bg-white p-3.5 rounded-2xl shadow-md border border-gray-100 mb-3 items-center justify-center">
          <Image 
            source={require('../../assets/logo-icon.png')} 
            style={{ width: 68, height: 68 }} 
            resizeMode="contain" 
          />
        </View>
        <Text className="text-3xl font-extrabold text-slate-900 tracking-tight">VIGIL</Text>
        <Text className="text-blue-600 uppercase tracking-widest text-xs font-bold mt-1">Driver Portal</Text>
        <Text className="text-gray-400 text-xs mt-1 text-center">Fleet & Travel Management</Text>
      </View>

      <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <Text className="text-xl font-bold text-gray-800 mb-6 text-center">Welcome Back</Text>
        
        <Text className="text-gray-600 mb-2 text-sm font-medium">Email Address</Text>
        <TextInput 
          className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-4 text-gray-800"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text className="text-gray-600 mb-2 text-sm font-medium">Password</Text>
        <TextInput 
          className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-6 text-gray-800"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity 
          className="bg-blue-600 rounded-lg py-4 flex-row justify-center items-center"
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-lg">Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
