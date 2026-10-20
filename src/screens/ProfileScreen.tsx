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
  Vibration,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';
import {
  DriverProfileDetailsSchema,
  DriverEmailUpdateSchema,
  DriverPasswordChangeSchema,
} from '../validations';

type ProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

const AVATAR_PRESETS = [
  { id: 'suit', label: 'Chauffeur', uri: 'https://api.dicebear.com/7.x/personas/png?seed=Lucas&backgroundColor=ffd5dc' },
  { id: 'sunglasses', label: 'Executive', uri: 'https://api.dicebear.com/7.x/personas/png?seed=Captain&backgroundColor=c0aede' },
  { id: 'safari', label: 'Safari Guide', uri: 'https://api.dicebear.com/7.x/personas/png?seed=Safari&backgroundColor=d1d4f9' },
  { id: 'friendly', label: 'Friendly', uri: 'https://api.dicebear.com/7.x/personas/png?seed=Alex&backgroundColor=ffdfbf' },
  { id: 'cap', label: 'Driver Pro', uri: 'https://api.dicebear.com/7.x/personas/png?seed=Oliver&backgroundColor=b6e3f4' },
  { id: 'guide', label: 'Tour Guide', uri: 'https://api.dicebear.com/7.x/adventurer/png?seed=Guide&backgroundColor=ffd5dc' },
];

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigationProp>();

  const [loading, setLoading] = useState(true);
  const [driverName, setDriverName] = useState('');
  const [editName, setEditName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);
  const [initialDriverName, setInitialDriverName] = useState('');
  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string | null>(null);
  const [detailsSaving, setDetailsSaving] = useState(false);

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
          setEditName(local.name || '');
          setInitialDriverName(local.name || '');
          setAvatarUrl(local.avatarUrl || null);
          setInitialAvatarUrl(local.avatarUrl || null);
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
        setEditName(d.name || '');
        setInitialDriverName(d.name || '');
        setAvatarUrl(d.avatarUrl || null);
        setInitialAvatarUrl(d.avatarUrl || null);
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

  const handleUpdateDetails = async () => {
    const trimmedName = editName.trim();
    const validation = DriverProfileDetailsSchema.safeParse({
      name: trimmedName,
      avatarUrl: avatarUrl,
    });

    if (!validation.success) {
      Alert.alert('Validation Error', validation.error.issues[0]?.message || 'Please check your name');
      return;
    }

    setDetailsSaving(true);
    try {
      const res = await apiClient.put('/driver/profile', {
        name: trimmedName,
        avatarUrl: avatarUrl || null,
      });

      if (res.data?.success) {
        setDriverName(trimmedName);
        setInitialDriverName(trimmedName);
        setInitialAvatarUrl(avatarUrl || null);

        if (res.data.data?.driver) {
          await AsyncStorage.setItem('driverData', JSON.stringify(res.data.data.driver));
        }

        Alert.alert('Success', 'Your driver name and profile photo have been updated successfully!');
      } else {
        Alert.alert('Update Failed', res.data?.error || 'Could not update profile');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Network error updating profile';
      Alert.alert('Update Failed', msg);
    } finally {
      setDetailsSaving(false);
    }
  };

  const handleApplyCustomUrl = () => {
    const url = customUrlInput.trim();
    if (!url) {
      Alert.alert('Invalid URL', 'Please enter a valid image URL');
      return;
    }
    setAvatarUrl(url);
    setShowCustomUrlInput(false);
    setCustomUrlInput('');
  };

  const handlePickFromFiles = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your device photos & files to select a profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let photoUri = asset.uri;
        if (asset.base64) {
          const mimeType = asset.mimeType || 'image/jpeg';
          photoUri = `data:${mimeType};base64,${asset.base64}`;
        }
        setAvatarUrl(photoUri);
        Vibration.vibrate(10);
      }
    } catch (err: any) {
      console.error('File picker error:', err);
      Alert.alert('Photo Selection', err.message || 'Could not open device files.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow camera permission to take a new profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let photoUri = asset.uri;
        if (asset.base64) {
          const mimeType = asset.mimeType || 'image/jpeg';
          photoUri = `data:${mimeType};base64,${asset.base64}`;
        }
        setAvatarUrl(photoUri);
        Vibration.vibrate(10);
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      Alert.alert('Camera', err.message || 'Could not open camera.');
    }
  };

  const handleUpdateEmail = async () => {
    const validation = DriverEmailUpdateSchema.safeParse({ email: newEmail });
    if (!validation.success) {
      Alert.alert('Validation Error', validation.error.issues[0]?.message || 'Please enter a valid email address.');
      return;
    }

    const trimmed = validation.data.email.toLowerCase();
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
    const validation = DriverPasswordChangeSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    if (!validation.success) {
      Alert.alert('Validation Error', validation.error.issues[0]?.message || 'Please verify your password details.');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await apiClient.put('/driver/profile', {
        currentPassword: validation.data.currentPassword,
        newPassword: validation.data.newPassword,
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

  const isDetailsDirty = editName.trim() !== initialDriverName || avatarUrl !== initialAvatarUrl;

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Top Header matching Admin App */}
        <View style={{ backgroundColor: '#ffffff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: 10 }}
              activeOpacity={0.7}
            >
              <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '800' }}>← Back</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>Settings & Profile</Text>
          </View>

          {/* Space reserved for Top-Right Arc Nav Button */}
          <View style={{ width: 44, height: 40 }} />
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-slate-500 text-xs mt-3 font-medium">Loading profile...</Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1 px-4 py-4"
            contentContainerStyle={{ paddingBottom: 60 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Identity Card */}
            <View className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-4">
              <View className="flex-row items-center">
                {avatarUrl ? (
                  <View className="w-16 h-16 rounded-full border-2 border-blue-500 p-0.5 mr-4 shadow-sm bg-blue-50 items-center justify-center">
                    <Image
                      source={{ uri: avatarUrl }}
                      style={{ width: 58, height: 58, borderRadius: 29 }}
                      resizeMode="cover"
                    />
                  </View>
                ) : (
                  <View className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center border-2 border-blue-300 mr-4">
                    <Text className="text-blue-800 font-black text-2xl">
                      {(driverName || 'DR').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-lg font-black text-slate-900" numberOfLines={1}>
                      {driverName || 'Driver'}
                    </Text>
                    <View className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <Text className="text-[10px] font-bold text-emerald-700 tracking-wider">CHAUFFEUR</Text>
                    </View>
                  </View>
                  <Text className="text-xs font-semibold text-slate-500" numberOfLines={1}>
                    {companyName || 'Tour Transport Company'}
                  </Text>
                  <Text className="text-[11px] text-slate-400 mt-0.5" numberOfLines={1}>
                    Login: {currentEmail || 'Not configured'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Edit Name & Profile Photo Section */}
            <View className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-extrabold text-slate-900">Driver Name & Photo</Text>
                <Text className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Public Profile
                </Text>
              </View>
              <Text className="text-xs text-slate-500 mb-4 leading-4">
                This name and profile picture appear on passenger itineraries and welcome greeting.
              </Text>

              {/* Avatar Selector Gallery */}
              <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                Profile Photo & Avatar
              </Text>

              {/* 2 Primary Device Action Cards: Browse Files + Camera */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handlePickFromFiles}
                  style={{
                    flex: 1,
                    backgroundColor: '#eff6ff',
                    borderWidth: 1.5,
                    borderColor: '#93c5fd',
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#3b82f6',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 3,
                    elevation: 1,
                  }}
                >
                  <Text style={{ fontSize: 22, marginBottom: 3 }}>📁</Text>
                  <Text style={{ color: '#1d4ed8', fontWeight: '800', fontSize: 13 }}>
                    Browse Files
                  </Text>
                  <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '600', marginTop: 1 }}>
                    Gallery & Device
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleTakePhoto}
                  style={{
                    flex: 1,
                    backgroundColor: '#ecfdf5',
                    borderWidth: 1.5,
                    borderColor: '#a7f3d0',
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#10b981',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 3,
                    elevation: 1,
                  }}
                >
                  <Text style={{ fontSize: 22, marginBottom: 3 }}>📷</Text>
                  <Text style={{ color: '#065f46', fontWeight: '800', fontSize: 13 }}>
                    Take Photo
                  </Text>
                  <Text style={{ color: '#64748b', fontSize: 10, fontWeight: '600', marginTop: 1 }}>
                    Use Camera
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
                <Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '800', marginHorizontal: 8, letterSpacing: 0.5 }}>
                  OR SELECT AVATAR
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-4"
                contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
              >
                {/* Reset to Initials Monogram */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setAvatarUrl(null)}
                  className={`w-14 h-14 rounded-2xl items-center justify-center border-2 ${
                    avatarUrl === null ? 'border-blue-600 bg-blue-100' : 'border-slate-200 bg-slate-100'
                  }`}
                >
                  <Text className="text-slate-800 font-extrabold text-xs">
                    {(driverName || 'DR').substring(0, 2).toUpperCase()}
                  </Text>
                  <Text className="text-[9px] text-slate-500 font-semibold mt-0.5">Initials</Text>
                </TouchableOpacity>

                {/* Preset Avatars */}
                {AVATAR_PRESETS.map((preset) => {
                  const isSelected = avatarUrl === preset.uri;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      activeOpacity={0.8}
                      onPress={() => setAvatarUrl(preset.uri)}
                      className={`w-14 h-14 rounded-2xl items-center justify-center border-2 p-1 ${
                        isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <Image
                        source={{ uri: preset.uri }}
                        style={{ width: 38, height: 38, borderRadius: 19 }}
                        resizeMode="cover"
                      />
                      <Text
                        className={`text-[9px] font-bold mt-0.5 ${
                          isSelected ? 'text-blue-700' : 'text-slate-500'
                        }`}
                        numberOfLines={1}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Custom Photo URL trigger */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowCustomUrlInput(!showCustomUrlInput)}
                  className="w-14 h-14 rounded-2xl items-center justify-center border-2 border-dashed border-slate-300 bg-slate-50"
                >
                  <Text className="text-base">🔗</Text>
                  <Text className="text-[9px] text-slate-500 font-bold mt-0.5">Link</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Custom Image URL Drawer */}
              {showCustomUrlInput && (
                <View className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4">
                  <Text className="text-xs font-bold text-slate-700 mb-1.5">Paste Web Image Link</Text>
                  <TextInput
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 mb-2"
                    placeholder="https://example.com/driver-photo.jpg"
                    value={customUrlInput}
                    onChangeText={setCustomUrlInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View className="flex-row justify-end gap-2">
                    <TouchableOpacity
                      onPress={() => setShowCustomUrlInput(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-200"
                    >
                      <Text className="text-xs font-bold text-slate-700">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleApplyCustomUrl}
                      className="px-3 py-1.5 rounded-lg bg-blue-600"
                    >
                      <Text className="text-xs font-bold text-white">Apply Photo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Name Input */}
              <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Chauffeur Full Name
              </Text>
              <TextInput
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium text-sm mb-4"
                placeholder="Enter your full name"
                value={editName}
                onChangeText={setEditName}
                autoCorrect={false}
              />

              <TouchableOpacity
                onPress={handleUpdateDetails}
                disabled={detailsSaving || !isDetailsDirty}
                activeOpacity={0.8}
                className={`py-3 rounded-xl items-center flex-row justify-center ${
                  !isDetailsDirty
                    ? 'bg-slate-100 border border-slate-200'
                    : 'bg-emerald-600 shadow-sm'
                }`}
              >
                {detailsSaving ? (
                  <>
                    <ActivityIndicator size="small" color="#ffffff" className="mr-2" />
                    <Text className="text-white font-bold text-sm">Saving Changes...</Text>
                  </>
                ) : (
                  <Text
                    className={`font-bold text-sm ${
                      !isDetailsDirty ? 'text-slate-400' : 'text-white'
                    }`}
                  >
                    {!isDetailsDirty ? 'Profile Up to Date' : 'Save Name & Photo'}
                  </Text>
                )}
              </TouchableOpacity>
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

            {/* Sign Out Card (Settings) */}
            <View style={{ backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#0f172a', marginBottom: 4 }}>Account Session</Text>
              <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 18 }}>
                Sign out of this chauffeur account on this mobile device. You will need your login credentials to sign back in.
              </Text>
              <TouchableOpacity
                onPress={handleLogout}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#fef2f2',
                  borderWidth: 1.5,
                  borderColor: '#fecaca',
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 16 }}>🚪</Text>
                <Text style={{ color: '#dc2626', fontWeight: '900', fontSize: 13 }}>
                  Sign Out from this Device
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
