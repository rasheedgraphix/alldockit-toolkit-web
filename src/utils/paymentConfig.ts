export interface PaymentConfig {
  easypaisaAccountTitle: string;
  easypaisaAccountNumber: string;
  easypaisaIban: string;
  bankName: string;
  jazzcashAccountTitle: string;
  jazzcashAccountNumber: string;
  whatsappNumber: string;
  supportEmail: string;
  monthlyPricePkr: number;
  monthlyPriceUsd: number;
  annualPricePkr: number;
  annualPriceUsd: number;
}

const PAYMENT_CONFIG_KEY = 'alldockit_payment_config_v4';

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  easypaisaAccountTitle: 'Nouman Ur Rasheed',
  easypaisaAccountNumber: '0345-5067874',
  easypaisaIban: 'PK25TMFB0000000098618332',
  bankName: 'Telenor Microfinance Bank',
  jazzcashAccountTitle: 'Nouman Ur Rasheed',
  jazzcashAccountNumber: '0345-5067874',
  whatsappNumber: '923455067874',
  supportEmail: 'hafiznoumanurrasheed4@gmail.com',
  monthlyPricePkr: 499,
  monthlyPriceUsd: 2.99,
  annualPricePkr: 1999,
  annualPriceUsd: 12.99,
};

export function getPaymentConfig(): PaymentConfig {
  try {
    const saved = localStorage.getItem(PAYMENT_CONFIG_KEY);
    if (saved) {
      return { ...DEFAULT_PAYMENT_CONFIG, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.warn('Could not read payment config:', err);
  }
  return DEFAULT_PAYMENT_CONFIG;
}

export function savePaymentConfig(config: Partial<PaymentConfig>): PaymentConfig {
  const current = getPaymentConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(PAYMENT_CONFIG_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event('payment-config-updated'));
  return updated;
}
