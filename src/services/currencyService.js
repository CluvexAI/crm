export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', flag: '🇸🇦' },
];

export const BASE_CURRENCY = 'EUR';

export const EXCHANGE_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  AUD: 1.53,
  CAD: 1.36,
  INR: 83.12,
  AED: 3.67,
  SAR: 3.75,
};

export const getCurrencyByCode = (code) => {
  return CURRENCIES.find(c => c.code === code) || null;
};

export const getCurrencySymbol = (code) => {
  const currency = getCurrencyByCode(code);
  return currency?.symbol || code;
};

export const getExchangeRate = (fromCurrency, toCurrency = BASE_CURRENCY) => {
  const fromRate = EXCHANGE_RATES[fromCurrency] || 1;
  const toRate = EXCHANGE_RATES[toCurrency] || 1;
  return fromRate / toRate;
};

export const getLiveExchangeRate = () => {
  return parseFloat(localStorage.getItem('ZSM_EUR_EXCHANGE_RATE') || '0.92');
};

export const setLiveExchangeRate = (rate) => {
  localStorage.setItem('ZSM_EUR_EXCHANGE_RATE', rate.toString());
};

export const convertToEUR = (usdAmount, exchangeRate = getLiveExchangeRate()) => {
  if (!usdAmount || isNaN(usdAmount)) return 0;
  return Number((usdAmount * exchangeRate).toFixed(2));
};

export const convertCurrency = (amount, fromCurrency, toCurrency = BASE_CURRENCY) => {
  if (!amount || isNaN(amount)) return 0;
  const rate = getExchangeRate(fromCurrency, toCurrency);
  return amount * rate;
};

export const normalizeToDisplayCurrency = (
  amount,
  paymentCurrency,
  displayCurrency = BASE_CURRENCY,
  exchangeRates = EXCHANGE_RATES
) => {
  if (!amount || isNaN(amount)) return 0;
  // same currency -> no conversion
  if (paymentCurrency === displayCurrency) {
    return amount;
  }

  // convert via USD base
  if (paymentCurrency === "USD") {
    return amount * (exchangeRates[displayCurrency] || 1);
  }

  // if needed, convert other currencies -> USD -> target
  if (displayCurrency === "USD") {
    return amount / (exchangeRates[paymentCurrency] || 1);
  }

  return (
    (amount / (exchangeRates[paymentCurrency] || 1)) *
    (exchangeRates[displayCurrency] || 1)
  );
};

export const formatCurrencyAmount = (amount, currencyCode) => {
  const currency = getCurrencyByCode(currencyCode);
  const symbol = currency?.symbol || '';
  
  if (currencyCode === 'INR') {
    return `${symbol}${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  return `${symbol}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatWithConversion = (amount, currencyCode) => {
  const original = formatCurrencyAmount(amount, currencyCode);
  const converted = convertCurrency(amount, currencyCode, BASE_CURRENCY);
  const baseFormatted = formatCurrencyAmount(converted, BASE_CURRENCY);
  
  if (currencyCode === BASE_CURRENCY) {
    return original;
  }
  
  return `${original} ≈ ${baseFormatted}`;
};
