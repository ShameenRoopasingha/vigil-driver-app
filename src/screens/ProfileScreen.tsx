import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';

type ProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigationProp>();

  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);

  // Email form state
  const [currentEmail, setCurrentEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // 1. Instant load from local storage
      const localStr = await AsyncStorage.getItem('driverData');
      if (localStr) {
        try {
          const local = JSON.parse(localStr);
          setDriverName(local.name || '');
          setCurrentEmail(local.email || '');
          setNewEmail(local.email || '');
          setCompanyName(local.companyName || '');
          setCompanyLogoUrl(local.companyLogoUrl || null);
        } catch {}
      }

      // 2. Fresh fetch from server
      const res = await apiClient.get('/driver/profile');
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setDriverName(d.name || '');
        setCurrentEmail(d.email || '');
        setNewEmail(d.email || '');
        setCompanyName(d.companyName || '');
        setCompanyLogoUrl(d.companyLogoUrl || null);

        // Update local storage
        await AsyncStorage.setItem('driverData', JSON.stringify(d));
      }
    } catch (error: any) {
      console.error('Error fetching driver profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Validation Error', 'Email address cannot be empty.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    if (trimmed === currentEmail.toLowerCase()) {
      Alert.alert('No Change', 'The email address is already set to ' + trimmed);
      return;
    }

    setEmailSaving(true);
    try {
      const res = await apiClient.put('/driver/profile', { email: trimmed });
      if (res.data?.success) {
        setCurrentEmail(trimmed);
        if (res.data.data?.token) {
          await AsyncStorage.setItem('driverToken', res.data.data.token);
        }
        if (res.data.data?.driver) {
          await AsyncStorage.setItem('driverData', JSON.stringify(res.data.data.driver));
        }
        Alert.alert('Success', 'Your email address has been updated successfully!');
      } else {
        Alert.alert('Update Failed', res.data?.error || 'Could not update email');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Network error while updating email';
      Alert.alert('Update Failed', msg);
    } finally {
      setEmailSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Validation Error', 'Please enter your current password.');
      return;
    }

    if (!newPassword) {
      Alert.alert('Validation Error', 'Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Validation Error', 'New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'New password and confirm password do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await apiClient.put('/driver/profile', {
        currentPassword,
        newPassword,
      });

      if (res.data?.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        Alert.alert('Success', 'Your password has been changed successfully!');
      } else {
        Alert.alert('Update Failed', res.data?.error || 'Could not update password');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Network error while updating password';
      Alert.alert('Password Error', msg);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.clear();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Top Header */}
        <View className="bg-white px-4 py-3.5 border-b border-slate-200 flex-row items-center justify-between shadow-sm">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="flex-row items-center py-1 pr-3"
            activeOpacity={0.7}
          >
            <Text className="text-blue-600 font-bold text-base mr-1">‹</Text>
            <Text className="text-blue-600 font-bold text-base">Dashboard</Text>
          </TouchableOpacity>

          <Text className="text-base font-extrabold text-slate-800">Driver Profile</Text>

          <View style={{ width: 60 }} />
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-slate-500 text-xs mt-3 font-medium">Loading profile...</Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1 px-4 py-4"
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Identity Card */}
            <View className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-4">
              <View className="flex-row items-center">
                {companyLogoUrl ? (
                  <View className="w-14 h-14 bg-white rounded-2xl border border-slate-200 p-1 items-center justify-center mr-4 shadow-sm">
                    <Image
                      source={{ uri: companyLogoUrl }}
                      style={{ width: 48, height: 48, borderRadius: 10 }}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View className="w-14 h-14 bg-blue-100 rounded-2xl items-center justify-center border border-blue-200 mr-4">
                    <Text className="text-blue-800 font-black text-xl">
                      {(driverName || 'DR').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-lg font-black text-slate-900">{driverName || 'Driver'}</Text>
                    <View className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <Text className="text-[10px] font-bold text-emerald-700 tracking-wider">DRIVER</Text>
                    </View>
                  </View>
                  <Text className="text-xs font-semibold text-slate-500">
                    {companyName || 'Tour Transport Company'}
                  </Text>
                  <Text className="text-[11px] text-slate-400 mt-0.5">
                    Current Login: {currentEmail || 'Not configured'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Email Address Section */}
            <View className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-extrabold text-slate-900">Email Address</Text>
                <Text className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                  Account Login
                </Text>
              </View>
              <Text className="text-xs text-slate-500 mb-4 leading-4">
                Used to log into the driver mobile application and receive booking schedules.
              </Text>

              <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Driver Email
              </Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium text-sm mb-3"
                placeholder="driver@example.com"
                value={newEmail}
                onChangeText={setNewEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />

              <TouchableOpacity
                onPress={handleUpdateEmail}
                disabled={emailSaving || newEmail.trim().toLowerCase() === currentEmail.toLowerCase()}
                activeOpacity={0.8}
                className={`py-3 rounded-xl items-center flex-row justify-center ${
                  newEmail.trim().toLowerCase() === currentEmail.toLowerCase()
                    ? 'bg-slate-100 border border-slate-200'
                    : 'bg-blue-600 shadow-sm'
                }`}
              >
                {emailSaving ? (
                  <>
                    <ActivityIndicator size="small" color="#ffffff" className="mr-2" />
                    <Text className="text-white font-bold text-sm">Saving Email...</Text>
                  </>
                ) : (
                  <Text
                    className={`font-bold text-sm ${
                      newEmail.trim().toLowerCase() === currentEmail.toLowerCase()
                        ? 'text-slate-400'
                        : 'text-white'
                    }`}
                  >
                    {newEmail.trim().toLowerCase() === currentEmail.toLowerCase()
                      ? 'Email Up to Date'
                      : 'Save Email Address'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Change Password Section */}
            <View className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-extrabold text-slate-900">Change Password</Text>
                <Text className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Security
                </Text>
              </View>
              <Text className="text-xs text-slate-500 mb-4 leading-4">
                Enter your current password to authorize, then set your new password (minimum 6 characters).
              </Text>

              {/* Current Password */}
              <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Current Password
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-1 mb-3">
                <TextInput
                  className="flex-1 py-2.5 text-slate-900 font-medium text-sm"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowCurrentPass(!showCurrentPass)}
                  className="p-1.5"
                >
                  <Text className="text-xs font-bold text-slate-500">
                    {showCurrentPass ? 'HIDE' : 'SHOW'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* New Password */}
              <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                New Password
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-1 mb-3">
                <TextInput
                  className="flex-1 py-2.5 text-slate-900 font-medium text-sm"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowNewPass(!showNewPass)}
                  className="p-1.5"
                >
                  <Text className="text-xs font-bold text-slate-500">
                    {showNewPass ? 'HIDE' : 'SHOW'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Confirm New Password */}
              <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Confirm New Password
              </Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-1 mb-4">
                <TextInput
                  className="flex-1 py-2.5 text-slate-900 font-medium text-sm"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPass(!showConfirmPass)}
                  className="p-1.5"
                >
                  <Text className="text-xs font-bold text-slate-500">
                    {showConfirmPass ? 'HIDE' : 'SHOW'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                activeOpacity={0.8}
                className={`py-3 rounded-xl items-center flex-row justify-center ${
                  !currentPassword || !newPassword || !confirmPassword
                    ? 'bg-slate-100 border border-slate-200'
                    : 'bg-emerald-600 shadow-sm'
                }`}
              >
                {passwordSaving ? (
                  <>
                    <ActivityIndicator size="small" color="#ffffff" className="mr-2" />
                    <Text className="text-white font-bold text-sm">Updating Password...</Text>
                  </>
                ) : (
                  <Text
                    className={`font-bold text-sm ${
                      !currentPassword || !newPassword || !confirmPassword
                        ? 'text-slate-400'
                        : 'text-white'
                    }`}
                  >
                    Update Password
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Sign Out Card */}
            <View className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <TouchableOpacity
                onPress={handleLogout}
                activeOpacity={0.8}
                className="bg-red-50 border border-red-200 py-3 rounded-xl items-center flex-row justify-center"
              >
                <Text className="text-red-600 font-bold text-sm">Sign Out from this Device</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
