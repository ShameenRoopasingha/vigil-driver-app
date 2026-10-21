import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Linking, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { locationService, TrackingStatus } from '../services/locationService';
import { 
  DriverBreakdownReportSchema, 
  DriverHandoverRequestSchema, 
  DriverRouteChangeSchema,
  OdometerReadingSchema 
} from '../validations';
import OpenStreetMapPicker from '../components/OpenStreetMapPicker';
import { toast } from '../utils/toast';
import { 
  geocodePlace,
  type IntermediateStop,
} from '../services/osmService';

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
  const [handoverLocation, setHandoverLocation] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Emergency Breakdown State
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [breakdownReason, setBreakdownReason] = useState('Engine Failure / Overheating');
  const [breakdownMeter, setBreakdownMeter] = useState('');
  const [breakdownLocation, setBreakdownLocation] = useState('');
  const [breakdownNote, setBreakdownNote] = useState('');
  const [breakdownSubmitting, setBreakdownSubmitting] = useState(false);

  // Mid-Tour Route Change, Detours & Itinerary State
  const [showRouteChangeModal, setShowRouteChangeModal] = useState(false);
  const [routeChangeType, setRouteChangeType] = useState<'DETOUR' | 'DESTINATION' | 'ITINERARY'>('ITINERARY');
  const [intermediateStops, setIntermediateStops] = useState<IntermediateStop[]>([]);
  const [updatedPickup, setUpdatedPickup] = useState('');
  const [updatedDropoff, setUpdatedDropoff] = useState('');
  const [extraKmInput, setExtraKmInput] = useState('');
  const [routeChangeReason, setRouteChangeReason] = useState('Guest Requested Sightseeing Stops');
  const [routeChangeNote, setRouteChangeNote] = useState('');
  const [customerAgreed, setCustomerAgreed] = useState(true);
  const [routeChangeSubmitting, setRouteChangeSubmitting] = useState(false);
  const [driverCurrentCoords, setDriverCurrentCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lon: number; name?: string } | null>(null);
  const [calculatedRoutePolyline, setCalculatedRoutePolyline] = useState<any>(null);

  // Auto-resolve driver's current GPS location & destination coords whenever Route Alteration opens
  useEffect(() => {
    if (showRouteChangeModal) {
      locationService.getCurrentCoordinates().then((coords) => {
        if (coords) setDriverCurrentCoords(coords);
      });

      const destTarget = tour?.dropLocation || tour?.destination || tour?.pickupLocation || '';
      if (destTarget) {
        geocodePlace(destTarget).then((geo) => {
          if (geo) {
            setDestinationCoords({ lat: geo.lat, lon: geo.lon, name: destTarget });
          }
        });
      }
    }
  }, [showRouteChangeModal, tour?.dropLocation, tour?.destination, tour?.pickupLocation]);

  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>({
    isTracking: false,
    isMoving: false,
    activeBookingId: null,
    currentSpeed: 0,
    lastPingTime: null,
    pendingOfflineCount: 0,
    lastError: null,
  });

  const autoDetectLocation = async (type: 'breakdown' | 'handover') => {
    setIsDetectingLocation(true);
    try {
      const address = await locationService.getCurrentAddress();
      if (address) {
        if (type === 'breakdown') {
          setBreakdownLocation(address);
        } else {
          setHandoverLocation(address);
        }
      }
    } catch (e) {
      console.warn('Auto-detect location error:', e);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const handleOpenBreakdownModal = () => {
    setShowBreakdownModal(true);
    // Auto-detect from GPS if empty
    if (!breakdownLocation) {
      autoDetectLocation('breakdown');
    }
  };

  const handleOpenHandoverModal = () => {
    setShowHandoverModal(true);
    // Auto-detect from GPS if empty
    if (!handoverLocation) {
      autoDetectLocation('handover');
    }
  };

  const submitBreakdownReport = async () => {
    const validation = DriverBreakdownReportSchema.safeParse({
      meterReading: breakdownMeter,
      reason: breakdownReason,
      location: breakdownLocation.trim() || undefined,
      note: breakdownNote.trim() || undefined,
    });

    if (!validation.success) {
      toast.warning('Validation Error', validation.error.issues[0]?.message || 'Please check breakdown details.');
      return;
    }

    const validData = validation.data;
    setBreakdownSubmitting(true);
    try {
      const res = await apiClient.put(`/driver/tours/${bookingId}`, {
        action: 'REPORT_BREAKDOWN',
        reason: validData.reason,
        meterReading: validData.meterReading,
        location: validData.location,
        note: validData.note,
      });

      if (res.data?.success) {
        toast.success(
          'Breakdown Reported',
          'Company dispatch has been notified. Please park safely while replacement transport is arranged.'
        );
        setShowBreakdownModal(false);
        setBreakdownMeter('');
        setBreakdownLocation('');
        setBreakdownNote('');
        fetchTour();
      } else {
        toast.error('Error', res.data?.error || 'Failed to submit breakdown report.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error', err?.response?.data?.error || 'Network error while submitting breakdown report.');
    } finally {
      setBreakdownSubmitting(false);
    }
  };

  const submitHandoverRequest = async () => {
    const validation = DriverHandoverRequestSchema.safeParse({
      meterReading: handoverMeter,
      reason: handoverReason,
      location: handoverLocation.trim() || undefined,
      note: handoverNote.trim() || undefined,
    });

    if (!validation.success) {
      toast.warning('Validation Error', validation.error.issues[0]?.message || 'Please check handover details.');
      return;
    }

    const validData = validation.data;
    setHandoverSubmitting(true);
    try {
      const combinedNote = [
        validData.location ? `Location: ${validData.location}` : null,
        validData.note ? `Notes: ${validData.note}` : null,
      ].filter(Boolean).join(' | ');

      const res = await apiClient.put(`/driver/tours/${bookingId}`, {
        action: 'REQUEST_HANDOVER',
        reason: validData.reason,
        meterReading: validData.meterReading,
        note: combinedNote || undefined,
      });

      if (res.data?.success) {
        toast.success(
          'Handover Request Sent',
          'Company dispatch has been notified. Please remain with the vehicle until dispatch confirms the replacement driver.'
        );
        setShowHandoverModal(false);
        setHandoverMeter('');
        setHandoverLocation('');
        setHandoverNote('');
        fetchTour();
      } else {
        toast.error('Error', res.data?.error || 'Failed to submit handover request.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error', err?.response?.data?.error || 'Network error while submitting handover request.');
    } finally {
      setHandoverSubmitting(false);
    }
  };

  const submitRouteChange = async () => {
    const loc = intermediateStops.length > 0
      ? intermediateStops.map((s) => s.name).join(' ➔ ')
      : updatedDropoff || tour?.dropLocation || tour?.destination || '';

    const payload = {
      location: loc,
      changeType: intermediateStops.length > 0 ? ('ITINERARY' as const) : ('DESTINATION' as const),
      extraKm: extraKmInput.trim() || undefined,
      reason: routeChangeReason,
      note: routeChangeNote.trim() || undefined,
      agreedByCustomer: customerAgreed,
      pickupLocation: updatedPickup || tour?.pickupLocation || undefined,
      dropLocation: updatedDropoff || tour?.dropLocation || tour?.destination || undefined,
      destination: updatedDropoff || tour?.destination || tour?.dropLocation || undefined,
      stops: intermediateStops.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon })),
      routePolyline: calculatedRoutePolyline || undefined,
    };

    const validation = DriverRouteChangeSchema.safeParse(payload);
    if (!validation.success) {
      toast.warning('Validation Error', validation.error.issues[0]?.message || 'Please check route change details.');
      return;
    }

    setRouteChangeSubmitting(true);
    try {
      const res = await apiClient.put(`/driver/tours/${bookingId}`, {
        action: 'CHANGE_ROUTE',
        ...payload,
        extraKm: payload.extraKm ? Number(payload.extraKm) : undefined,
      });

      if (res.data?.success) {
        toast.success(
          'Itinerary Updated',
          intermediateStops.length > 0
            ? `Updated tour itinerary with ${intermediateStops.length} intermediate stop(s). Dispatch notified.`
            : `Updated tour destination to "${payload.dropLocation || loc}". Dispatch alerted.`
        );
        setShowRouteChangeModal(false);
        fetchTour();
      } else {
        toast.error('Error', res.data?.error || 'Failed to update tour route.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error', err?.response?.data?.error || 'Network error while updating route.');
    } finally {
      setRouteChangeSubmitting(false);
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
        toast.error('Error', 'Failed to load tour details.');
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
      toast.error('Error', 'Network error while fetching tour.');
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
      toast.warning('No Destination', 'No destination address is set for this tour.');
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
          toast.warning('App Not Installed', 'Waze app is not installed on this device.');
        }
      })
      .catch((err) => console.error('Error opening map navigation:', err));
  };

  const openHandoverNavigation = (type: 'google' | 'waze') => {
    const handover = tour?.handoverDetails;
    if (type === 'google' && handover?.googleMapsUrl) {
      Linking.openURL(handover.googleMapsUrl).catch((err) => {
        console.error('Error opening Google Maps:', err);
        toast.error('Navigation Error', 'Could not open Google Maps navigation.');
      });
      return;
    }

    if (type === 'waze' && handover?.wazeUrl) {
      Linking.canOpenURL(handover.wazeUrl).then((supported) => {
        if (supported) {
          Linking.openURL(handover.wazeUrl);
        } else {
          toast.warning('App Not Installed', 'Waze app is not installed on this device.');
        }
      }).catch((err) => console.error('Error opening Waze:', err));
      return;
    }

    const target = handover?.coordinates 
      ? `${handover.coordinates.lat},${handover.coordinates.lon}`
      : (handover?.location || tour?.pickupLocation || tour?.destination);

    if (!target) {
      toast.warning('No Location', 'No handover location or coordinates found.');
      return;
    }

    openNavigation(type, target);
  };

  const handleAction = async (action: 'START_TRIP' | 'END_TRIP' | 'TAKEOVER') => {
    const validation = OdometerReadingSchema.safeParse({ meterReading });
    if (!validation.success) {
      toast.warning('Validation Error', validation.error.issues[0]?.message || 'Please enter a valid meter reading on the dashboard.');
      return;
    }

    if (action === 'START_TRIP') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tourDate = new Date(tour.startDate);
      tourDate.setHours(0, 0, 0, 0);
      
      if (today < tourDate) {
        toast.warning('Too Early', 'You cannot start this trip before its scheduled date.');
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
                  toast.success(
                    action === 'START_TRIP' ? 'Trip Started' : 'Tour Taken Over',
                    'GPS Live Tracking is now broadcasting to company dispatch.'
                  );
                } else if (action === 'END_TRIP') {
                  await locationService.stopTripTracking();
                  toast.info('Trip Ended', 'Live GPS tracking has been stopped.');
                }

                fetchTour(); // Refresh data
                setMeterReading(''); // Clear input
              } else {
                toast.error('Error', response.data?.error || 'Failed to update trip.');
              }
            } catch (error) {
              console.error(error);
              toast.error('Network Error', 'Failed to communicate with server.');
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

  const routeChanges = activities.filter((a: any) => a.type === 'ROUTE_CHANGE');
  const latestRouteChange = routeChanges.length > 0 ? routeChanges[routeChanges.length - 1] : null;

  // Extract all active stops from the latest route change
  const activeIntermediateStops: string[] = [];
  if (latestRouteChange?.note) {
    const itineraryMatch = latestRouteChange.note.match(/Stops:\s*([^()|]+)/i);
    const detourMatch = latestRouteChange.note.match(/Mid-Tour Detour \/ (?:Extra Stop Added|Stops Added):\s*([^()|]+)/i);
    const rawStops = itineraryMatch ? itineraryMatch[1] : (detourMatch ? detourMatch[1] : null);
    if (rawStops) {
      rawStops.split('➔').forEach((s: string) => {
        const trimmed = s.trim();
        if (trimmed && !activeIntermediateStops.includes(trimmed)) {
          activeIntermediateStops.push(trimmed);
        }
      });
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 py-3.5 bg-white border-b border-gray-200 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 flex-row items-center">
          <Text className="text-blue-600 text-base font-bold">← Back</Text>
        </TouchableOpacity>

        {/* Center / Right: Tour Company Badge */}
        <View className="flex-row items-center flex-1 justify-end min-w-0" style={{ paddingRight: 46 }}>
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

        {/* Mid-Tour Handover Takeover Card (for replacement driver) */}
        {needsTakeover && (
          <View className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 shadow-sm mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <Text className="text-amber-900 font-black text-base">⚡ Mid-Tour Handover Assigned</Text>
              </View>
              <View className="bg-amber-200 px-2 py-0.5 rounded-full border border-amber-300">
                <Text className="text-amber-950 font-black text-[10px] tracking-wider">TAKEOVER REQUIRED</Text>
              </View>
            </View>

            <Text className="text-amber-800 text-xs leading-relaxed mb-3">
              This tour is currently underway. You have been assigned as the replacement driver by dispatch. Navigate to the vehicle handover point below to inspect the vehicle and take over the tour.
            </Text>

            {/* Handover Details Box */}
            <View className="bg-white rounded-xl p-3 border border-amber-200 mb-3 space-y-1.5">
              <View className="flex-row items-start mb-1">
                <Text className="text-amber-900 font-bold text-xs w-28">📍 Handover Point:</Text>
                <Text className="text-slate-900 font-extrabold text-xs flex-1">
                  {tour.handoverDetails?.location || tour.pickupLocation || 'Current vehicle location'}
                </Text>
              </View>

              {tour.handoverDetails?.previousDriverName && (
                <View className="flex-row items-center mb-1">
                  <Text className="text-amber-900 font-bold text-xs w-28">👤 Previous Driver:</Text>
                  <Text className="text-slate-700 font-semibold text-xs flex-1">
                    {tour.handoverDetails.previousDriverName}
                  </Text>
                </View>
              )}

              {tour.handoverDetails?.reason && (
                <View className="flex-row items-center mb-1">
                  <Text className="text-amber-900 font-bold text-xs w-28">⚠️ Handover Reason:</Text>
                  <Text className="text-slate-700 font-semibold text-xs flex-1">
                    {tour.handoverDetails.reason}
                  </Text>
                </View>
              )}

              {tour.handoverDetails?.meterReading && (
                <View className="flex-row items-center mb-1">
                  <Text className="text-amber-900 font-bold text-xs w-28">🚗 Handover Meter:</Text>
                  <Text className="text-slate-900 font-black text-xs flex-1">
                    {tour.handoverDetails.meterReading} km
                  </Text>
                </View>
              )}

              {tour.handoverDetails?.instructions && (
                <View className="flex-row items-start">
                  <Text className="text-amber-900 font-bold text-xs w-28">📝 Notes / Info:</Text>
                  <Text className="text-slate-700 text-xs flex-1">
                    {tour.handoverDetails.instructions}
                  </Text>
                </View>
              )}
            </View>

            {/* Turn-by-Turn Navigation to Handover Location */}
            <View className="gap-2">
              <TouchableOpacity
                onPress={() => openHandoverNavigation('google')}
                activeOpacity={0.8}
                className="bg-blue-600 active:bg-blue-700 py-3 px-4 rounded-xl flex-row items-center justify-center shadow-md"
              >
                <Text className="text-white font-black text-sm">
                  🗺️ Navigate to Handover with Google Maps
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openHandoverNavigation('waze')}
                activeOpacity={0.8}
                className="bg-cyan-600 active:bg-cyan-700 py-2.5 px-4 rounded-xl flex-row items-center justify-center"
              >
                <Text className="text-white font-bold text-xs">
                  🚗 Navigate with Waze
                </Text>
              </TouchableOpacity>
            </View>
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
                <View style={{ width: 28, height: 28, backgroundColor: '#ffffff', borderRadius: 7, justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                  <Image 
                    source={require('../../assets/logo-icon.png')} 
                    style={{ width: 20, height: 20 }} 
                    resizeMode="contain" 
                  />
                </View>
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
            
            {/* Active Intermediate Stops List Card */}
            {activeIntermediateStops.length > 0 ? (
              <View className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 mb-3.5 shadow-xs">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-indigo-900 font-black text-xs uppercase tracking-wide">
                      📍 Intermediate Tour Stops ({activeIntermediateStops.length})
                    </Text>
                  </View>
                  <View className="bg-indigo-200 px-2 py-0.5 rounded-full">
                    <Text className="text-indigo-900 text-[10px] font-black uppercase">ACTIVE ITINERARY</Text>
                  </View>
                </View>

                {activeIntermediateStops.map((stopName, idx) => (
                  <View key={idx} className="bg-white rounded-lg p-2.5 border border-indigo-100 mb-2 shadow-2xs">
                    <View className="flex-row items-center gap-2 mb-1.5">
                      <View className="w-5 h-5 rounded-full bg-indigo-600 items-center justify-center">
                        <Text className="text-white text-[10px] font-black">{idx + 1}</Text>
                      </View>
                      <Text className="text-gray-900 font-bold text-xs flex-1" numberOfLines={1}>
                        {stopName}
                      </Text>
                    </View>

                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => openNavigation('google', stopName)}
                        className="flex-1 bg-indigo-600 py-2 px-2.5 rounded-md flex-row items-center justify-center shadow-xs"
                      >
                        <Text className="text-white font-bold text-[11px]">🗺️ Maps to Stop {idx + 1}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => openNavigation('waze', stopName)}
                        className="flex-1 bg-cyan-600 py-2 px-2.5 rounded-md flex-row items-center justify-center shadow-xs"
                      >
                        <Text className="text-white font-bold text-[11px]">🚗 Waze to Stop {idx + 1}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : latestRouteChange ? (
              <View className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 mb-3">
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text className="text-indigo-900 font-black text-[11px] uppercase tracking-wide">
                    🗺️ Route Alteration Logged
                  </Text>
                  <View className="bg-indigo-200 px-1.5 py-0.5 rounded">
                    <Text className="text-indigo-900 text-[9px] font-black">LOGGED</Text>
                  </View>
                </View>
                <Text className="text-indigo-950 text-xs font-semibold" numberOfLines={2}>
                  {latestRouteChange.note}
                </Text>
              </View>
            ) : null}

            {/* Final Tour Destination Navigation */}
            <View className={activeIntermediateStops.length > 0 ? "border-t border-gray-100 pt-3" : ""}>
              {activeIntermediateStops.length > 0 && (
                <Text className="text-gray-500 text-[11px] font-bold uppercase tracking-wider mb-2">
                  🏁 Final Tour Destination ({primaryDestination})
                </Text>
              )}
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

            <TouchableOpacity
              onPress={() => setShowRouteChangeModal(true)}
              activeOpacity={0.8}
              className="mt-2.5 bg-indigo-50 border border-indigo-200 py-2 rounded-lg flex-row items-center justify-center gap-1.5"
            >
              <Text className="text-indigo-800 font-bold text-xs">
                ✏️ Edit Pickup, Stops & Destination
              </Text>
            </TouchableOpacity>
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
            <View className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-gray-800 font-bold text-sm">
                  {needsTakeover ? 'Takeover Meter Reading (KM):' : 'Dashboard Meter Reading (KM):'}
                </Text>
                {needsTakeover && tour.handoverDetails?.meterReading ? (
                  <TouchableOpacity
                    onPress={() => setMeterReading(tour.handoverDetails.meterReading)}
                    activeOpacity={0.7}
                    className="bg-amber-100 border border-amber-300 px-2 py-0.5 rounded"
                  >
                    <Text className="text-amber-900 text-[10px] font-bold">
                      Use Handover ({tour.handoverDetails.meterReading} km)
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TextInput
                className="bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 text-gray-900 font-semibold text-base"
                placeholder={needsTakeover && tour.handoverDetails?.meterReading ? tour.handoverDetails.meterReading : "e.g. 45500"}
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
              className="bg-emerald-600 active:bg-emerald-700 py-3.5 rounded-xl items-center shadow-md"
            >
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black text-base">✅ Confirm Takeover & Resume Live GPS</Text>}
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
                onPress={() => setShowRouteChangeModal(true)}
                disabled={actionLoading}
                className="mt-3 border border-indigo-500 bg-indigo-50 py-3 rounded-lg items-center shadow-sm"
              >
                <Text className="text-indigo-800 font-bold text-base">
                  🗺️ Add Detour / Change Tour Route
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleOpenHandoverModal}
                disabled={actionLoading}
                className="mt-3 border border-amber-500 bg-amber-50 py-3 rounded-lg items-center shadow-sm"
              >
                <Text className="text-amber-800 font-bold text-base">
                  {isHandoverRequested ? '✏️ Update Handover Request' : '⚠️ Request Mid-Tour Driver Handover'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleOpenBreakdownModal}
                disabled={actionLoading}
                className="mt-3 border border-red-500 bg-red-50 py-3 rounded-lg items-center shadow-sm"
              >
                <Text className="text-red-800 font-bold text-base">
                  {isBreakdownReported ? '✏️ Update Breakdown Report' : '🚨 Report Vehicle Breakdown'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TouchableOpacity 
                onPress={() => handleAction('START_TRIP')}
                disabled={actionLoading}
                className="bg-green-600 py-3 rounded-lg items-center shadow-sm"
              >
                {actionLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg">Start Trip & Broadcast GPS</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowRouteChangeModal(true)}
                disabled={actionLoading}
                className="mt-3 border border-indigo-500 bg-indigo-50 py-2.5 rounded-lg items-center shadow-sm"
              >
                <Text className="text-indigo-800 font-bold text-sm">
                  🗺️ Add Detour / Change Route
                </Text>
              </TouchableOpacity>
            </View>
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
                type === 'ROUTE_CHANGE' ? 'bg-violet-600' :
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

            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-gray-700 font-semibold text-xs uppercase">Current Location (Auto-detected from GPS)</Text>
              <TouchableOpacity
                onPress={() => autoDetectLocation('handover')}
                disabled={isDetectingLocation}
                className="flex-row items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-300"
              >
                {isDetectingLocation ? (
                  <ActivityIndicator size="small" color="#d97706" />
                ) : (
                  <Text className="text-[10px] font-bold text-amber-800">🔄 GPS Sync</Text>
                )}
              </TouchableOpacity>
            </View>
            <TextInput
              className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-800 mb-4 text-xs font-medium"
              placeholder={isDetectingLocation ? '📍 Detecting GPS location...' : 'Current location (auto-filled from GPS)'}
              value={handoverLocation}
              onChangeText={setHandoverLocation}
            />

            <Text className="text-gray-700 font-semibold text-xs mb-1 uppercase">Additional Notes / Situation</Text>
            <TextInput
              className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-800 mb-6"
              placeholder="e.g. Resting at Ambepussa, doctor advised 2 days rest"
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

              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-gray-700 font-semibold text-xs uppercase">Current Breakdown Location (Auto-detected from GPS)</Text>
                <TouchableOpacity
                  onPress={() => autoDetectLocation('breakdown')}
                  disabled={isDetectingLocation}
                  className="flex-row items-center gap-1 bg-red-50 px-2 py-0.5 rounded border border-red-300"
                >
                  {isDetectingLocation ? (
                    <ActivityIndicator size="small" color="#dc2626" />
                  ) : (
                    <Text className="text-[10px] font-bold text-red-800">🔄 GPS Sync</Text>
                  )}
                </TouchableOpacity>
              </View>
              <TextInput
                className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-800 mb-4 text-xs font-medium"
                placeholder={isDetectingLocation ? '📍 Detecting GPS location...' : 'Current location (auto-filled from GPS)'}
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

      {/* Mid-Tour Detour & Route Change Modal */}
      <Modal
        visible={showRouteChangeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRouteChangeModal(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white rounded-t-3xl p-6 shadow-xl max-h-[90%]">
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="flex-row justify-between items-center mb-2">
                <View>
                  <Text className="text-xl font-black text-gray-900">Tour Itinerary Planner</Text>
                  <Text className="text-gray-500 text-xs mt-0.5">Edit pickup, add/remove stops, or change destination</Text>
                </View>
                <TouchableOpacity onPress={() => setShowRouteChangeModal(false)} className="p-1">
                  <Text className="text-gray-400 font-bold text-lg">✕</Text>
                </TouchableOpacity>
              </View>

              {/* OpenStreetMap Itinerary & Route Picker */}
              <OpenStreetMapPicker
                currentLocation={
                  driverCurrentCoords ||
                  (locationService.getLatestLocation()?.coords
                    ? {
                        lat: locationService.getLatestLocation()!.coords.latitude,
                        lon: locationService.getLatestLocation()!.coords.longitude,
                        name: tour.pickupLocation || 'Current Location',
                      }
                    : null)
                }
                destinationLocation={destinationCoords}
                pickupLocationName={tour.pickupLocation || 'Current Pickup'}
                dropLocationName={tour.dropLocation || tour.destination || 'Final Destination'}
                initialStops={intermediateStops}
                onItineraryChanged={(payload) => {
                  setIntermediateStops(payload.stops);
                  setUpdatedPickup(payload.pickupLocation.name);
                  setUpdatedDropoff(payload.dropLocation.name);
                  setExtraKmInput(String(Math.round(payload.extraKm)));
                  if (payload.routeResult?.routeGeoJson?.coordinates) {
                    setCalculatedRoutePolyline(payload.routeResult.routeGeoJson.coordinates);
                  }
                }}
              />

              {/* Estimated Extra KM (auto-calculated via OSRM, editable) */}
              <View className="flex-row items-center justify-between mb-1 mt-2">
                <Text className="text-gray-700 font-semibold text-xs uppercase">
                  Estimated Extra Distance (KM)
                </Text>
                {extraKmInput ? (
                  <Text className="text-[11px] font-bold text-emerald-700">
                    ✓ Auto-Calculated via OSM
                  </Text>
                ) : null}
              </View>
              <TextInput
                className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 mb-2 text-sm font-medium"
                placeholder="e.g. 25"
                keyboardType="numeric"
                value={extraKmInput}
                onChangeText={setExtraKmInput}
              />

              {/* Reason Selector */}
              <Text className="text-gray-700 font-semibold text-xs mb-1.5 uppercase">
                Reason for Route Alteration
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {[
                  'Guest Requested Sightseeing Detour',
                  'Hotel / City Changed by Guests',
                  'Weather / Road Block Bypass',
                  'Flight / Timing Reschedule',
                  'Other',
                ].map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => setRouteChangeReason(reason)}
                    className={`px-3 py-1.5 rounded-full border ${routeChangeReason === reason ? 'bg-indigo-100 border-indigo-600' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <Text className={`text-xs font-medium ${routeChangeReason === reason ? 'text-indigo-900 font-bold' : 'text-gray-600'}`}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Passenger Agreement Toggle */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setCustomerAgreed(!customerAgreed)}
                className="flex-row items-center bg-indigo-50 border border-indigo-200 p-3 rounded-xl mb-4"
              >
                <View className={`w-5 h-5 rounded border items-center justify-center mr-2.5 ${customerAgreed ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-400'}`}>
                  {customerAgreed && <Text className="text-white text-xs font-bold">✓</Text>}
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-indigo-950">Passengers Requested & Agreed</Text>
                  <Text className="text-[11px] text-indigo-700">Extra km and detour route authorized by guests</Text>
                </View>
              </TouchableOpacity>

              {/* Notes */}
              <Text className="text-gray-700 font-semibold text-xs mb-1 uppercase">Notes / Dispatch Memo</Text>
              <TextInput
                className="bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 mb-5 text-xs font-medium"
                placeholder="e.g. Guests wanted to stop for 1.5 hours to watch elephant bathing"
                value={routeChangeNote}
                onChangeText={setRouteChangeNote}
              />

              <View className="flex-row gap-3 pb-4">
                <TouchableOpacity
                  onPress={() => setShowRouteChangeModal(false)}
                  className="flex-1 bg-gray-100 py-3 rounded-xl items-center"
                >
                  <Text className="text-gray-700 font-bold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submitRouteChange}
                  disabled={routeChangeSubmitting}
                  className={`flex-1 py-3 rounded-xl items-center flex-row justify-center ${'bg-indigo-600 shadow-sm'}`}
                >
                  {routeChangeSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold">Confirm & Save Itinerary</Text>
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

