import React, { useState, useEffect, useRef } from 'react';
import { DEFAULT_COUNTRY, getCountryByCode, searchCountries } from '../services/countryService';

const CountryDropdown = ({ value, onChange, error, label, required, onCountryChange }) => {
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (value?.countryCode) {
      const country = getCountryByCode(value.countryCode);
      if (country) {
        setSelectedCountry(country);
      }
    } else if (!selectedCountry) {
      setSelectedCountry(DEFAULT_COUNTRY);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCountries = searchCountries(searchQuery);

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setShowDropdown(false);
    setSearchQuery('');
    
    const countryData = {
      countryName: country.name,
      countryCode: country.code,
      dialCode: country.dialCode,
    };
    
    onChange(countryData);
    
    if (onCountryChange) {
      onCountryChange(country);
    }
  };

  return (
    <div style={styles.container}>
      {label && (
        <label style={styles.label}>
          {label}
          {required && <span style={styles.required}> *</span>}
        </label>
      )}
      
      <div style={styles.dropdownWrapper} ref={dropdownRef}>
        <button
          type="button"
          style={{
            ...styles.dropdownButton,
            ...(error ? styles.dropdownButtonError : {}),
          }}
          onClick={() => setShowDropdown(!showDropdown)}
        >
          <span style={styles.selectedValue}>
            {selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : 'Select country'}
          </span>
          <span style={styles.arrow}>{showDropdown ? '▲' : '▼'}</span>
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
                autoFocus
              />
            </div>
            <div style={styles.countryList}>
              {filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  style={{
                    ...styles.countryOption,
                    ...(selectedCountry?.code === country.code ? styles.countryOptionSelected : {}),
                  }}
                  onClick={() => handleCountrySelect(country)}
                >
                  <span style={styles.flag}>{country.flag}</span>
                  <span style={styles.countryName}>{country.name}</span>
                  <span style={styles.dialCode}>{country.dialCode}</span>
                </button>
              ))}
              {filteredCountries.length === 0 && (
                <div style={styles.noResults}>No countries found</div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {error && <div style={styles.error}>{error}</div>}
      
      {selectedCountry && (
        <div style={styles.hint}>
          Dial code: {selectedCountry.flag} {selectedCountry.dialCode}
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
  dropdownWrapper: {
    position: 'relative',
  },
  dropdownButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    background: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    minHeight: '42px',
  },
  dropdownButtonError: {
    borderColor: 'var(--danger)',
    background: 'var(--danger-light)',
  },
  selectedValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  arrow: {
    fontSize: '10px',
    color: 'var(--text-muted)',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    background: 'white',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 1000,
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
  flag: {
    fontSize: '18px',
  },
  countryName: {
    flex: 1,
  },
  dialCode: {
    fontFamily: 'monospace',
    color: 'var(--text-muted)',
    fontSize: '12px',
  },
  noResults: {
    padding: '16px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '13px',
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

export default CountryDropdown;
