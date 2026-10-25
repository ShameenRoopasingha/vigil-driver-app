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
import { colors, themeStyles } from '../theme';
import { useTheme } from '../context/ThemeContext';

type ActiveTourRouteProp = RouteProp<RootStackParamList, 'ActiveTour'>;
type ActiveTourNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ActiveTour'>;

export default function ActiveTourScreen() {
  const route = useRoute<ActiveTourRouteProp>();
  const navigation = useNavigation<ActiveTourNavigationProp>();
  const { isDark, colors: themeColors } = useTheme();
  
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
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lon: number; name?: string } | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lon: number; name?: string } | null>(null);
  const [calculatedRoutePolyline, setCalculatedRoutePolyline] = useState<any>(null);

  // Auto-resolve pickup & destination coords from tour itinerary, plus driver GPS
  useEffect(() => {
    if (showRouteChangeModal) {
      locationService.getCurrentCoordinates().then((coords) => {
        if (coords) setDriverCurrentCoords(coords);
      });

      const pickupTarget = tour?.pickupLocation || '';
      if (pickupTarget) {
        geocodePlace(pickupTarget).then((geo) => {
          if (geo) {
            setPickupCoords({ lat: geo.lat, lon: geo.lon, name: pickupTarget });
          }
        });
      }

      const destTarget = tour?.dropLocation || tour?.destination || '';
      if (destTarget) {
        geocodePlace(destTarget).then((geo) => {
          if (geo) {
            setDestinationCoords({ lat: geo.lat, lon: geo.lon, name: destTarget });
          }
        });
      }
    }
  }, [showRouteChangeModal, tour?.pickupLocation, tour?.dropLocation, tour?.destination]);

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
      console.warn('[ActiveTour] Offline/Error fetching tour, displaying demo tour details');
      setTour({
        id: bookingId || 'TR-8921',
        customerName: 'Alexander Wright',
        customerPhone: '+44 7911 123456',
        vehicleNo: 'WP CAD-4921',
        startDate: '2026-10-25',
        endDate: '2026-10-28',
        pickupLocation: 'Bandaranaike International Airport (BIA)',
        destination: 'Cinnamon Citadel, Kandy',
        dropLocation: 'Cinnamon Citadel, Kandy',
        status: 'ONGOING',
        startMeter: '45210',
        notes: 'VIP Guests. Prefer scenic mountain routes and tea factory stop.',
        companyName: 'Ceylon Horizon Fleet',
        companyPhone: '+94 77 123 4567',
        intermediateStops: [
          { id: '1', name: 'Pinnawala Elephant Orphanage', lat: 7.3013, lon: 80.3871 },
          { id: '2', name: 'Giragama Tea Factory', lat: 7.2789, lon: 80.5312 },
        ],
      } as any);
      setIntermediateStops([
        { id: '1', name: 'Pinnawala Elephant Orphanage', lat: 7.3013, lon: 80.3871 },
        { id: '2', name: 'Giragama Tea Factory', lat: 7.2789, lon: 80.5312 },
      ]);
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
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{ backgroundColor: themeColors.card, padding: 16, borderRadius: 24, borderWidth: 1.5, borderColor: themeColors.cardBorder, marginBottom: 14, alignItems: 'center', justifyContent: 'center' }}>
          <Image 
            source={require('../../assets/logo-icon.png')} 
            style={{ width: 56, height: 56 }} 
            resizeMode="contain" 
          />
        </View>
        <Text style={{ fontSize: 24, fontWeight: '900', color: themeColors.textPrimary, letterSpacing: 2 }}>VIGIL</Text>
        <Text style={{ color: colors.primary[500], fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 4 }}>
          Loading Tour & GPS Radar...
        </Text>
        <ActivityIndicator size="small" color={colors.primary[500]} style={{ marginTop: 16 }} />
      </SafeAreaView>
    );
  }

  if (!tour) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ color: themeColors.textSecondary, fontSize: 14, fontWeight: '600' }}>Tour not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[themeStyles.btnPrimary, { marginTop: 16, paddingHorizontal: 24 }]}>
          <Text style={themeStyles.btnPrimaryText}>Go Back</Text>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={{ backgroundColor: themeColors.card, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: themeColors.cardBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[themeStyles.btnSecondary, isDark && { backgroundColor: '#161E2E', borderColor: '#28354D' }, { paddingHorizontal: 12, paddingVertical: 6, marginRight: 10 }]}>
          <Text style={[themeStyles.btnSecondaryText, { color: themeColors.textPrimary }]}>← Back</Text>
        </TouchableOpacity>

        {/* Center / Right: Tour Company Badge (56px right padding leaves clean clearance for ArcNavbar button) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end', minWidth: 0, paddingRight: 56 }}>
          {tour?.company?.logoUrl ? (
            <View style={{ width: 32, height: 32, backgroundColor: themeColors.card, borderRadius: 8, borderWidth: 1, borderColor: themeColors.cardBorder, padding: 2, marginRight: 8, alignItems: 'center', justifyContent: 'center' }}>
              <Image 
                source={{ uri: tour.company.logoUrl }} 
                style={{ width: 24, height: 24 }} 
                resizeMode="contain" 
              />
            </View>
          ) : null}
          <View style={{ alignItems: 'flex-end', minWidth: 0 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: themeColors.textPrimary }} numberOfLines={1}>
              {tour?.company?.companyName || 'Tour'}
            </Text>
            <View style={{ backgroundColor: colors.plate.bg, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4, marginTop: 2 }}>
              <Text style={{ fontSize: 9.5, color: colors.plate.text, fontWeight: '800', fontFamily: 'monospace', letterSpacing: 0.5 }}>
                {tour.vehicleNo}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {/* Operating Company Header Banner */}
        {tour?.company?.companyName && (
          <View style={{ backgroundColor: themeColors.card, borderColor: themeColors.cardBorder, borderWidth: 1 }} className="rounded-xl p-3 shadow-sm mb-4 flex-row items-center">
            {tour.company.logoUrl ? (
              <View style={{ backgroundColor: themeColors.card, borderColor: themeColors.cardBorder }} className="w-11 h-11 rounded-lg border p-1 items-center justify-center mr-3">
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
              <Text style={{ color: themeColors.textSecondary }} className="text-[10px] font-bold uppercase tracking-wider">Transport Company</Text>
              <Text style={{ color: themeColors.textPrimary }} className="text-sm font-bold truncate">{tour.company.companyName}</Text>
              {tour.company.phone ? (
                <Text style={{ color: themeColors.textSecondary }} className="text-xs">Dispatch: {tour.company.phone}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Vehicle Breakdown Reported Alert Banner */}
        {isBreakdownReported && (
          <View
            style={{
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.5)' : '#F87171',
              borderWidth: 1.5,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ color: isDark ? '#FCA5A5' : '#991B1B', fontWeight: '900', fontSize: 15 }}>
                🚨 Vehicle Breakdown Reported
              </Text>
            </View>
            <Text style={{ color: isDark ? '#FECDD3' : '#B91C1C', fontSize: 12.5, lineHeight: 18, fontWeight: '500' }}>
              Company dispatch has received your vehicle breakdown report and is arranging an emergency replacement vehicle. Keep your phone reachable. Live GPS radar remains active so dispatch can locate you.
            </Text>
          </View>
        )}

        {/* Vehicle Swapped Banner */}
        {wasVehicleSwapped && (
          <View
            style={{
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.16)' : '#EEF2FF',
              borderColor: isDark ? 'rgba(99, 102, 241, 0.5)' : '#818CF8',
              borderWidth: 1.5,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ color: isDark ? '#C7D2FE' : '#3730A3', fontWeight: '900', fontSize: 15 }}>
                🔄 Vehicle Replaced: {tour.vehicleNo}
              </Text>
            </View>
            <Text style={{ color: isDark ? '#E0E7FF' : '#4338CA', fontSize: 12.5, lineHeight: 18, fontWeight: '500' }}>
              Tour vehicle was successfully replaced mid-tour. You are currently operating under replacement vehicle {tour.vehicleNo}.
            </Text>
          </View>
        )}

        {/* Mid-Tour Handover Takeover Card (for replacement driver) */}
        {needsTakeover && (
          <View
            style={{
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FFFBEB',
              borderColor: isDark ? '#F59E0B' : '#FBBF24',
              borderWidth: 2,
              borderRadius: 20,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: isDark ? '#FDE68A' : '#78350F', fontWeight: '900', fontSize: 15 }}>
                ⚡ Mid-Tour Handover Assigned
              </Text>
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.25)' : '#FDE68A',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: isDark ? '#FDE68A' : '#78350F', fontWeight: '900', fontSize: 10, letterSpacing: 0.8 }}>
                  TAKEOVER REQUIRED
                </Text>
              </View>
            </View>

            <Text style={{ color: isDark ? '#FCD34D' : '#92400E', fontSize: 12, lineHeight: 17, marginBottom: 12, fontWeight: '500' }}>
              This tour is currently underway. You have been assigned as the replacement driver by dispatch. Navigate to the vehicle handover point below to inspect the vehicle and take over the tour.
            </Text>

            {/* Handover Details Box */}
            <View
              style={{
                backgroundColor: isDark ? '#141C2B' : '#FFFFFF',
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
                marginBottom: 14,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                <Text style={{ color: isDark ? '#FBBF24' : '#92400E', fontWeight: '800', fontSize: 12, width: 110 }}>
                  📍 Handover Point:
                </Text>
                <Text style={{ color: themeColors.textPrimary, fontWeight: '800', fontSize: 12, flex: 1 }}>
                  {tour.handoverDetails?.location || tour.pickupLocation || 'Current vehicle location'}
                </Text>
              </View>

              {tour.handoverDetails?.previousDriverName && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ color: isDark ? '#FBBF24' : '#92400E', fontWeight: '800', fontSize: 12, width: 110 }}>
                    👤 Previous Driver:
                  </Text>
                  <Text style={{ color: themeColors.textSecondary, fontWeight: '700', fontSize: 12, flex: 1 }}>
                    {tour.handoverDetails.previousDriverName}
                  </Text>
                </View>
              )}

              {tour.handoverDetails?.reason && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ color: isDark ? '#FBBF24' : '#92400E', fontWeight: '800', fontSize: 12, width: 110 }}>
                    ⚠️ Handover Reason:
                  </Text>
                  <Text style={{ color: themeColors.textSecondary, fontWeight: '700', fontSize: 12, flex: 1 }}>
                    {tour.handoverDetails.reason}
                  </Text>
                </View>
              )}

              {tour.handoverDetails?.meterReading && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ color: isDark ? '#FBBF24' : '#92400E', fontWeight: '800', fontSize: 12, width: 110 }}>
                    🚗 Handover Meter:
                  </Text>
                  <Text style={{ color: themeColors.textPrimary, fontWeight: '900', fontSize: 12, flex: 1 }}>
                    {tour.handoverDetails.meterReading} km
                  </Text>
                </View>
              )}

              {tour.handoverDetails?.instructions && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <Text style={{ color: isDark ? '#FBBF24' : '#92400E', fontWeight: '800', fontSize: 12, width: 110 }}>
                    📝 Notes / Info:
                  </Text>
                  <Text style={{ color: themeColors.textSecondary, fontSize: 12, flex: 1 }}>
                    {tour.handoverDetails.instructions}
                  </Text>
                </View>
              )}
            </View>

            {/* Turn-by-Turn Navigation to Handover Location */}
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                onPress={() => openHandoverNavigation('google')}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#2563EB',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 13 }}>
                  🗺️ Navigate to Handover with Google Maps
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openHandoverNavigation('waze')}
                activeOpacity={0.8}
                style={{
                  backgroundColor: '#0891B2',
                  paddingVertical: 11,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 }}>
                  🚗 Navigate with Waze
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Handover Request Pending Banner (for current driver) */}
        {isHandoverRequested && (
          <View
            style={{
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FFFBEB',
              borderColor: isDark ? 'rgba(245, 158, 11, 0.5)' : '#FBBF24',
              borderWidth: 1.5,
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ color: isDark ? '#FDE68A' : '#78350F', fontWeight: '900', fontSize: 15 }}>
                ⏳ Handover Request Sent to Dispatch
              </Text>
            </View>
            <Text style={{ color: isDark ? '#FCD34D' : '#92400E', fontSize: 12.5, lineHeight: 18, fontWeight: '500' }}>
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
          <View style={{ backgroundColor: themeColors.card, borderColor: themeColors.cardBorder, borderWidth: 1 }} className="rounded-xl p-4 shadow-sm mb-4">
            <Text style={{ color: themeColors.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">Turn-by-Turn Navigation</Text>
            <View className="flex-row items-center mb-3">
              <Text style={{ color: themeColors.textPrimary }} className="font-bold text-base flex-1" numberOfLines={1}>
                📍 {primaryDestination}
              </Text>
            </View>
            
            {/* Active Intermediate Stops List Card */}
            {activeIntermediateStops.length > 0 ? (
              <View style={{ backgroundColor: isDark ? '#141C2B' : '#EEF2FF', borderColor: isDark ? '#28354D' : '#C7D2FE', borderWidth: 1 }} className="rounded-xl p-3.5 mb-3.5 shadow-xs">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-1.5">
                    <Text style={{ color: isDark ? '#C7D2FE' : '#312E81' }} className="font-black text-xs uppercase tracking-wide">
                      📍 Intermediate Tour Stops ({activeIntermediateStops.length})
                    </Text>
                  </View>
                  <View className="bg-indigo-200 px-2 py-0.5 rounded-full">
                    <Text className="text-indigo-900 text-[10px] font-black uppercase">ACTIVE ITINERARY</Text>
                  </View>
                </View>

                {activeIntermediateStops.map((stopName, idx) => (
                  <View key={idx} style={{ backgroundColor: isDark ? '#0E131F' : '#FFFFFF', borderColor: isDark ? '#28354D' : '#E0E7FF' }} className="rounded-lg p-2.5 border mb-2 shadow-2xs">
                    <View className="flex-row items-center gap-2 mb-1.5">
                      <View className="w-5 h-5 rounded-full bg-indigo-600 items-center justify-center">
                        <Text className="text-white text-[10px] font-black">{idx + 1}</Text>
                      </View>
                      <Text style={{ color: themeColors.textPrimary }} className="font-bold text-xs flex-1" numberOfLines={1}>
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
              <View style={{ backgroundColor: isDark ? '#141C2B' : '#EEF2FF', borderColor: isDark ? '#28354D' : '#C7D2FE' }} className="border rounded-lg p-2.5 mb-3">
                <View className="flex-row items-center justify-between mb-0.5">
                  <Text style={{ color: isDark ? '#C7D2FE' : '#312E81' }} className="font-black text-[11px] uppercase tracking-wide">
                    🗺️ Route Alteration Logged
                  </Text>
                  <View className="bg-indigo-200 px-1.5 py-0.5 rounded">
                    <Text className="text-indigo-900 text-[9px] font-black">LOGGED</Text>
                  </View>
                </View>
                <Text style={{ color: themeColors.textPrimary }} className="text-xs font-semibold" numberOfLines={2}>
                  {latestRouteChange.note}
                </Text>
              </View>
            ) : null}

            {/* Final Tour Destination Navigation */}
            <View className={activeIntermediateStops.length > 0 ? "border-t border-gray-100 pt-3" : ""}>
              {activeIntermediateStops.length > 0 && (
                <Text style={{ color: themeColors.textSecondary }} className="text-[11px] font-bold uppercase tracking-wider mb-2">
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
              style={{ backgroundColor: isDark ? '#141C2B' : '#EEF2FF', borderColor: isDark ? '#28354D' : '#C7D2FE' }}
              className="mt-2.5 border py-2 rounded-lg flex-row items-center justify-center gap-1.5"
            >
              <Text style={{ color: isDark ? '#93C5FD' : '#3730A3' }} className="font-bold text-xs">
                ✏️ Edit Pickup, Stops & Destination
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Customer & Route Details Card */}
        <View style={{ backgroundColor: themeColors.card, borderColor: themeColors.cardBorder, borderWidth: 1 }} className="rounded-xl p-4 shadow-sm mb-4">
          <Text style={{ color: themeColors.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">Customer Details</Text>
          <Text style={{ color: themeColors.textPrimary }} className="text-xl font-bold mb-1">{tour.customerName}</Text>
          {tour.pickupLocation && (
            <Text style={{ color: themeColors.textSecondary }} className="text-xs mb-1">
              <Text style={{ color: themeColors.textPrimary }} className="font-semibold">Pickup:</Text> {tour.pickupLocation}
            </Text>
          )}
          <Text style={{ color: themeColors.textSecondary }} className="text-xs mb-2">
            <Text style={{ color: themeColors.textPrimary }} className="font-semibold">Destination:</Text> {tour.destination || 'Not specified'}
          </Text>

          {tour.customerPhone && (
            <TouchableOpacity 
              onPress={() => Linking.openURL(`tel:${tour.customerPhone}`)}
              className="flex-row items-center mt-1 py-1"
            >
              <Text className="text-blue-500 font-bold text-sm">📞 {tour.customerPhone}</Text>
              <Text style={{ color: themeColors.textMuted }} className="text-xs ml-2">(Tap to call customer)</Text>
            </TouchableOpacity>
          )}

          {tour.customerEmail && (
            <TouchableOpacity 
              onPress={() => Linking.openURL(`mailto:${tour.customerEmail}`)}
              className="flex-row items-center mt-0.5 py-0.5"
            >
              <Text className="text-blue-400 text-xs">✉️ {tour.customerEmail}</Text>
            </TouchableOpacity>
          )}
          
          <View style={{ backgroundColor: isDark ? '#141C2B' : '#EFF6FF', borderColor: isDark ? '#28354D' : '#BFDBFE', borderWidth: 1 }} className="p-3 rounded-lg mt-2">
            <Text style={{ color: isDark ? '#93C5FD' : '#1E40AF' }} className="text-sm">{tour.notes || 'No special notes.'}</Text>
          </View>
        </View>

        {/* Itinerary Day-by-Day Stops (if available from quotation schedule) */}
        {tour.itineraryDays && tour.itineraryDays.length > 0 && (
          <View style={{ backgroundColor: themeColors.card, borderColor: themeColors.cardBorder, borderWidth: 1 }} className="rounded-xl p-4 shadow-sm mb-4">
            <Text style={{ color: themeColors.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">Tour Itinerary Stops</Text>
            {tour.itineraryDays.map((item: any, idx: number) => (
              <View key={idx} style={{ borderBottomColor: themeColors.cardBorder }} className="py-2 border-b flex-row items-center justify-between">
                <View className="flex-1 pr-2">
                  <Text style={{ color: themeColors.textPrimary }} className="text-sm font-bold">Day {item.day}: {item.title}</Text>
                  {item.description && (
                    <Text style={{ color: themeColors.textSecondary }} className="text-xs" numberOfLines={1}>{item.description}</Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => openNavigation('google', item.title)}
                  style={{ backgroundColor: isDark ? '#161E2E' : '#F3F4F6', borderColor: themeColors.cardBorder }}
                  className="px-2.5 py-1.5 rounded border"
                >
                  <Text className="text-xs text-blue-500 font-semibold">Navigate</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Status & Actions Card */}
        <View style={{ backgroundColor: themeColors.card, borderColor: themeColors.cardBorder, borderWidth: 1 }} className="rounded-xl p-4 shadow-sm mb-4">
          <Text style={{ color: themeColors.textSecondary }} className="text-xs font-bold uppercase tracking-wider mb-2">Trip Status</Text>
          
          <View className={`px-3 py-1 rounded-full self-start mb-4 ${isCompleted ? 'bg-gray-100' : isStarted ? 'bg-green-100' : 'bg-blue-100'}`}>
            <Text className={`font-bold ${isCompleted ? 'text-gray-600' : isStarted ? 'text-green-700' : 'text-blue-700'}`}>
              {tour.status}
            </Text>
          </View>

          {!isCompleted && (
            <View style={{ backgroundColor: isDark ? '#141C2B' : '#F9FAFB', borderColor: themeColors.cardBorder }} className="p-3.5 rounded-xl border mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text style={{ color: themeColors.textPrimary }} className="font-bold text-sm">
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
                style={{ backgroundColor: isDark ? '#0E131F' : '#FFFFFF', borderColor: themeColors.cardBorder, color: themeColors.textPrimary }}
                className="border rounded-lg px-3.5 py-2.5 font-semibold text-base"
                placeholder={needsTakeover && tour.handoverDetails?.meterReading ? tour.handoverDetails.meterReading : "e.g. 45500"}
                placeholderTextColor={themeColors.textMuted}
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
              style={{
                backgroundColor: colors.telemetry.moving,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: colors.telemetry.moving,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 }}>✅ CONFIRM TAKEOVER & RESUME GPS</Text>}
            </TouchableOpacity>
          ) : isStarted ? (
            <View>
              <TouchableOpacity 
                onPress={() => handleAction('END_TRIP')}
                disabled={actionLoading}
                style={{
                  backgroundColor: colors.telemetry.alert,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: colors.telemetry.alert,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 }}>END TRIP & STOP GPS</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowRouteChangeModal(true)}
                disabled={actionLoading}
                style={[themeStyles.btnSecondary, { marginTop: 10, paddingVertical: 12 }]}
              >
                <Text style={themeStyles.btnSecondaryText}>
                  🗺️ Add Detour / Change Tour Route
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleOpenHandoverModal}
                disabled={actionLoading}
                style={{
                  backgroundColor: '#FFFBEB',
                  borderWidth: 1.5,
                  borderColor: '#FDE68A',
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: 'center',
                  marginTop: 10,
                }}
              >
                <Text style={{ color: '#92400E', fontWeight: '800', fontSize: 13.5 }}>
                  {isHandoverRequested ? '✏️ Update Handover Request' : '⚠️ Request Mid-Tour Driver Handover'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleOpenBreakdownModal}
                disabled={actionLoading}
                style={{
                  backgroundColor: '#FFF1F2',
                  borderWidth: 1.5,
                  borderColor: '#FECDD3',
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: 'center',
                  marginTop: 10,
                }}
              >
                <Text style={{ color: colors.telemetry.alert, fontWeight: '800', fontSize: 13.5 }}>
                  {isBreakdownReported ? '✏️ Update Breakdown Report' : '🚨 Report Vehicle Breakdown'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TouchableOpacity 
                onPress={() => handleAction('START_TRIP')}
                disabled={actionLoading}
                style={themeStyles.btnPrimary}
              >
                {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={themeStyles.btnPrimaryText}>START TRIP & BROADCAST GPS</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowRouteChangeModal(true)}
                disabled={actionLoading}
                style={[themeStyles.btnSecondary, { marginTop: 10, paddingVertical: 12 }]}
              >
                <Text style={themeStyles.btnSecondaryText}>
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
                <View
                  key={activity.id}
                  style={{
                    backgroundColor: isDark ? '#141C2B' : '#FFFFFF',
                    borderColor: isDark ? '#222F45' : '#E2E8F0',
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View className={`w-2 h-10 rounded-full mr-3 ${barColor}`} />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-0.5">
                      <Text style={{ color: themeColors.textPrimary, fontWeight: '800', fontSize: 12 }}>
                        {activity.type}
                      </Text>
                      <Text style={{ color: themeColors.textMuted, fontSize: 11, fontWeight: '500' }}>
                        {new Date(activity.timestamp).toLocaleString()}
                      </Text>
                    </View>
                    <Text style={{ color: themeColors.textSecondary, fontSize: 13, fontWeight: '600' }}>
                      {activity.note}
                    </Text>
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
          <View style={{ backgroundColor: isDark ? '#0E131F' : '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: isDark ? '#222F45' : '#E2DDD4' }}>
            <View className="flex-row justify-between items-center mb-4">
              <Text style={{ fontSize: 20, fontWeight: '900', color: themeColors.textPrimary }}>Request Mid-Tour Handover</Text>
              <TouchableOpacity onPress={() => setShowHandoverModal(false)} className="p-1">
                <Text style={{ color: themeColors.textMuted, fontWeight: '700', fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginBottom: 16 }}>
              If you cannot continue driving due to sickness, fatigue, or emergency, notify dispatch immediately.
            </Text>

            <Text style={{ color: themeColors.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 6, textTransform: 'uppercase' }}>Reason for Handover</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {['Medical / Sickness', 'Family Emergency', 'Vehicle Issue', 'Shift End / Fatigue', 'Other'].map((r) => {
                const isSelected = handoverReason === r;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setHandoverReason(r)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      borderWidth: 1,
                      backgroundColor: isSelected ? (isDark ? 'rgba(245, 158, 11, 0.25)' : '#FEF3C7') : (isDark ? '#141C2B' : '#F9FAFB'),
                      borderColor: isSelected ? '#F59E0B' : themeColors.cardBorder,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#FBBF24' : themeColors.textSecondary }}>{r}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ color: themeColors.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 4, textTransform: 'uppercase' }}>
              Current Odometer Reading (KM) <Text style={{ color: '#EF4444', fontWeight: '900' }}>* (Required)</Text>
            </Text>
            <TextInput
              style={{
                backgroundColor: isDark ? '#141C2B' : '#F9FAFB',
                borderWidth: 1,
                borderColor: themeColors.cardBorder,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: themeColors.textPrimary,
                marginBottom: 16,
                fontWeight: '600',
              }}
              placeholder="e.g. 45350"
              placeholderTextColor={themeColors.textMuted}
              keyboardType="numeric"
              value={handoverMeter}
              onChangeText={setHandoverMeter}
            />

            <View className="flex-row justify-between items-center mb-1">
              <Text style={{ color: themeColors.textSecondary, fontWeight: '700', fontSize: 12, textTransform: 'uppercase' }}>Current Location (Auto-detected from GPS)</Text>
              <TouchableOpacity
                onPress={() => autoDetectLocation('handover')}
                disabled={isDetectingLocation}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#FCD34D',
                }}
              >
                {isDetectingLocation ? (
                  <ActivityIndicator size="small" color="#F59E0B" />
                ) : (
                  <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#FBBF24' : '#B45309' }}>🔄 GPS Sync</Text>
                )}
              </TouchableOpacity>
            </View>
            <TextInput
              style={{
                backgroundColor: isDark ? '#141C2B' : '#F9FAFB',
                borderWidth: 1,
                borderColor: themeColors.cardBorder,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: themeColors.textPrimary,
                marginBottom: 16,
                fontSize: 12,
                fontWeight: '600',
              }}
              placeholder={isDetectingLocation ? '📍 Detecting GPS location...' : 'Current location (auto-filled from GPS)'}
              placeholderTextColor={themeColors.textMuted}
              value={handoverLocation}
              onChangeText={setHandoverLocation}
            />

            <Text style={{ color: themeColors.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 4, textTransform: 'uppercase' }}>Additional Notes / Situation</Text>
            <TextInput
              style={{
                backgroundColor: isDark ? '#141C2B' : '#F9FAFB',
                borderWidth: 1,
                borderColor: themeColors.cardBorder,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: themeColors.textPrimary,
                marginBottom: 20,
                fontSize: 12,
                fontWeight: '600',
              }}
              placeholder="e.g. Resting at Ambepussa, doctor advised 2 days rest"
              placeholderTextColor={themeColors.textMuted}
              value={handoverNote}
              onChangeText={setHandoverNote}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowHandoverModal(false)}
                style={{
                  flex: 1,
                  backgroundColor: isDark ? '#161E2E' : '#F3F4F6',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: themeColors.cardBorder,
                }}
              >
                <Text style={{ color: themeColors.textPrimary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitHandoverRequest}
                disabled={handoverSubmitting}
                style={{
                  flex: 1,
                  backgroundColor: '#D97706',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                }}
              >
                {handoverSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Send to Dispatch</Text>
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
          <View style={{ backgroundColor: isDark ? '#0E131F' : '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: isDark ? '#222F45' : '#E2DDD4', maxHeight: '85%' }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="flex-row justify-between items-center mb-3">
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#EF4444' }}>🚨 Report Vehicle Breakdown</Text>
                <TouchableOpacity onPress={() => setShowBreakdownModal(false)} className="p-1">
                  <Text style={{ color: themeColors.textMuted, fontWeight: '700', fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginBottom: 16 }}>
                If the tour vehicle ({tour.vehicleNo}) suffers a mechanical defect or cannot proceed, alert dispatch immediately with your odometer reading.
              </Text>

              <Text style={{ color: themeColors.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 6, textTransform: 'uppercase' }}>Defect / Issue Type</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {[
                  'Engine / Overheating',
                  'Flat Tyre / Puncture',
                  'Brake Failure',
                  'Transmission / Clutch',
                  'Electrical / Battery',
                  'Accident / Collision',
                  'Other Mechanical Issue',
                ].map((r) => {
                  const isSelected = breakdownReason === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setBreakdownReason(r)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20,
                        borderWidth: 1,
                        backgroundColor: isSelected ? (isDark ? 'rgba(239, 68, 68, 0.25)' : '#FEE2E2') : (isDark ? '#141C2B' : '#F9FAFB'),
                        borderColor: isSelected ? '#EF4444' : themeColors.cardBorder,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#F87171' : themeColors.textSecondary }}>{r}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={{ color: themeColors.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 4, textTransform: 'uppercase' }}>
                Current Odometer Reading (KM) <Text style={{ color: '#EF4444', fontWeight: '900' }}>* (Required)</Text>
              </Text>
              <TextInput
                style={{
                  backgroundColor: isDark ? '#141C2B' : '#F9FAFB',
                  borderWidth: 1,
                  borderColor: themeColors.cardBorder,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: themeColors.textPrimary,
                  marginBottom: 16,
                  fontWeight: '600',
                }}
                placeholder="e.g. 45820"
                placeholderTextColor={themeColors.textMuted}
                keyboardType="numeric"
                value={breakdownMeter}
                onChangeText={setBreakdownMeter}
              />

              <View className="flex-row justify-between items-center mb-1">
                <Text style={{ color: themeColors.textSecondary, fontWeight: '700', fontSize: 12, textTransform: 'uppercase' }}>Current Breakdown Location (Auto-detected from GPS)</Text>
                <TouchableOpacity
                  onPress={() => autoDetectLocation('breakdown')}
                  disabled={isDetectingLocation}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FCA5A5',
                  }}
                >
                  {isDetectingLocation ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Text style={{ fontSize: 10, fontWeight: '900', color: isDark ? '#F87171' : '#B91C1C' }}>🔄 GPS Sync</Text>
                  )}
                </TouchableOpacity>
              </View>
              <TextInput
                style={{
                  backgroundColor: isDark ? '#141C2B' : '#F9FAFB',
                  borderWidth: 1,
                  borderColor: themeColors.cardBorder,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: themeColors.textPrimary,
                  marginBottom: 16,
                  fontSize: 12,
                  fontWeight: '600',
                }}
                placeholder={isDetectingLocation ? '📍 Detecting GPS location...' : 'Current location (auto-filled from GPS)'}
                placeholderTextColor={themeColors.textMuted}
                value={breakdownLocation}
                onChangeText={setBreakdownLocation}
              />

              <Text style={{ color: themeColors.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 4, textTransform: 'uppercase' }}>Description / Passenger Situation</Text>
              <TextInput
                style={{
                  backgroundColor: isDark ? '#141C2B' : '#F9FAFB',
                  borderWidth: 1,
                  borderColor: themeColors.cardBorder,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: themeColors.textPrimary,
                  marginBottom: 20,
                  fontSize: 12,
                  fontWeight: '600',
                }}
                placeholder="e.g. Radiator hose leaked, passengers waiting safely at roadside café"
                placeholderTextColor={themeColors.textMuted}
                multiline
                numberOfLines={2}
                value={breakdownNote}
                onChangeText={setBreakdownNote}
              />

              <View className="flex-row gap-3 mb-2">
                <TouchableOpacity
                  onPress={() => setShowBreakdownModal(false)}
                  style={{
                    flex: 1,
                    backgroundColor: isDark ? '#161E2E' : '#F3F4F6',
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: themeColors.cardBorder,
                  }}
                >
                  <Text style={{ color: themeColors.textPrimary, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submitBreakdownReport}
                  disabled={breakdownSubmitting}
                  style={{
                    flex: 1,
                    backgroundColor: '#DC2626',
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                  }}
                >
                  {breakdownSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Report to Dispatch</Text>
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
          <View style={{ backgroundColor: isDark ? '#0E131F' : '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: isDark ? '#222F45' : '#E2DDD4', maxHeight: '90%' }}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="flex-row justify-between items-center mb-2">
                <View>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: themeColors.textPrimary }}>Tour Itinerary Planner</Text>
                  <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>Edit pickup, add/remove stops, or change destination</Text>
                </View>
                <TouchableOpacity onPress={() => setShowRouteChangeModal(false)} className="p-1">
                  <Text style={{ color: themeColors.textMuted, fontWeight: '700', fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* OpenStreetMap Itinerary & Route Picker */}
              <OpenStreetMapPicker
                currentLocation={
                  pickupCoords || {
                    name: tour.pickupLocation || 'Pickup Location',
                    lat: 6.8406,
                    lon: 80.0573,
                  }
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
                <Text style={{ color: themeColors.textSecondary, fontWeight: '700', fontSize: 12, textTransform: 'uppercase' }}>
                  Estimated Extra Distance (KM)
                </Text>
                {extraKmInput ? (
                  <Text style={{ fontSize: 11, fontWeight: '800', color: isDark ? '#34D399' : '#047857' }}>
                    ✓ Auto-Calculated via OSM
                  </Text>
                ) : null}
              </View>
              <TextInput
                style={{
                  backgroundColor: isDark ? '#141C2B' : '#F9FAFB',
                  borderWidth: 1,
                  borderColor: themeColors.cardBorder,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: themeColors.textPrimary,
                  marginBottom: 12,
                  fontSize: 14,
                  fontWeight: '600',
                }}
                placeholder="e.g. 25"
                placeholderTextColor={themeColors.textMuted}
                keyboardType="numeric"
                value={extraKmInput}
                onChangeText={setExtraKmInput}
              />

              {/* Reason Selector */}
              <Text style={{ color: themeColors.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 6, textTransform: 'uppercase' }}>
                Reason for Route Alteration
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {[
                  'Guest Requested Sightseeing Detour',
                  'Hotel / City Changed by Guests',
                  'Weather / Road Block Bypass',
                  'Flight / Timing Reschedule',
                  'Other',
                ].map((reason) => {
                  const isSelected = routeChangeReason === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      onPress={() => setRouteChangeReason(reason)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20,
                        borderWidth: 1,
                        backgroundColor: isSelected ? (isDark ? 'rgba(99, 102, 241, 0.25)' : '#EEF2FF') : (isDark ? '#141C2B' : '#F9FAFB'),
                        borderColor: isSelected ? '#6366F1' : themeColors.cardBorder,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? (isDark ? '#A5B4FC' : '#312E81') : themeColors.textSecondary }}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Passenger Agreement Toggle */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setCustomerAgreed(!customerAgreed)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? '#161E2E' : '#EEF2FF',
                  borderWidth: 1,
                  borderColor: isDark ? '#28354D' : '#C7D2FE',
                  padding: 12,
                  borderRadius: 14,
                  marginBottom: 16,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    borderWidth: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                    backgroundColor: customerAgreed ? '#6366F1' : (isDark ? '#101623' : '#FFFFFF'),
                    borderColor: customerAgreed ? '#6366F1' : themeColors.cardBorder,
                  }}
                >
                  {customerAgreed && <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '900' }}>✓</Text>}
                </View>
                <View className="flex-1">
                  <Text style={{ fontSize: 12, fontWeight: '800', color: themeColors.textPrimary }}>Passengers Requested & Agreed</Text>
                  <Text style={{ fontSize: 11, color: isDark ? '#818CF8' : '#4338CA', marginTop: 1 }}>Extra km and detour route authorized by guests</Text>
                </View>
              </TouchableOpacity>

              {/* Notes */}
              <Text style={{ color: themeColors.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 4, textTransform: 'uppercase' }}>Notes / Dispatch Memo</Text>
              <TextInput
                style={{
                  backgroundColor: isDark ? '#141C2B' : '#F9FAFB',
                  borderWidth: 1,
                  borderColor: themeColors.cardBorder,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  color: themeColors.textPrimary,
                  marginBottom: 20,
                  fontSize: 12,
                  fontWeight: '600',
                }}
                placeholder="e.g. Guests wanted to stop for 1.5 hours to watch elephant bathing"
                placeholderTextColor={themeColors.textMuted}
                value={routeChangeNote}
                onChangeText={setRouteChangeNote}
              />

              <View className="flex-row gap-3 pb-4">
                <TouchableOpacity
                  onPress={() => setShowRouteChangeModal(false)}
                  style={{
                    flex: 1,
                    backgroundColor: isDark ? '#161E2E' : '#F3F4F6',
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: themeColors.cardBorder,
                  }}
                >
                  <Text style={{ color: themeColors.textPrimary, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submitRouteChange}
                  disabled={routeChangeSubmitting}
                  style={{
                    flex: 1,
                    backgroundColor: '#4F46E5',
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                  }}
                >
                  {routeChangeSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>Confirm & Save Itinerary</Text>
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

