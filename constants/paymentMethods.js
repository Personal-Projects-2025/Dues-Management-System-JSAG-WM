/** Supported payment methods for SMS reminder instructions. */
export const PAYMENT_METHODS = [
  'Mobile Money',
  'MTN MoMo',
  'Telecel Cash',
  'AirtelTigo Money',
  'Bank Transfer',
  'Cash',
  'Cheque',
];

export const DEFAULT_PAYMENT_METHOD = PAYMENT_METHODS[0];

export const isAllowedPaymentMethod = (value) => {
  const trimmed = String(value || '').trim();
  return PAYMENT_METHODS.includes(trimmed);
};
