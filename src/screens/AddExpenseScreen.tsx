import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { DriverExpenseInputSchema } from '../validations';
import { toast } from '../utils/toast';
import { colors, themeStyles } from '../theme';
import { useTheme } from '../context/ThemeContext';

type AddExpenseRouteProp = RouteProp<RootStackParamList, 'AddExpense'>;
type AddExpenseNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AddExpense'>;

export default function AddExpenseScreen() {
  const route = useRoute<AddExpenseRouteProp>();
  const navigation = useNavigation<AddExpenseNavigationProp>();
  const { isDark, colors: themeColors } = useTheme();
  
  const { bookingId, vehicleNo: initialVehicleNo } = route.params || {};

  const [vehicleNo, setVehicleNo] = useState(initialVehicleNo || '');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('FUEL'); // REPAIR, BREAKDOWN, FUEL, SERVICE, OTHER
  const [description, setDescription] = useState('');
  const [expenseType, setExpenseType] = useState('COMPANY'); // COMPANY, CUSTOMER
  const [loading, setLoading] = useState(false);

  const categories = [
    {
      id: 'FUEL',
      label: '⛽ Fuel Fill',
      color: isDark ? '#FB923C' : colors.primary[500],
      bg: isDark ? 'rgba(232, 115, 42, 0.2)' : colors.primary[50],
      border: isDark ? '#EA580C' : colors.primary[300],
    },
    {
      id: 'SERVICE',
      label: '⚙️ Service',
      color: isDark ? '#38BDF8' : colors.primary[600],
      bg: isDark ? 'rgba(56, 189, 248, 0.2)' : colors.primary[100],
      border: isDark ? '#0284C7' : colors.primary[300],
    },
    {
      id: 'REPAIR',
      label: '🔧 Repair',
      color: isDark ? '#FBBF24' : '#EA580C',
      bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FFF7ED',
      border: isDark ? '#D97706' : '#FED7AA',
    },
    {
      id: 'BREAKDOWN',
      label: '⚡ Breakdown',
      color: isDark ? '#F87171' : colors.telemetry.alert,
      bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FFF1F2',
      border: isDark ? '#DC2626' : '#FECDD3',
    },
    {
      id: 'OTHER',
      label: '📝 Note / Other',
      color: isDark ? '#E2E8F0' : '#475569',
      bg: isDark ? '#1E293B' : colors.day.secondary,
      border: isDark ? '#334155' : colors.day.secondaryBorder,
    },
  ];

  const handleSubmit = async () => {
    const validation = DriverExpenseInputSchema.safeParse({
      vehicleNo,
      amount,
      category,
      description: description || undefined,
      expenseType,
      bookingId,
    });

    if (!validation.success) {
      toast.warning('Validation Error', validation.error.issues[0]?.message || 'Please check your expense details.');
      return;
    }

    const validData = validation.data;

    Alert.alert(
      'Confirm Expense',
      `Are you sure you want to save this expense?\n\nVehicle: ${validData.vehicleNo}\nAmount: Rs. ${validData.amount}\nCategory: ${validData.category}\nPaid By: ${validData.expenseType}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            setLoading(true);
            try {
              const response = await apiClient.post('/driver/expenses', {
                vehicleNo: validData.vehicleNo,
                amount: validData.amount,
                category: validData.category,
                description: validData.description,
                bookingId: validData.bookingId,
                expenseType: validData.expenseType,
              });

              if (response.data?.success) {
                toast.success('Expense Saved', 'Expense logged successfully to office billing!');
                navigation.goBack();
              } else {
                toast.error('Save Failed', response.data?.error || 'Failed to save expense');
              }
            } catch (error: any) {
              console.error(error);
              toast.error('Network Error', error.response?.data?.error || 'Could not save expense.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background }}>
      {/* Top Header matching Admin Desktop App */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: themeColors.card, borderBottomWidth: 1, borderBottomColor: themeColors.cardBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={[themeStyles.btnSecondary, isDark && { backgroundColor: '#161E2E', borderColor: '#28354D' }, { paddingHorizontal: 12, paddingVertical: 6, marginRight: 10 }]}
          >
            <Text style={[themeStyles.btnSecondaryText, { color: themeColors.textPrimary }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '900', color: themeColors.textPrimary }}>Add Trip Expense</Text>
        </View>

        {/* Space reserved for Top-Right Arc Nav Button */}
        <View style={{ width: 44, height: 40 }} />
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        {/* Form Card */}
        <View style={{ backgroundColor: themeColors.card, borderRadius: 20, borderWidth: 1, borderColor: themeColors.cardBorder, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2, marginBottom: 20 }}>
          
          <View style={{ marginBottom: 14 }}>
            <Text style={{ color: themeColors.textPrimary, fontSize: 12.5, fontWeight: '800', marginBottom: 6, letterSpacing: 0.3 }}>
              VEHICLE LICENSE PLATE
            </Text>
            <TextInput
              style={[
                themeStyles.input, 
                isDark && { backgroundColor: '#141C2B', borderColor: '#28354D', color: themeColors.textPrimary },
                { fontFamily: 'monospace', fontWeight: '800', fontSize: 14.5 }
              ]}
              placeholder="e.g. WP CAB-1234"
              placeholderTextColor={themeColors.textMuted}
              value={vehicleNo}
              onChangeText={setVehicleNo}
            />
          </View>

          <View style={{ marginBottom: 14 }}>
            <Text style={{ color: themeColors.textPrimary, fontSize: 12.5, fontWeight: '800', marginBottom: 6, letterSpacing: 0.3 }}>
              AMOUNT (LKR / RS.)
            </Text>
            <TextInput
              style={[
                themeStyles.input, 
                isDark && { backgroundColor: '#141C2B', borderColor: '#28354D', color: themeColors.textPrimary },
                { fontWeight: '900', fontSize: 16 }
              ]}
              placeholder="0.00"
              placeholderTextColor={themeColors.textMuted}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: themeColors.textPrimary, fontSize: 12.5, fontWeight: '800', marginBottom: 8, letterSpacing: 0.3 }}>
              EXPENSE CATEGORY
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {categories.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setCategory(cat.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: isSelected ? cat.border : (isDark ? '#28354D' : themeColors.cardBorder),
                      backgroundColor: isSelected ? cat.bg : (isDark ? '#141C2B' : colors.day.card),
                    }}
                  >
                    <Text style={{ color: isSelected ? cat.color : (isDark ? '#CBD5E1' : '#64748B'), fontWeight: isSelected ? '900' : '700', fontSize: 12.5 }}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: themeColors.textPrimary, fontSize: 12.5, fontWeight: '800', marginBottom: 8, letterSpacing: 0.3 }}>
              PAID BY
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setExpenseType('COMPANY')}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: expenseType === 'COMPANY' ? colors.primary[500] : themeColors.cardBorder,
                  backgroundColor: expenseType === 'COMPANY' ? (isDark ? 'rgba(232, 115, 42, 0.2)' : colors.primary[50]) : (isDark ? '#141C2B' : colors.day.input),
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '800', color: expenseType === 'COMPANY' ? (isDark ? '#FDBA74' : colors.primary[700]) : themeColors.textSecondary, fontSize: 13 }}>
                  🏢 Company Dispatched
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setExpenseType('CUSTOMER')}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: expenseType === 'CUSTOMER' ? colors.primary[500] : themeColors.cardBorder,
                  backgroundColor: expenseType === 'CUSTOMER' ? (isDark ? 'rgba(232, 115, 42, 0.2)' : colors.primary[50]) : (isDark ? '#141C2B' : colors.day.input),
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '800', color: expenseType === 'CUSTOMER' ? (isDark ? '#FDBA74' : colors.primary[700]) : themeColors.textSecondary, fontSize: 13 }}>
                  👤 Tourist / Customer
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: themeColors.textPrimary, fontSize: 12.5, fontWeight: '800', marginBottom: 6, letterSpacing: 0.3 }}>
              DESCRIPTION / RECEIPT NOTE
            </Text>
            <TextInput
              style={[
                themeStyles.input, 
                isDark && { backgroundColor: '#141C2B', borderColor: '#28354D', color: themeColors.textPrimary },
                { minHeight: 70 }
              ]}
              placeholder="e.g. Fuel top-up at Ceypetco Kandy, expressway toll"
              placeholderTextColor={themeColors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
            style={[themeStyles.btnPrimary, { width: '100%' }]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={themeStyles.btnPrimaryText}>
                ✓ SAVE TRIP EXPENSE
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
