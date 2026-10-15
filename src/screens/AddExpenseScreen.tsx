import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { apiClient } from '../api/client';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

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

  const categories = ['FUEL', 'SERVICE', 'REPAIR', 'BREAKDOWN', 'OTHER'];

  const handleSubmit = async () => {
    if (!vehicleNo || !amount || !category) {
      Alert.alert('Error', 'Please fill in vehicle number, amount, and category.');
      return;
    }

    Alert.alert(
      'Confirm Expense',
      `Are you sure you want to save this expense?\n\nAmount: Rs. ${amount}\nCategory: ${category}\nPaid By: ${expenseType}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            setLoading(true);
            try {
              const response = await apiClient.post('/driver/expenses', {
                vehicleNo,
                amount,
                category,
                description,
                bookingId,
                expenseType
              });

              if (response.data?.success) {
                Alert.alert('Success', 'Expense saved successfully!', [
                  { text: 'OK', onPress: () => navigation.goBack() }
                ]);
              } else {
                Alert.alert('Error', response.data?.error || 'Failed to save expense');
              }
            } catch (error: any) {
              console.error(error);
              Alert.alert('Error', error.response?.data?.error || 'Network error');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 py-3.5 bg-white border-b border-gray-200 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
            <Text className="text-blue-600 text-base font-bold">← Back</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-800">Add Trip Expense</Text>
        </View>

        <View className="flex-row items-center bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
          <Image 
            source={require('../../assets/logo-icon.png')} 
            style={{ width: 14, height: 14 }} 
            resizeMode="contain" 
          />
          <Text className="text-white text-[10px] font-bold ml-1 tracking-wider">VIGIL</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-6 pt-6">
        <View className="mb-4">
          <Text className="text-gray-700 font-medium mb-1">Vehicle No</Text>
          <TextInput
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-800"
            placeholder="e.g. WP CAB-1234"
            value={vehicleNo}
            onChangeText={setVehicleNo}
          />
        </View>

        <View className="mb-4">
          <Text className="text-gray-700 font-medium mb-1">Amount (Rs)</Text>
          <TextInput
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-800"
            placeholder="0.00"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        <View className="mb-4">
          <Text className="text-gray-700 font-medium mb-2">Category</Text>
          <View className="flex-row flex-wrap gap-2">
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                className={`px-4 py-2 rounded-full border ${category === cat ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-300'}`}
              >
                <Text className={`${category === cat ? 'text-blue-700 font-bold' : 'text-gray-600'}`}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-gray-700 font-medium mb-2">Paid By</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setExpenseType('COMPANY')}
              className={`flex-1 py-3 rounded-lg border ${expenseType === 'COMPANY' ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}
            >
              <Text className={`text-center font-bold ${expenseType === 'COMPANY' ? 'text-white' : 'text-gray-700'}`}>Company</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setExpenseType('CUSTOMER')}
              className={`flex-1 py-3 rounded-lg border ${expenseType === 'CUSTOMER' ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}
            >
              <Text className={`text-center font-bold ${expenseType === 'CUSTOMER' ? 'text-white' : 'text-gray-700'}`}>Customer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="mb-6">
          <Text className="text-gray-700 font-medium mb-1">Description (Optional)</Text>
          <TextInput
            className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-800"
            placeholder="Reason or details..."
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
          className={`w-full py-4 rounded-lg items-center ${loading ? 'bg-blue-400' : 'bg-blue-600'}`}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white font-bold text-lg">Save Expense</Text>
          )}
        </TouchableOpacity>
        
        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
