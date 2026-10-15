import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Linking, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { locationService, TrackingStatus } from '../services/locationService';

type ActiveTourRouteProp = RouteProp<RootStackParamList, 'ActiveTour'>;
type ActiveTourNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ActiveTour'>;

export default function ActiveTourScreen() {
  const route = useRoute<ActiveTourRouteProp>();
  const navigation = useNavigation<ActiveTourNavigationProp>();
  
  const { bookingId } = route.params;

  const [tour, setTour] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [meterReading, setMeterReading] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverReason, setHandoverReason] = useState('Medical / Sickness');
  const [handoverMeter, setHandoverMeter] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);

  // Emergency Breakdown State
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownReason, setBreakdownReason] = useState('Engine Failure / Overheating');
  const [breakdownMeter, setBreakdownMeter] = useState('');
  const [breakdownLocation, setBreakdownLocation] = useState('');
  const [breakdownNote, setBreakdownNote] = useState('');
  const [breakdownSubmitting, setBreakdownSubmitting] = useState(false);

  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>({
    isTracking: false,
    isMoving: false,
    activeBookingId: null,
    currentSpeed: 0,
    lastPingTime: null,
    pendingOfflineCount: 0,
    lastError: null,
  });

  const submitBreakdownReport = async () => {
    if (!breakdownMeter.trim()) {
      Alert.alert('Required', 'Please enter your current dashboard odometer reading. This is required for breakdown verification.');
      return;
    }

    setBreakdownSubmitting(true);
    try {
      const res = await apiClient.put(`/driver/tours/${bookingId}`, {
        action: 'REPORT_BREAKDOWN',
        reason: breakdownReason,
        meterReading: breakdownMeter.trim(),
        location: breakdownLocation.trim() || undefined,
        note: breakdownNote.trim() || undefined,
      });

      if (res.data?.success) {
        Alert.alert(
          'Breakdown Reported',
          'Company dispatch has been notified with your vehicle defect and location. Please park safely while replacement transport is arranged.'
        );
        setShowBreakdownModal(false);
        setBreakdownMeter('');
        setBreakdownLocation('');
        setBreakdownNote('');
        fetchTour();
      } else {
        Alert.alert('Error', res.data?.error || 'Failed to submit breakdown report.');
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.response?.data?.error || 'Network error while submitting breakdown report.');
    } finally {
      setBreakdownSubmitting(false);
    }
  };


  const submitHandoverRequest = async () => {
    if (!handoverMeter.trim()) {
      Alert.alert('Required', 'Please enter your current dashboard odometer reading. This is required for handover verification.');
      return;
    }

    setHandoverSubmitting(true);
    try {
      const res = await apiClient.put(`/driver/tours/${bookingId}`, {
        action: 'REQUEST_HANDOVER',
        reason: handoverReason,
        meterReading: handoverMeter.trim(),
        note: handoverNote.trim() || undefined,
      });

      if (res.data?.success) {
        Alert.alert(
          'Handover Request Sent',
          'Company dispatch has been notified with your reported meter reading and reason. Please remain with the vehicle until dispatch confirms the replacement driver.'
        );
        setShowHandoverModal(false);
        setHandoverMeter('');
        setHandoverNote('');
        fetchTour();
      } else {
        Alert.alert('Error', res.data?.error || 'Failed to submit handover request.');
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.response?.data?.error || 'Network error while submitting handover request.');
    } finally {
      setHandoverSubmitting(false);
    }
  };

  const fetchTour = async () => {
    try {
      const response = await apiClient.get(`/driver/tours/${bookingId}`);
      if (response.data?.success) {
        const tourData = response.data.data;
        setTour(tourData);

        // If tour is ONGOING, check if it needs takeover first or can stream tracking
        if (tourData.status === 'ONGOING') {
          const acts = tourData.tripActivities || [];
          const handoverIdx = acts.findIndex((a: any) => a.type === 'HANDOVER');
          const takeoverIdx = acts.findIndex((a: any) => a.type === 'TAKEOVER');
          const pendingTakeover = handoverIdx !== -1 && (takeoverIdx === -1 || handoverIdx < takeoverIdx);
          
          if (!pendingTakeover) {
            locationService.startTripTracking(bookingId);
          }
        }
      } else {
        Alert.alert('Error', 'Failed to load tour details.');
      }
    } catch (error: any) {
      console.error(error);
      if (error?.response?.status === 404 || error?.response?.status === 403) {
        Alert.alert(
          'Tour Reassigned',
          'This tour is no longer assigned to your driver account (it may have been handed over to another driver by dispatch).',
          [{ text: 'OK', onPress: () => {
            locationService.stopTripTracking();
            navigation.navigate('Dashboard');
          }}]
        );
        return;
      }
      Alert.alert('Error', 'Network error while fetching tour.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTour();

    // Subscribe to live GPS status changes
    const unsubscribe = locationService.subscribeStatus((status) => {
      setTrackingStatus(status);
    });

    return () => {
      unsubscribe();
    };
  }, [bookingId]);

  const openNavigation = (type: 'google' | 'waze', destinationTarget?: string) => {
    const target = destinationTarget || tour?.dropLocation || tour?.destination || tour?.pickupLocation;
    if (!target) {
      Alert.alert('No Destination', 'No destination address is set for this tour.');
      return;
    }

    const encodedTarget = encodeURIComponent(target);
    const url = type === 'google'
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodedTarget}&travelmode=driving`
      : `https://waze.com/ul?q=${encodedTarget}&navigate=yes`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported || type === 'google') {
          Linking.openURL(url);
        } else {
          Alert.alert('App Not Installed', 'Waze app is not installed on this device.');
        }
      })
      .catch((err) => console.error('Error opening map navigation:', err));
  };

  const handleAction = async (action: 'START_TRIP' | 'END_TRIP' | 'TAKEOVER') => {
    if (!meterReading) {
      Alert.alert('Required', 'Please enter the current meter reading on the dashboard.');
      return;
    }

    if (action === 'START_TRIP') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tourDate = new Date(tour.startDate);
      tourDate.setHours(0, 0, 0, 0);
      
      if (today < tourDate) {
        Alert.alert('Too Early', 'You cannot start this trip before its scheduled date.');
        return;
      }
    }

    const title = action === 'START_TRIP' ? 'Start Trip' : action === 'TAKEOVER' ? 'Take Over Tour' : 'End Trip';
    const message = action === 'START_TRIP' 
      ? 'Are you sure you want to START this trip now? Real-time GPS location sharing with the office will be activated.' 
      : action === 'TAKEOVER'
      ? 'Are you sure you want to TAKE OVER this ongoing tour? Live GPS tracking will be activated under your driver account.'
      : 'Are you sure you want to END this trip? Live GPS tracking will be terminated.';

    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          style: action === 'END_TRIP' ? 'destructive' : 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              const response = await apiClient.put(`/driver/tours/${bookingId}`, {
                action,
                meterReading
              });

              if (response.data?.success) {
                if (action === 'START_TRIP' || action === 'TAKEOVER') {
                  await locationService.startTripTracking(bookingId);
                  Alert.alert(
                    action === 'START_TRIP' ? 'Trip Started' : 'Tour Taken Over',
                    'GPS Live Tracking is now broadcasting to company dispatch.'
                  );
                } else if (action === 'END_TRIP') {
                  await locationService.stopTripTracking();
                  Alert.alert('Trip Ended', 'Live GPS tracking has been stopped.');
                }

                fetchTour(); // Refresh data
                setMeterReading(''); // Clear input
              } else {
                Alert.alert('Error', response.data?.error || 'Failed to update trip.');
              }
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Network error.');
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-6">
        <View className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-3 items-center justify-center">
          <Image 
            source={require('../../assets/logo-icon.png')} 
            style={{ width: 56, height: 56 }} 
            resizeMode="contain" 
          />
        </View>
        <Text className="text-xl font-black text-gray-900 tracking-tight">VIGIL</Text>
        <Text className="text-blue-600 font-bold text-xs uppercase tracking-widest mt-1">
          Loading Tour & GPS Radar...
        </Text>
        <ActivityIndicator size="small" color="#2563eb" className="mt-4" />
      </SafeAreaView>
    );
  }

  if (!tour) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-500">Tour not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-4 bg-blue-600 px-6 py-2 rounded-lg">
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isStarted = tour.status === 'ONGOING';
  const isCompleted = tour.status === 'COMPLETED';
  const primaryDestination = tour.dropLocation || tour.destination || tour.pickupLocation || '';

  const activities = tour.tripActivities || [];
  const handoverIdx = activities.findIndex((a: any) => a.type === 'HANDOVER');
  const takeoverIdx = activities.findIndex((a: any) => a.type === 'TAKEOVER');
  const handoverReqIdx = activities.findIndex((a: any) => a.type === 'HANDOVER_REQUESTED');
  const breakdownReqIdx = activities.findIndex((a: any) => a.type === 'BREAKDOWN_REPORTED');
  const vehicleSwappedIdx = activities.findIndex((a: any) => a.type === 'VEHICLE_SWAPPED');

  const isHandoverRequested = isStarted && handoverReqIdx !== -1 && (handoverIdx === -1 || handoverReqIdx < handoverIdx);
  const needsTakeover = isStarted && handoverIdx !== -1 && (takeoverIdx === -1 || handoverIdx < takeoverIdx);
  const isBreakdownReported = isStarted && breakdownReqIdx !== -1 && (vehicleSwappedIdx === -1 || breakdownReqIdx < vehicleSwappedIdx);
  const wasVehicleSwapped = vehicleSwappedIdx !== -1;

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 py-3.5 bg-white border-b border-gray-200 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 flex-row items-center">
          <Text className="text-blue-600 text-base font-bold">← Back</Text>
        </TouchableOpacity>

        {/* Center / Right: Tour Company Badge */}
        <View className="flex-row items-center flex-1 justify-end min-w-0">
          {tour?.company?.logoUrl ? (
            <View className="w-8 h-8 bg-white rounded-lg border border-gray-200 p-0.5 mr-2 items-center justify-center shadow-xs">
              <Image 
                source={{ uri: tour.company.logoUrl }} 
                style={{ width: 24, height: 24 }} 
                resizeMode="contain" 
              />
            </View>
          ) : null}
          <View className="items-end min-w-0">
            <Text className="text-xs font-bold text-gray-900 truncate" numberOfLines={1}>
              {tour?.company?.companyName || 'Tour'}
            </Text>
            <Text className="text-[10px] text-gray-500 font-medium">
              {tour.vehicleNo}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {/* Operating Company Header Banner */}
        {tour?.company?.companyName && (
          <View className="bg-white rounded-xl p-3 shadow-sm border border-gray-200 mb-4 flex-row items-center">
            {tour.company.logoUrl ? (
              <View className="w-11 h-11 bg-white rounded-lg border border-gray-200 p-1 items-center justify-center mr-3">
                <Image 
                  source={{ uri: tour.company.logoUrl }} 
                  style={{ width: 36, height: 36 }} 
                  resizeMode="contain" 
                />
              </View>
            ) : (
              <View className="w-11 h-11 bg-blue-50 rounded-lg items-center justify-center border border-blue-200 mr-3">
                <Text className="text-blue-900 font-extrabold text-sm">
                  {tour.company.companyName.substring(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View className="flex-1 min-w-0">
              <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Transport Company</Text>
              <Text className="text-sm font-bold text-gray-900 truncate">{tour.company.companyName}</Text>
              {tour.company.phone ? (
                <Text className="text-xs text-gray-500">Dispatch: {tour.company.phone}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Vehicle Breakdown Reported Alert Banner */}
        {isBreakdownReported && (
          <View className="bg-red-50 border border-red-400 rounded-xl p-4 shadow-sm mb-4">
            <View className="flex-row items-center mb-1">
              <Text className="text-red-900 font-bold text-base">🚨 Vehicle Breakdown Reported</Text>
            </View>
            <Text className="text-red-800 text-xs leading-relaxed">
              Company dispatch has received your vehicle breakdown report and is arranging an emergency replacement vehicle. Keep your phone reachable. Live GPS radar remains active so dispatch can locate you.
            </Text>
          </View>
        )}

        {/* Vehicle Swapped Banner */}
        {wasVehicleSwapped && (
          <View className="bg-indigo-50 border border-indigo-400 rounded-xl p-4 shadow-sm mb-4">
            <View className="flex-row items-center mb-1">
              <Text className="text-indigo-900 font-bold text-base">🔄 Vehicle Replaced: {tour.vehicleNo}</Text>
            </View>
            <Text className="text-indigo-800 text-xs leading-relaxed">
              Tour vehicle was successfully replaced mid-tour. You are currently operating under replacement vehicle {tour.vehicleNo}.
            </Text>
          </View>
        )}

        {/* Mid-Tour Handover Takeover Banner (for replacement driver) */}
        {needsTakeover && (
          <View className="bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-sm mb-4">
            <Text className="text-amber-800 font-bold text-base mb-1">⚡ Mid-Tour Handover Assigned</Text>
            <Text className="text-amber-700 text-xs leading-relaxed">
              This tour was previously underway and has been reassigned to you by dispatch. Please verify the vehicle and enter your takeover meter reading below to assume live GPS tracking.
            </Text>
          </View>
        )}

        {/* Handover Request Pending Banner (for current driver) */}
        {isHandoverRequested && (
          <View className="bg-amber-50 border border-amber-400 rounded-xl p-4 shadow-sm mb-4">
            <View className="flex-row items-center mb-1">
              <Text className="text-amber-900 font-bold text-base">⏳ Handover Request Sent to Dispatch</Text>
            </View>
            <Text className="text-amber-800 text-xs leading-relaxed">
              Company dispatch has received your handover request and is assigning a replacement driver. Your live GPS tracking remains active so dispatch can locate you.
            </Text>
          </View>
        )}


        {/* Live GPS Broadcast Status Banner (Active only during ONGOING) */}
        {isStarted && !needsTakeover && (
          <View className="bg-emerald-900 border border-emerald-700 rounded-xl p-4 shadow-sm mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Image 
                  source={require('../../assets/logo-icon.png')} 
                  style={{ width: 20, height: 20, marginRight: 8 }} 
                  resizeMode="contain" 
                />
                <Text className="text-white font-bold text-sm tracking-wide">VIGIL GPS RADAR LIVE</Text>
              </View>
              <View className="bg-emerald-800 px-2 py-0.5 rounded-full">
                <Text className="text-emerald-200 text-xs font-semibold">
                  {trackingStatus.isMoving ? '20s (Moving)' : '60s (Parked)'}
                </Text>
              </View>
            </View>

            <Text className="text-emerald-200 text-xs mb-2">
              Office dispatch is viewing your real-time vehicle location on the live fleet map.
            </Text>

            <View className="flex-row items-center justify-between pt-2 border-t border-emerald-800 text-xs">
              <Text className="text-emerald-300 text-xs">
                {trackingStatus.lastPingTime
                  ? `Last Ping: ${Math.round((Date.now() - trackingStatus.lastPingTime.getTime()) / 1000)}s ago`
                  : 'Syncing GPS signal...'}
              </Text>
              {trackingStatus.pendingOfflineCount > 0 ? (
                <View className="bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400">
                  <Text className="text-amber-300 text-[11px] font-bold">
                    📦 {trackingStatus.pendingOfflineCount} points cached offline
                  </Text>
                </View>
              ) : (
                <Text className="text-emerald-400 text-xs">● Online & Synced</Text>
              )}
            </View>
          </View>
        )}

        {/* Turn-by-Turn Navigation Quick Action Card */}
        {primaryDestination ? (
          <View className="bg-white rounded-xl p-4 shadow-sm border border-blue-100 mb-4">
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Turn-by-Turn Navigation</Text>
            <View className="flex-row items-center mb-3">
              <Text className="text-blue-900 font-bold text-base flex-1" numberOfLines={1}>
                📍 {primaryDestination}
              </Text>
            </View>
            
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => openNavigation('google')}
                className="flex-1 bg-blue-600 py-2.5 px-3 rounded-lg flex-row items-center justify-center shadow-sm"
              >
                <Text className="text-white font-bold text-sm">🗺️ Google Maps</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openNavigation('waze')}
                className="flex-1 bg-cyan-600 py-2.5 px-3 rounded-lg flex-row items-center justify-center shadow-sm"
              >
                <Text className="text-white font-bold text-sm">🚗 Waze Navigation</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Customer & Route Details Card */}
        <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
          <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Customer Details</Text>
          <Text className="text-xl font-bold text-gray-800 mb-1">{tour.customerName}</Text>
          {tour.pickupLocation && (
            <Text className="text-gray-600 text-xs mb-1">
              <Text className="font-semibold text-gray-700">Pickup:</Text> {tour.pickupLocation}
            </Text>
          )}
          <Text className="text-gray-600 text-xs mb-2">
            <Text className="font-semibold text-gray-700">Destination:</Text> {tour.destination || 'Not specified'}
          </Text>

          {tour.customerPhone && (
            <TouchableOpacity 
              onPress={() => Linking.openURL(`tel:${tour.customerPhone}`)}
              className="flex-row items-center mt-1 py-1"
            >
              <Text className="text-blue-600 font-bold text-sm">📞 {tour.customerPhone}</Text>
              <Text className="text-xs text-gray-400 ml-2">(Tap to call customer)</Text>
            </TouchableOpacity>
          )}

          {tour.customerEmail && (
            <TouchableOpacity 
              onPress={() => Linking.openURL(`mailto:${tour.customerEmail}`)}
              className="flex-row items-center mt-0.5 py-0.5"
            >
              <Text className="text-blue-600 text-xs">✉️ {tour.customerEmail}</Text>
            </TouchableOpacity>
          )}
          
          <View className="bg-blue-50 p-3 rounded-lg mt-2">
            <Text className="text-blue-800 text-sm">{tour.notes || 'No special notes.'}</Text>
          </View>
        </View>

        {/* Itinerary Day-by-Day Stops (if available from quotation schedule) */}
        {tour.itineraryDays && tour.itineraryDays.length > 0 && (
          <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Tour Itinerary Stops</Text>
            {tour.itineraryDays.map((item: any, idx: number) => (
              <View key={idx} className="py-2 border-b border-gray-100 flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-bold text-gray-800">Day {item.day}: {item.title}</Text>
                  {item.description && (
                    <Text className="text-xs text-gray-500" numberOfLines={1}>{item.description}</Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => openNavigation('google', item.title)}
                  className="bg-gray-100 px-2.5 py-1.5 rounded border border-gray-200"
                >
                  <Text className="text-xs text-blue-600 font-semibold">Navigate</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Status & Actions Card */}
        <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
          <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Trip Status</Text>
          
          <View className={`px-3 py-1 rounded-full self-start mb-4 ${isCompleted ? 'bg-gray-100' : isStarted ? 'bg-green-100' : 'bg-blue-100'}`}>
            <Text className={`font-bold ${isCompleted ? 'text-gray-600' : isStarted ? 'text-green-700' : 'text-blue-700'}`}>
              {tour.status}
            </Text>
          </View>

          {!isCompleted && (
            <View className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4">
              <Text className="text-gray-700 mb-2 font-medium">
                {needsTakeover ? 'Takeover Meter Reading:' : 'Dashboard Meter Reading:'}
              </Text>
              <TextInput
                className="bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-800"
                placeholder="e.g. 45500"
                keyboardType="numeric"
                value={meterReading}
                onChangeText={setMeterReading}
              />
            </View>
          )}

          {isCompleted ? (
            <View className="p-4 bg-gray-100 rounded-lg items-center">
              <Text className="text-gray-500 font-bold">This trip is completed.</Text>
            </View>
          ) : needsTakeover ? (
            <TouchableOpacity 
              onPress={() => handleAction('TAKEOVER')}
              disabled={actionLoading}
              className="bg-purple-600 py-3 rounded-lg items-center shadow-sm"
            >
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg">Take Over Tour & Resume GPS</Text>}
            </TouchableOpacity>
          ) : isStarted ? (
            <View>
              <TouchableOpacity 
                onPress={() => handleAction('END_TRIP')}
                disabled={actionLoading}
                className="bg-red-600 py-3 rounded-lg items-center shadow-sm"
              >
                {actionLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg">End Trip & Stop GPS</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowHandoverModal(true)}
                disabled={actionLoading}
                className="mt-3 border border-amber-500 bg-amber-50 py-3 rounded-lg items-center shadow-sm"
              >
                <Text className="text-amber-800 font-bold text-base">
                  {isHandoverRequested ? '✏️ Update Handover Request' : '⚠️ Request Mid-Tour Driver Handover'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowBreakdownModal(true)}
                disabled={actionLoading}
                className="mt-3 border border-red-500 bg-red-50 py-3 rounded-lg items-center shadow-sm"
              >
                <Text className="text-red-800 font-bold text-base">
                  {isBreakdownReported ? '✏️ Update Breakdown Report' : '🚨 Report Vehicle Breakdown'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              onPress={() => handleAction('START_TRIP')}
              disabled={actionLoading}
              className="bg-green-600 py-3 rounded-lg items-center shadow-sm"
            >
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg">Start Trip & Broadcast GPS</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* Activity Log */}
        <View className="mb-6">
          <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 px-2">Activity & Handover Log</Text>
          {tour.tripActivities?.length === 0 ? (
            <Text className="text-gray-400 italic px-2">No activities logged yet.</Text>
          ) : (
            tour.tripActivities?.map((activity: any) => {
              const type = activity.type;
              const barColor = type === 'HANDOVER' ? 'bg-amber-500' :
                type === 'HANDOVER_REQUESTED' ? 'bg-orange-500' :
                type === 'TAKEOVER' ? 'bg-purple-500' :
                type === 'START' ? 'bg-blue-500' :
                type === 'END' ? 'bg-green-500' :
                type === 'BREAKDOWN_REPORTED' ? 'bg-red-600' :
                type === 'VEHICLE_SWAPPED' ? 'bg-indigo-600' :
                type === 'BREAKDOWN' ? 'bg-red-500' : 'bg-gray-400';

              return (
                <View key={activity.id} className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 mb-2 flex-row items-center">
                  <View className={`w-2 h-10 rounded-full mr-3 ${barColor}`} />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-0.5">
                      <Text className="font-bold text-gray-800 text-xs">{activity.type}</Text>
                      <Text className="text-xs text-gray-400">
                        {new Date(activity.timestamp).toLocaleString()}
                      </Text>
                    </View>
                    <Text className="text-sm text-gray-600 font-medium">{activity.note}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View className="h-10" />
      </ScrollView>

      {/* Mid-Tour Handover Request Modal */}
      <Modal
        visible={showHandoverModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHandoverModal(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-3xl p-6 shadow-xl">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-800">Request Mid-Tour Handover</Text>
              <TouchableOpacity onPress={() => setShowHandoverModal(false)} className="p-1">
                <Text className="text-gray-400 font-bold text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-gray-500 text-xs mb-4">
              If you cannot continue driving due to sickness, fatigue, or emergency, notify dispatch immediately.
            </Text>

            <Text className="text-gray-700 font-semibold text-xs mb-1 uppercase">Reason for Handover</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {['Medical / Sickness', 'Family Emergency', 'Vehicle Issue', 'Shift End / Fatigue', 'Other'].map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setHandoverReason(r)}
                  className={`px-3 py-1.5 rounded-full border ${handoverReason === r ? 'bg-amber-100 border-amber-600' : 'bg-gray-50 border-gray-200'}`}
                >
                  <Text className={`text-xs font-semibold ${handoverReason === r ? 'text-amber-900' : 'text-gray-600'}`}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-gray-700 font-semibold text-xs mb-1 uppercase">
              Current Odometer Reading (KM) <Text className="text-red-600 font-bold">* (Required)</Text>
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-800 mb-4"
              placeholder="e.g. 45350"
              keyboardType="numeric"
              value={handoverMeter}
              onChangeText={setHandoverMeter}
            />

            <Text className="text-gray-700 font-semibold text-xs mb-1 uppercase">Current Location / Notes</Text>
            <TextInput
              className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-800 mb-6"
              placeholder="e.g. Stopped at Ambepussa rest area, high fever"
              value={handoverNote}
              onChangeText={setHandoverNote}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowHandoverModal(false)}
                className="flex-1 bg-gray-100 py-3 rounded-xl items-center"
              >
                <Text className="text-gray-700 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitHandoverRequest}
                disabled={handoverSubmitting}
                className="flex-1 bg-amber-600 py-3 rounded-xl items-center flex-row justify-center"
              >
                {handoverSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold">Send to Dispatch</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Emergency Vehicle Breakdown Reporting Modal */}
      <Modal
        visible={showBreakdownModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBreakdownModal(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-3xl p-6 shadow-xl max-h-[85%]">
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-xl font-bold text-red-600">🚨 Report Vehicle Breakdown</Text>
                <TouchableOpacity onPress={() => setShowBreakdownModal(false)} className="p-1">
                  <Text className="text-gray-400 font-bold text-lg">✕</Text>
                </TouchableOpacity>
              </View>

              <Text className="text-gray-500 text-xs mb-4">
                If the tour vehicle ({tour.vehicleNo}) suffers a mechanical defect or cannot proceed, alert dispatch immediately with your odometer reading.
              </Text>

              <Text className="text-gray-700 font-semibold text-xs mb-1 uppercase">Defect / Issue Type</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {[
                  'Engine / Overheating',
                  'Flat Tyre / Puncture',
                  'Brake Failure',
                  'Transmission / Clutch',
                  'Electrical / Battery',
                  'Accident / Collision',
                  'Other Mechanical Issue',
                ].map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setBreakdownReason(r)}
                    className={`px-3 py-1.5 rounded-full border ${breakdownReason === r ? 'bg-red-100 border-red-600' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <Text className={`text-xs font-semibold ${breakdownReason === r ? 'text-red-900' : 'text-gray-600'}`}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-gray-700 font-semibold text-xs mb-1 uppercase">
                Current Odometer Reading (KM) <Text className="text-red-600 font-bold">* (Required)</Text>
              </Text>
              <TextInput
                className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-800 mb-4"
                placeholder="e.g. 45820"
                keyboardType="numeric"
                value={breakdownMeter}
                onChangeText={setBreakdownMeter}
              />

              <Text className="text-gray-700 font-semibold text-xs mb-1 uppercase">Current Breakdown Location</Text>
              <TextInput
                className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-800 mb-4"
                placeholder="e.g. Near Habarana junction, A6 highway"
                value={breakdownLocation}
                onChangeText={setBreakdownLocation}
              />

              <Text className="text-gray-700 font-semibold text-xs mb-1 uppercase">Description / Passenger Situation</Text>
              <TextInput
                className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-800 mb-6"
                placeholder="e.g. Radiator hose leaked, passengers waiting safely at roadside café"
                multiline
                numberOfLines={2}
                value={breakdownNote}
                onChangeText={setBreakdownNote}
              />

              <View className="flex-row gap-3 mb-2">
                <TouchableOpacity
                  onPress={() => setShowBreakdownModal(false)}
                  className="flex-1 bg-gray-100 py-3 rounded-xl items-center"
                >
                  <Text className="text-gray-700 font-bold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submitBreakdownReport}
                  disabled={breakdownSubmitting}
                  className="flex-1 bg-red-600 py-3 rounded-xl items-center flex-row justify-center"
                >
                  {breakdownSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold">Report to Dispatch</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

