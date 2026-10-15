export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Dashboard: undefined;
  Calendar: undefined;
  AddExpense: { bookingId?: string; vehicleNo?: string };
  ActiveTour: { bookingId: string };
};
