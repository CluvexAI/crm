import { COUNTRIES as COUNTRY_LIST, getCountryByDialCode } from './countryService';

export const COUNTRIES = COUNTRY_LIST.map(c => ({
  code: c.dialCode,
  name: c.name,
  flag: c.flag,
  example: '',
}));

export const DEFAULT_COUNTRY = COUNTRIES.find(c => c.code === '+353') || COUNTRIES[0];

export const normalizePhoneNumber = (phoneNumber, countryCode) => {
  if (!phoneNumber) return '';
  
  let cleaned = phoneNumber.replace(/[\s\-\(\)\.\+]/g, '');
  
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }
  
  if (!cleaned.startsWith('+')) {
    if (countryCode && cleaned.startsWith(countryCode.replace('+', ''))) {
      cleaned = '+' + cleaned;
    } else if (countryCode) {
      cleaned = countryCode + cleaned;
    }
  }
  
  return cleaned;
};

export const formatPhoneForDisplay = (phoneNumber) => {
  if (!phoneNumber) return '';
  
  if (phoneNumber.startsWith('+')) {
    const country = COUNTRIES.find(c => phoneNumber.startsWith(c.code));
    if (country) {
      const numberPart = phoneNumber.substring(country.code.length);
      return `${country.flag} +${country.code.replace('+', '')} ${numberPart}`;
    }
  }
  
  return phoneNumber;
};

export const isValidPhoneNumber = (phoneNumber, countryCode) => {
  const normalized = normalizePhoneNumber(phoneNumber, countryCode);
  
  if (!normalized.startsWith('+')) return false;
  
  const numberPart = normalized.substring(1);
  
  if (!/^\d+$/.test(numberPart)) return false;
  
  if (numberPart.length < 7 || numberPart.length > 15) return false;
  
  return true;
};

export const getCountryFromPhone = (phoneNumber) => {
  if (!phoneNumber || !phoneNumber.startsWith('+')) return null;
  
  return COUNTRIES.find(c => phoneNumber.startsWith(c.code)) || null;
};

export const extractCountryCode = (phoneNumber) => {
  const country = getCountryFromPhone(phoneNumber);
  return country?.code || null;
};

export { getCountryByDialCode };

export const formatE164 = (phoneNumber, countryCode) => {
  return normalizePhoneNumber(phoneNumber, countryCode);
};

export const isValidE164 = (phoneNumber) => {
  if (!phoneNumber || !phoneNumber.startsWith('+')) return false;
  
  const numberPart = phoneNumber.substring(1);
  
  if (!/^\d+$/.test(numberPart)) return false;
  
  if (numberPart.length < 7 || numberPart.length > 15) return false;
  
  const country = getCountryFromPhone(phoneNumber);
  if (!country) return false;
  
  return true;
};

export const isSamePhone = (phone1, phone2) => {
  if (!phone1 || !phone2) return false;
  const normalized1 = normalizePhoneNumber(phone1, null);
  const normalized2 = normalizePhoneNumber(phone2, null);
  return normalized1 === normalized2;
};