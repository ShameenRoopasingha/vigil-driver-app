import { z } from 'zod';

// ==========================================
// 1. Driver Authentication Schema
// ==========================================
export const DriverLoginInputSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address (e.g. driver@domain.com)'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(4, 'Password must be at least 4 characters long'),
});

export type DriverLoginInput = z.infer<typeof DriverLoginInputSchema>;

// ==========================================
// 2. Profile - Details Update Schema (Name & Avatar)
// ==========================================
export const DriverProfileDetailsSchema = z.object({
  name: z.string().trim().min(2, 'Driver name must be at least 2 characters long'),
  avatarUrl: z.string().trim().optional().nullable(),
});

export type DriverProfileDetailsInput = z.infer<typeof DriverProfileDetailsSchema>;

// ==========================================
// 2b. Profile - Email Update Schema
// ==========================================
export const DriverEmailUpdateSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address cannot be empty')
    .email('Please enter a valid email address format (e.g. driver@domain.com)'),
});

export type DriverEmailUpdateInput = z.infer<typeof DriverEmailUpdateSchema>;

// ==========================================
// 3. Profile - Password Change Schema
// ==========================================
export const DriverPasswordChangeSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Current password is required to authorize this change'),
    newPassword: z
      .string()
      .min(6, 'New password must be at least 6 characters long'),
    confirmPassword: z
      .string()
      .min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New password and confirmation password do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from your current password',
    path: ['newPassword'],
  });

export type DriverPasswordChangeInput = z.infer<typeof DriverPasswordChangeSchema>;

// ==========================================
// 4. Trip Odometer / Meter Reading Schema
// ==========================================
export const OdometerReadingSchema = z.object({
  meterReading: z
    .string()
    .trim()
    .min(1, 'Dashboard meter reading is required')
    .regex(/^[0-9]+(\.[0-9]+)?$/, 'Meter reading must be a valid positive number')
    .refine((val) => Number(val) > 0, {
      message: 'Meter reading must be greater than 0',
    }),
});

// ==========================================
// 5. Driver Handover Request Schema
// ==========================================
export const DriverHandoverRequestSchema = z.object({
  meterReading: z
    .string()
    .trim()
    .min(1, 'Odometer reading is required for handover verification')
    .regex(/^[0-9]+(\.[0-9]+)?$/, 'Odometer must be a valid number')
    .refine((val) => Number(val) > 0, {
      message: 'Odometer reading must be greater than 0',
    }),
  reason: z
    .string()
    .trim()
    .min(1, 'Please select or specify a reason for the handover'),
  location: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export type DriverHandoverRequestInput = z.infer<typeof DriverHandoverRequestSchema>;

// ==========================================
// 6. Emergency Breakdown Report Schema
// ==========================================
export const DriverBreakdownReportSchema = z.object({
  meterReading: z
    .string()
    .trim()
    .min(1, 'Current odometer reading is required for breakdown verification')
    .regex(/^[0-9]+(\.[0-9]+)?$/, 'Odometer must be a valid number')
    .refine((val) => Number(val) > 0, {
      message: 'Odometer reading must be greater than 0',
    }),
  reason: z
    .string()
    .trim()
    .min(1, 'Please specify the vehicle issue / breakdown defect'),
  location: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export type DriverBreakdownReportInput = z.infer<typeof DriverBreakdownReportSchema>;

// ==========================================
// 7. Add Trip Expense Schema
// ==========================================
export const DriverExpenseInputSchema = z.object({
  vehicleNo: z
    .string()
    .trim()
    .min(1, 'Vehicle number is required'),
  amount: z
    .string()
    .trim()
    .min(1, 'Expense amount is required')
    .regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Please enter a valid amount (e.g. 5000 or 2500.50)')
    .refine((val) => Number(val) > 0, {
      message: 'Expense amount must be greater than 0',
    }),
  category: z.enum(['FUEL', 'SERVICE', 'REPAIR', 'BREAKDOWN', 'OTHER'], {
    message: 'Please select a valid expense category',
  }),
  expenseType: z.enum(['COMPANY', 'CUSTOMER'], {
    message: 'Expense payer must be COMPANY or CUSTOMER',
  }),
  description: z.string().trim().optional(),
  bookingId: z.string().optional(),
});

export type DriverExpenseInput = z.infer<typeof DriverExpenseInputSchema>;
