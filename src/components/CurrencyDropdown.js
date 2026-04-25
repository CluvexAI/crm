import React from 'react';
import { CURRENCIES } from '../services/currencyService';

const CurrencyDropdown = ({ value, onChange, error, label, required }) => {
  const handleChange = (e) => {
    const code = e.target.value;
    const currency = CURRENCIES.find(c => c.code === code);
    onChange(currency || { code: '', symbol: '', name: '' });
  };

  return (
    <div style={styles.container}>
      {label && (
        <label style={styles.label}>
          {label}
          {required && <span style={styles.required}> *</span>}
        </label>
      )}
      <select
        className="form-control"
        value={value?.code || ''}
        onChange={handleChange}
        style={error ? { ...styles.select, borderColor: 'var(--danger)', background: 'var(--danger-light)' } : styles.select}
      >
        <option value="">Select currency</option>
        {CURRENCIES.map(currency => (
          <option key={currency.code} value={currency.code}>
            {currency.flag} {currency.code} - {currency.name}
          </option>
        ))}
      </select>
      {error && <div style={styles.error}>{error}</div>}
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
  select: {
    padding: '10px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    fontSize: '14px',
    background: 'white',
    cursor: 'pointer',
  },
  error: {
    fontSize: '12px',
    color: 'var(--danger)',
    marginTop: '4px',
  },
};

export default CurrencyDropdown;
