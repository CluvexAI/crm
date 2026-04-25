import React, { useState, useEffect } from 'react';
import { COUNTRIES, DEFAULT_COUNTRY, normalizePhoneNumber, getCountryFromPhone } from '../services/phoneService';
import { getCountryByDialCode } from '../services/countryService';

const PhoneInput = ({ value, onChange, onBlur, error, placeholder, label, required, defaultCountry }) => {
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (defaultCountry) {
      const country = getCountryByDialCode(defaultCountry.dialCode);
      if (country) {
        setSelectedCountry(country);
      }
    }
  }, [defaultCountry]);

  useEffect(() => {
    if (value) {
      const country = getCountryFromPhone(value);
      if (country) {
        setSelectedCountry(country);
        const numberPart = value.substring(country.code.length);
        setPhoneNumber(numberPart);
      } else {
        setPhoneNumber(value);
      }
    }
  }, [value]);

  const filteredCountries = COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.includes(searchQuery)
  );

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setShowDropdown(false);
    setSearchQuery('');
    
    if (phoneNumber) {
      const fullNumber = normalizePhoneNumber(phoneNumber, country.code);
      onChange(fullNumber);
    }
  };

  const handlePhoneChange = (e) => {
    const input = e.target.value.replace(/[^\d]/g, '');
    setPhoneNumber(input);
    
    const fullNumber = normalizePhoneNumber(input, selectedCountry.code);
    onChange(fullNumber);
  };

  const handleBlur = () => {
    if (phoneNumber) {
      const fullNumber = normalizePhoneNumber(phoneNumber, selectedCountry.code);
      onChange(fullNumber);
    }
    if (onBlur) onBlur();
  };

  const displayedNumber = value 
    ? value.substring(selectedCountry.code.length)
    : phoneNumber;

  return (
    <div style={styles.container}>
      {label && (
        <label style={styles.label}>
          {label}
          {required && <span style={styles.required}> *</span>}
        </label>
      )}
      
      <div style={styles.inputWrapper}>
        <div style={styles.countrySelector}>
          <button
            type="button"
            style={styles.countryButton}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <span style={styles.flag}>{selectedCountry.flag}</span>
            <span style={styles.countryCode}>{selectedCountry.code}</span>
            <span style={styles.arrow}>▼</span>
          </button>
          
          {showDropdown && (
            <div style={styles.dropdown}>
              <div style={styles.searchWrapper}>
                <input
                  type="text"
                  placeholder="Search country..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={styles.searchInput}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div style={styles.countryList}>
                {filteredCountries.map((country) => (
                  <button
                    key={country.code + country.name}
                    type="button"
                    style={{
                      ...styles.countryOption,
                      ...(selectedCountry.code === country.code ? styles.countryOptionSelected : {}),
                    }}
                    onClick={() => handleCountrySelect(country)}
                  >
                    <span style={styles.flag}>{country.flag}</span>
                    <span style={styles.countryName}>{country.name}</span>
                    <span style={styles.optionCode}>{country.code}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <input
          type="tel"
          value={displayedNumber}
          onChange={handlePhoneChange}
          onBlur={handleBlur}
          placeholder={selectedCountry.example}
          style={{
            ...styles.phoneInput,
            ...(error ? styles.phoneInputError : {}),
          }}
        />
      </div>
      
      {error && <div style={styles.error}>{error}</div>}
      
      {selectedCountry && (
        <div style={styles.hint}>
          Example: {selectedCountry.flag} {selectedCountry.code} {selectedCountry.example}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  required: {
    color: 'var(--danger)',
  },
  inputWrapper: {
    display: 'flex',
    gap: '8px',
  },
  countrySelector: {
    position: 'relative',
  },
  countryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: '6px 0 0 6px',
    background: 'var(--bg-secondary)',
    cursor: 'pointer',
    height: '42px',
    fontSize: '14px',
  },
  flag: {
    fontSize: '18px',
  },
  countryCode: {
    fontFamily: 'monospace',
    fontWeight: 600,
  },
  arrow: {
    fontSize: '10px',
    color: 'var(--text-muted)',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '4px',
    background: 'white',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 1000,
    width: '280px',
    maxHeight: '300px',
    overflow: 'hidden',
  },
  searchWrapper: {
    padding: '8px',
    borderBottom: '1px solid var(--border-light)',
  },
  searchInput: {
    width: '100%',
    padding: '8px',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    fontSize: '13px',
  },
  countryList: {
    maxHeight: '240px',
    overflowY: 'auto',
  },
  countryOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 12px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '13px',
  },
  countryOptionSelected: {
    background: 'var(--bg-secondary)',
  },
  countryName: {
    flex: 1,
  },
  optionCode: {
    fontFamily: 'monospace',
    color: 'var(--text-muted)',
  },
  phoneInput: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: '0 6px 6px 0',
    fontSize: '14px',
    fontFamily: 'monospace',
  },
  phoneInputError: {
    borderColor: 'var(--danger)',
    background: 'var(--danger-light)',
  },
  error: {
    fontSize: '12px',
    color: 'var(--danger)',
    marginTop: '4px',
  },
  hint: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginTop: '4px',
  },
};

export default PhoneInput;