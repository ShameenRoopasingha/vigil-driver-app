import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { DriverExpenseInputSchema } from '../validations';
import { toast } from '../utils/toast';

type AddExpenseRouteProp = RouteProp<RootStackParamList, 'AddExpense'>;
type AddExpenseNavigationProp = NativeStackNavigationProp<RootStackParamList, 'AddExpense'>;

export default function AddExpenseScreen() {
  const route = useRoute<AddExpenseRouteProp>();
  const navigation = useNavigation<AddExpenseNavigationProp>();
  
  const { bookingId, vehicleNo: initialVehicleNo } = route.params || {};

  const [vehicleNo, setVehicleNo] = useState(initialVehicleNo || '');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('FUEL'); // REPAIR, BREAKDOWN, FUEL, SERVICE, OTHER
  const [description, setDescription] = useState('');
  const [expenseType, setExpenseType] = useState('COMPANY'); // COMPANY, CUSTOMER
  const [loading, setLoading] = useState(false);

  const categories = [
    { id: 'FUEL', label: '⛽ Fuel', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    { id: 'SERVICE', label: '⚙️ Service', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
    { id: 'REPAIR', label: '🔧 Repair', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
    { id: 'BREAKDOWN', label: '⚡ Breakdown', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    { id: 'OTHER', label: '📝 Other', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
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
                toast.success('Expense Saved', 'Expense logged successfully!');
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Top Header matching Admin App */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: 10 }}
          >
            <Text style={{ color: '#0f172a', fontSize: 13, fontWeight: '800' }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '900', color: '#0f172a' }}>Add Trip Expense</Text>
        </View>

        {/* Space reserved for Top-Right Arc Nav Button */}
        <View style={{ width: 44, height: 40 }} />
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        {/* Form Card */}
        <View style={{ backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, marginBottom: 20 }}>
          
          <View style={{ marginBottom: 14 }}>
            <Text style={{ color: '#334155', fontSize: 13, fontWeight: '800', marginBottom: 6 }}>Vehicle Plate Number</Text>
            <TextInput
              style={{ width: '100%', backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#0f172a', fontFamily: 'monospace', fontWeight: '700' }}
              placeholder="e.g. WP CAB-1234"
              placeholderTextColor="#94a3b8"
              value={vehicleNo}
              onChangeText={setVehicleNo}
            />
          </View>

          <View style={{ marginBottom: 14 }}>
            <Text style={{ color: '#334155', fontSize: 13, fontWeight: '800', marginBottom: 6 }}>Amount (LKR / Rs.)</Text>
            <TextInput
              style={{ width: '100%', backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: '#0f172a', fontWeight: '800' }}
              placeholder="0.00"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#334155', fontSize: 13, fontWeight: '800', marginBottom: 8 }}>Expense Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {categories.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setCategory(cat.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: isSelected ? cat.color : '#e2e8f0',
                      backgroundColor: isSelected ? cat.bg : '#ffffff',
                    }}
                  >
                    <Text style={{ color: isSelected ? cat.color : '#475569', fontWeight: isSelected ? '900' : '700', fontSize: 12 }}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#334155', fontSize: 13, fontWeight: '800', marginBottom: 8 }}>Paid By</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setExpenseType('COMPANY')}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: expenseType === 'COMPANY' ? '#4f46e5' : '#e2e8f0',
                  backgroundColor: expenseType === 'COMPANY' ? '#e0e7ff' : '#f8fafc',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '800', color: expenseType === 'COMPANY' ? '#3730a3' : '#475569', fontSize: 13 }}>
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
                  borderColor: expenseType === 'CUSTOMER' ? '#4f46e5' : '#e2e8f0',
                  backgroundColor: expenseType === 'CUSTOMER' ? '#e0e7ff' : '#f8fafc',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: '800', color: expenseType === 'CUSTOMER' ? '#3730a3' : '#475569', fontSize: 13 }}>
                  👤 Tourist / Customer
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: '#334155', fontSize: 13, fontWeight: '800', marginBottom: 6 }}>Description / Receipt Note</Text>
            <TextInput
              style={{ width: '100%', backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: '#0f172a', minHeight: 70 }}
              placeholder="e.g. Fuel top-up at Ceypetco Kandy, expressway toll"
              placeholderTextColor="#94a3b8"
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
            style={{
              width: '100%',
              backgroundColor: '#10b981',
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
              shadowColor: '#10b981',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.35,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 }}>
                ✓ Save Trip Expense
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
