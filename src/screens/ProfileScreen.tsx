import React, { useState, useEffect, useCallback } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { apiClient } from '../api/client';
import {
  DriverProfileDetailsSchema,
  DriverEmailUpdateSchema,
  DriverPasswordChangeSchema,
} from '../validations';
import { toast } from '../utils/toast';
import { colors, themeStyles } from '../theme';
import { useTheme } from '../context/ThemeContext';

type ProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Profile'>;

const makeSvgAvatar = (emoji: string, bg: string) =>
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="${encodeURIComponent(bg)}"/><text x="50%" y="54%" font-size="76" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`;

const AVATAR_PRESETS = [
  { id: 'chauffeur', label: 'Chauffeur', emoji: '🤵‍♂️', bg: '#fef3c7', uri: makeSvgAvatar('🤵‍♂️', '#fef3c7') },
  { id: 'executive', label: 'Executive', emoji: '🕶️', bg: '#ede9fe', uri: makeSvgAvatar('🕶️', '#ede9fe') },
  { id: 'safari', label: 'Safari', emoji: '🦁', bg: '#ffedd5', uri: makeSvgAvatar('🦁', '#ffedd5') },
  { id: 'pro', label: 'Pro Pilot', emoji: '🧢', bg: '#e0f2fe', uri: makeSvgAvatar('🧢', '#e0f2fe') },
  { id: 'guide', label: 'Tour Guide', emoji: '🧭', bg: '#dcfce7', uri: makeSvgAvatar('🧭', '#dcfce7') },
  { id: 'friendly', label: 'Friendly', emoji: '😊', bg: '#fae8ff', uri: makeSvgAvatar('😊', '#fae8ff') },
];

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigationProp>();
  const { isDark, colors: themeColors, setTheme } = useTheme();

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

        // Keep local cache up to date
        await AsyncStorage.setItem('driverData', JSON.stringify(d));
      }
    } catch (err) {
      console.warn('[ProfileScreen] Could not refresh profile from API:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const handleUpdateDetails = async () => {
    const validation = DriverProfileDetailsSchema.safeParse({ name: editName });
    if (!validation.success) {
      toast.warning('Validation Error', validation.error.issues[0]?.message || 'Please check your name input.');
      return;
    }

    const trimmedName = validation.data.name;
    const isNameChanged = trimmedName !== initialDriverName;
    const isAvatarChanged = avatarUrl !== initialAvatarUrl;

    if (!isNameChanged && !isAvatarChanged) {
      toast.info('No Changes', 'Your profile details are already up to date.');
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

        Vibration.vibrate(12);
        toast.success('Profile Updated', 'Your chauffeur name and profile photo have been updated successfully!');
      } else {
        toast.error('Update Failed', res.data?.error || 'Could not update profile');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Network error updating profile';
      toast.error('Update Failed', msg);
    } finally {
      setDetailsSaving(false);
    }
  };

  const handleApplyCustomUrl = () => {
    const url = customUrlInput.trim();
    if (!url) {
      toast.warning('Invalid URL', 'Please enter a valid image URL');
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
        toast.warning(
          'Permission Required',
          'Please allow access to your device photos & files to select a profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
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
      toast.error('Photo Selection', err.message || 'Could not open device files.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        toast.warning(
          'Permission Required',
          'Please allow camera permission to take a new profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
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
      toast.error('Camera', err.message || 'Could not open camera.');
    }
  };

  const handleUpdateEmail = async () => {
    const validation = DriverEmailUpdateSchema.safeParse({ email: newEmail });
    if (!validation.success) {
      toast.warning('Validation Error', validation.error.issues[0]?.message || 'Please enter a valid email address.');
      return;
    }

    const trimmed = validation.data.email.toLowerCase();
    if (trimmed === currentEmail.toLowerCase()) {
      toast.info('No Change', 'The email address is already set to ' + trimmed);
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
        Vibration.vibrate(12);
        toast.success('Success', 'Your email address has been updated successfully!');
      } else {
        toast.error('Update Failed', res.data?.error || 'Could not update email');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Network error while updating email';
      toast.error('Update Failed', msg);
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
      toast.warning('Validation Error', validation.error.issues[0]?.message || 'Please verify your password details.');
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
        Vibration.vibrate(12);
        toast.success('Password Updated', 'Your security password has been changed successfully!');
      } else {
        toast.error('Update Failed', res.data?.error || 'Could not change password');
      }
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message || 'Network error while changing password';
      toast.error('Update Failed', msg);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of this device?', [
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
  const isEmailDirty = newEmail.trim().toLowerCase() !== currentEmail.toLowerCase() && newEmail.trim().length > 0;
  const isPasswordReady = currentPassword.length > 0 && newPassword.length >= 6 && confirmPassword.length >= 6;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Sleek Top Header */}
        <View
          style={{
            backgroundColor: themeColors.card,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.cardBorder,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[
                themeStyles.btnSecondary,
                {
                  backgroundColor: isDark ? '#1e293b' : colors.day.secondary,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : colors.day.secondaryBorder,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  marginRight: 12,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={[themeStyles.btnSecondaryText, { color: themeColors.textPrimary }]}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '900', color: themeColors.textPrimary }}>Settings & Profile</Text>
          </View>

          {/* Reserved space for top-right Arc Nav button */}
          <View style={{ width: 44, height: 40 }} />
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
            <Text style={{ color: themeColors.textMuted, fontSize: 12, marginTop: 12, fontWeight: '600' }}>
              Loading profile settings...
            </Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14 }}
            contentContainerStyle={{ paddingBottom: 50 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Identity Hero Card (Fixed Badge Layout) */}
            <View
              style={{
                backgroundColor: themeColors.card,
                padding: 16,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: themeColors.cardBorder,
                marginBottom: 14,
                shadowColor: isDark ? '#000000' : colors.day.foreground,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 5,
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {avatarUrl ? (
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      borderWidth: 2.5,
                      borderColor: colors.primary[500],
                      padding: 2,
                      marginRight: 14,
                      backgroundColor: colors.primary[50],
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Image
                      source={{ uri: avatarUrl }}
                      style={{ width: 56, height: 56, borderRadius: 28 }}
                      resizeMode="cover"
                    />
                  </View>
                ) : (
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: colors.primary[50],
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1.5,
                      borderColor: colors.primary[300],
                      marginRight: 14,
                    }}
                  >
                    <Text style={{ color: colors.primary[600], fontWeight: '900', fontSize: 22 }}>
                      {(driverName || 'DR').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  {/* Name & Badge Row */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 3,
                    }}
                  >
                    <Text
                      style={{ fontSize: 17, fontWeight: '900', color: themeColors.textPrimary, flex: 1, marginRight: 8 }}
                      numberOfLines={1}
                    >
                      {driverName || 'Chauffeur'}
                    </Text>
                    <View style={themeStyles.brandBadge}>
                      <Text style={themeStyles.brandBadgeText}>
                        CHAUFFEUR
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {companyLogoUrl ? (
                      <Image source={{ uri: companyLogoUrl }} style={{ width: 14, height: 14, borderRadius: 3, marginRight: 6 }} resizeMode="contain" />
                    ) : (
                      <Text style={{ fontSize: 12, marginRight: 4 }}>🏢</Text>
                    )}
                    <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.textSecondary, flex: 1 }} numberOfLines={1}>
                      {companyName || 'Tour Transport Company'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: themeColors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                    ✉️ {currentEmail || 'Not configured'}
                  </Text>
                </View>
              </View>
            </View>

            {/* 2. Driver Name & Photo Card */}
            <View
              style={{
                backgroundColor: themeColors.card,
                padding: 18,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: themeColors.cardBorder,
                marginBottom: 14,
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 5,
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: themeColors.textPrimary }}>Driver Name & Photo</Text>
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(232, 115, 42, 0.15)' : colors.primary[50],
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(232, 115, 42, 0.3)' : colors.primary[200],
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#FDBA74' : colors.primary[600] }}>Public Profile</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: themeColors.textSecondary, marginBottom: 14, lineHeight: 16 }}>
                This name and profile picture appear on passenger itineraries and welcome greeting.
              </Text>

              {/* Action Buttons: Browse Files & Take Photo */}
              <Text style={{ fontSize: 11, fontWeight: '800', color: themeColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Profile Photo & Avatar
              </Text>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handlePickFromFiles}
                  style={{
                    flex: 1,
                    backgroundColor: isDark ? '#161E2E' : colors.day.secondary,
                    borderWidth: 1.5,
                    borderColor: isDark ? '#28354D' : colors.day.secondaryBorder,
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 22, marginBottom: 2 }}>📁</Text>
                  <Text style={{ color: themeColors.textPrimary, fontWeight: '800', fontSize: 13 }}>Browse Files</Text>
                  <Text style={{ color: themeColors.textSecondary, fontSize: 10, fontWeight: '600', marginTop: 1 }}>
                    Gallery & Device
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleTakePhoto}
                  style={{
                    flex: 1,
                    backgroundColor: isDark ? 'rgba(232, 115, 42, 0.15)' : colors.primary[50],
                    borderWidth: 1.5,
                    borderColor: isDark ? 'rgba(232, 115, 42, 0.35)' : colors.primary[300],
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 22, marginBottom: 2 }}>📷</Text>
                  <Text style={{ color: isDark ? '#FDBA74' : colors.primary[700], fontWeight: '800', fontSize: 13 }}>Take Photo</Text>
                  <Text style={{ color: themeColors.textSecondary, fontSize: 10, fontWeight: '600', marginTop: 1 }}>
                    Use Camera
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: themeColors.cardBorder }} />
                <Text style={{ color: themeColors.textSecondary, fontSize: 10, fontWeight: '800', marginHorizontal: 8, letterSpacing: 0.5 }}>
                  OR SELECT AVATAR
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: themeColors.cardBorder }} />
              </View>

              {/* Avatar Selector Row - Perfectly Sized & Always Visible */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 14 }}
                contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
              >
                {/* Monogram Initials Option */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setAvatarUrl(null)}
                  style={{
                    width: 62,
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: avatarUrl === null ? '#dbeafe' : '#f1f5f9',
                      borderWidth: 2,
                      borderColor: avatarUrl === null ? '#2563eb' : '#cbd5e1',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ color: '#1e293b', fontWeight: '900', fontSize: 14 }}>
                      {(driverName || 'DR').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: avatarUrl === null ? '#2563eb' : '#64748b' }}>
                    Initials
                  </Text>
                </TouchableOpacity>

                {/* Preset Persona Avatars */}
                {AVATAR_PRESETS.map((preset) => {
                  const isSelected = avatarUrl === preset.uri;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      activeOpacity={0.8}
                      onPress={() => setAvatarUrl(preset.uri)}
                      style={{
                        width: 62,
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: preset.bg,
                          borderWidth: isSelected ? 2.5 : 1,
                          borderColor: isSelected ? '#2563eb' : '#cbd5e1',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 4,
                          shadowColor: isSelected ? '#2563eb' : 'transparent',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.2,
                          shadowRadius: 3,
                          elevation: isSelected ? 2 : 0,
                        }}
                      >
                        <Text style={{ fontSize: 24 }}>{preset.emoji}</Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: isSelected ? '#2563eb' : '#64748b',
                          textAlign: 'center',
                        }}
                        numberOfLines={1}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Custom Photo URL Drawer */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowCustomUrlInput(!showCustomUrlInput)}
                  style={{
                    width: 62,
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: isDark ? '#141C2B' : '#f8fafc',
                      borderWidth: 1.5,
                      borderStyle: 'dashed',
                      borderColor: isDark ? '#3B4A65' : '#94a3b8',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 4,
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>🔗</Text>
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: themeColors.textSecondary }}>Web Link</Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Web Image Link Input Drawer */}
              {showCustomUrlInput && (
                <View style={{ backgroundColor: isDark ? '#141C2B' : '#f8fafc', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: themeColors.cardBorder, marginBottom: 14 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: themeColors.textSecondary, marginBottom: 6 }}>Paste Image URL</Text>
                  <TextInput
                    style={{
                      backgroundColor: isDark ? '#0E131F' : '#ffffff',
                      borderWidth: 1,
                      borderColor: isDark ? '#2E3B52' : '#cbd5e1',
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 12,
                      color: themeColors.textPrimary,
                      marginBottom: 8,
                    }}
                    placeholder="https://example.com/photo.jpg"
                    placeholderTextColor={themeColors.textMuted}
                    value={customUrlInput}
                    onChangeText={setCustomUrlInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => setShowCustomUrlInput(false)}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: isDark ? '#1E293B' : '#e2e8f0' }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: themeColors.textSecondary }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleApplyCustomUrl}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.primary[500] }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#ffffff' }}>Apply Photo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Chauffeur Name Input */}
              <Text style={{ fontSize: 11, fontWeight: '800', color: themeColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Chauffeur Full Name
              </Text>
              <TextInput
                style={{
                  backgroundColor: isDark ? '#141C2B' : '#f8fafc',
                  borderWidth: 1.5,
                  borderColor: isDetailsDirty ? colors.primary[500] : themeColors.cardBorder,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  fontSize: 14,
                  fontWeight: '600',
                  color: themeColors.textPrimary,
                  marginBottom: isDetailsDirty ? 12 : 6,
                }}
                placeholder="Enter full name"
                placeholderTextColor={themeColors.textMuted}
                value={editName}
                onChangeText={setEditName}
                autoCorrect={false}
              />

              {/* Reactive Action / Status */}
              {isDetailsDirty ? (
                <TouchableOpacity
                  onPress={handleUpdateDetails}
                  disabled={detailsSaving}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: '#10b981',
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    shadowColor: '#10b981',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  {detailsSaving ? (
                    <>
                      <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13 }}>Saving Changes...</Text>
                    </>
                  ) : (
                    <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13 }}>💾 Save Name & Photo</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 }}>
                  <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: '700' }}>✓ Profile is up to date</Text>
                </View>
              )}
            </View>

            {/* Theme & Cockpit Appearance Card */}
            <View
              style={{
                backgroundColor: themeColors.card,
                padding: 18,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: themeColors.cardBorder,
                marginBottom: 14,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 5,
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: themeColors.textPrimary }}>
                  Cockpit Theme
                </Text>
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(234, 88, 12, 0.12)',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(234, 88, 12, 0.25)',
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#38bdf8' : '#ea580c' }}>
                    {isDark ? '🌙 NIGHT VISION' : '☀️ DAYLIGHT'}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: themeColors.textSecondary, marginBottom: 12, lineHeight: 16 }}>
                Switch between Alabaster daylight contrast and Midnight Obsidian cockpit night vision for road safety.
              </Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                {/* Day Mode Tile */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Vibration.vibrate(10);
                    setTheme('light');
                    toast.info('☀️ Day Mode Active', 'Alabaster daylight theme activated.');
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: !isDark ? '#FFFBEB' : '#0F172A',
                    borderWidth: !isDark ? 2 : 1,
                    borderColor: !isDark ? '#E8732A' : 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 14,
                    padding: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 24, marginBottom: 4 }}>☀️</Text>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: !isDark ? '#9A3412' : '#94A3B8' }}>
                    Day Mode
                  </Text>
                  <Text style={{ fontSize: 9.5, color: !isDark ? '#C2410C' : '#64748B', marginTop: 2 }}>
                    Alabaster Ceramic
                  </Text>
                </TouchableOpacity>

                {/* Night Mode Tile */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Vibration.vibrate(10);
                    setTheme('dark');
                    toast.info('🌙 Night Mode Active', 'Obsidian cockpit night vision activated.');
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: isDark ? '#111827' : '#F8FAFC',
                    borderWidth: isDark ? 2 : 1,
                    borderColor: isDark ? '#E8732A' : '#E2E8F0',
                    borderRadius: 14,
                    padding: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 24, marginBottom: 4 }}>🌙</Text>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: isDark ? '#F8FAFC' : '#64748B' }}>
                    Night Mode
                  </Text>
                  <Text style={{ fontSize: 9.5, color: isDark ? '#38BDF8' : '#94A3B8', marginTop: 2 }}>
                    Obsidian Cockpit
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Email Address Card */}
            <View
              style={{
                backgroundColor: themeColors.card,
                padding: 18,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: themeColors.cardBorder,
                marginBottom: 14,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 5,
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: themeColors.textPrimary }}>Email Address</Text>
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#f0fdf4',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#bbf7d0',
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#34D399' : '#16a34a' }}>Account Login</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: themeColors.textSecondary, marginBottom: 12, lineHeight: 16 }}>
                Used to log into the driver mobile application and receive booking schedules.
              </Text>

              <Text style={{ fontSize: 11, fontWeight: '800', color: themeColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Driver Email
              </Text>
              <TextInput
                style={{
                  backgroundColor: isDark ? '#141C2B' : '#f8fafc',
                  borderWidth: 1.5,
                  borderColor: isEmailDirty ? colors.primary[500] : themeColors.cardBorder,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  fontSize: 14,
                  fontWeight: '600',
                  color: themeColors.textPrimary,
                  marginBottom: isEmailDirty ? 12 : 6,
                }}
                placeholder="driver@example.com"
                placeholderTextColor={themeColors.textMuted}
                value={newEmail}
                onChangeText={setNewEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />

              {isEmailDirty ? (
                <TouchableOpacity
                  onPress={handleUpdateEmail}
                  disabled={emailSaving}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: colors.primary[500],
                    paddingVertical: 12,
                    borderRadius: 14,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    shadowColor: colors.primary[500],
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  {emailSaving ? (
                    <>
                      <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13 }}>Saving Email...</Text>
                    </>
                  ) : (
                    <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13 }}>💾 Save Email Address</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 }}>
                  <Text style={{ color: isDark ? '#34D399' : '#16a34a', fontSize: 12, fontWeight: '700' }}>✓ Email is verified and active</Text>
                </View>
              )}
            </View>

            {/* 4. Change Password Card */}
            <View
              style={{
                backgroundColor: themeColors.card,
                padding: 18,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: themeColors.cardBorder,
                marginBottom: 14,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 5,
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: themeColors.textPrimary }}>Change Password</Text>
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#fde68a',
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#FDE68A' : '#b45309' }}>Security</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: themeColors.textSecondary, marginBottom: 14, lineHeight: 16 }}>
                Enter your current password to authorize, then set your new password (minimum 6 characters).
              </Text>

              {/* Current Password */}
              <Text style={{ fontSize: 11, fontWeight: '800', color: themeColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
                Current Password
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? '#141C2B' : '#f8fafc',
                  borderWidth: 1.5,
                  borderColor: themeColors.cardBorder,
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  marginBottom: 10,
                }}
              >
                <TextInput
                  style={{ flex: 1, paddingVertical: 10, fontSize: 13, fontWeight: '600', color: themeColors.textPrimary }}
                  placeholder="Enter current password"
                  placeholderTextColor={themeColors.textMuted}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrentPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowCurrentPass(!showCurrentPass)}
                  style={{ padding: 8 }}
                >
                  <Text style={{ fontSize: 14 }}>{showCurrentPass ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              {/* New Password */}
              <Text style={{ fontSize: 11, fontWeight: '800', color: themeColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
                New Password
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? '#141C2B' : '#f8fafc',
                  borderWidth: 1.5,
                  borderColor: themeColors.cardBorder,
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  marginBottom: 10,
                }}
              >
                <TextInput
                  style={{ flex: 1, paddingVertical: 10, fontSize: 13, fontWeight: '600', color: themeColors.textPrimary }}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={themeColors.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowNewPass(!showNewPass)}
                  style={{ padding: 8 }}
                >
                  <Text style={{ fontSize: 14 }}>{showNewPass ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              {/* Confirm New Password */}
              <Text style={{ fontSize: 11, fontWeight: '800', color: themeColors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
                Confirm New Password
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? '#141C2B' : '#f8fafc',
                  borderWidth: 1.5,
                  borderColor: themeColors.cardBorder,
                  borderRadius: 14,
                  paddingHorizontal: 12,
                  marginBottom: 14,
                }}
              >
                <TextInput
                  style={{ flex: 1, paddingVertical: 10, fontSize: 13, fontWeight: '600', color: themeColors.textPrimary }}
                  placeholder="Re-enter new password"
                  placeholderTextColor={themeColors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPass(!showConfirmPass)}
                  style={{ padding: 8 }}
                >
                  <Text style={{ fontSize: 14 }}>{showConfirmPass ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={passwordSaving || !isPasswordReady}
                activeOpacity={0.8}
                style={{
                  backgroundColor: isPasswordReady ? '#10b981' : (isDark ? '#161E2E' : '#f1f5f9'),
                  borderWidth: 1,
                  borderColor: isPasswordReady ? '#059669' : (isDark ? '#28354D' : '#e2e8f0'),
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
              >
                {passwordSaving ? (
                  <>
                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13 }}>Updating Password...</Text>
                  </>
                ) : (
                  <Text
                    style={{
                      fontWeight: '800',
                      fontSize: 13,
                      color: isPasswordReady ? '#ffffff' : themeColors.textMuted,
                    }}
                  >
                    Update Password
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* 5. Account Session Card */}
            <View
              style={{
                backgroundColor: themeColors.card,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: themeColors.cardBorder,
                padding: 18,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 5,
                elevation: 2,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '900', color: themeColors.textPrimary, marginBottom: 4 }}>
                Account Session
              </Text>
              <Text style={{ fontSize: 11, color: themeColors.textSecondary, marginBottom: 14, lineHeight: 16 }}>
                Sign out of this chauffeur account on this mobile device. You will need your login credentials to sign back in.
              </Text>

              <TouchableOpacity
                onPress={handleLogout}
                activeOpacity={0.8}
                style={{
                  backgroundColor: isDark ? 'rgba(225, 29, 72, 0.12)' : '#fef2f2',
                  borderWidth: 1.5,
                  borderColor: isDark ? 'rgba(225, 29, 72, 0.35)' : '#fecaca',
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 15 }}>🔴</Text>
                <Text style={{ color: isDark ? '#FB7185' : '#dc2626', fontWeight: '900', fontSize: 13 }}>
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
