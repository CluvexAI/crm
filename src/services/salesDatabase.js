const STORAGE_KEY = 'zsm_crm_sales';

const getStorage = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch (e) {
    console.error('[SalesDB] Error reading:', e);
    return null;
  }
};

const setStorage = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('[SalesDB] Error writing:', e);
    return false;
  }
};

export const initializeSalesDatabase = (defaultSales) => {
  const stored = getStorage();
  if (stored) {
    console.log('[SalesDB] Loaded', stored.length, 'sales from storage');
    // Data Integrity Check: Patch missing timestamps/version
    let needsPatch = false;
    const patched = stored.map(s => {
      let changed = false;
      const newS = { ...s };
      if (!newS.createdAt) { newS.createdAt = new Date().toISOString(); changed = true; }
      if (!newS.updatedAt) { newS.updatedAt = newS.createdAt; changed = true; }
      if (!newS.version) { newS.version = 1; changed = true; }
      if (changed) needsPatch = true;
      return newS;
    });
    if (needsPatch) {
      setStorage(patched);
      return patched;
    }
    return stored;
  }
  console.log('[SalesDB] Initializing with default sales');
  setStorage(defaultSales);
  return defaultSales;
};

export const getAllSales = () => getStorage() || [];

export const getSaleById = (id) => {
  const sales = getStorage();
  return sales?.find(s => s.id === id) || null;
};

export const createSaleRecord = (saleData) => {
  const sales = getStorage() || [];
  const newSale = {
    ...saleData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1
  };
  sales.push(newSale);
  setStorage(sales);
  console.log('[SalesDB] Created sale:', newSale.id);
  return newSale;
};

export const updateSaleRecord = (id, saleData) => {
  const sales = getStorage() || [];
  const index = sales.findIndex(s => s.id === id);
  
  if (index === -1) {
    console.warn('[SalesDB] Sale not found, creating dynamic fallback record for:', id);
    const newSale = {
      id,
      ...saleData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
    sales.push(newSale);
    setStorage(sales);
    return newSale;
  }
  
  const currentSale = sales[index];
  
  // Optimistic Locking Check
  if (saleData.version !== undefined && saleData.version !== currentSale.version) {
    throw new Error('CONFLICT: This record was updated by someone else. Please refresh and try again.');
  }

  const updatedSale = {
    ...currentSale,
    ...saleData,
    updatedAt: new Date().toISOString(),
    version: (currentSale.version || 1) + 1
  };
  
  sales[index] = updatedSale;
  setStorage(sales);
  console.log('[SalesDB] Updated sale:', id, 'version:', updatedSale.version);
  
  return updatedSale;
};

export const deleteSaleRecord = (id) => {
  const sales = getStorage() || [];
  const filtered = sales.filter(s => String(s.id) !== String(id));
  setStorage(filtered);
  console.log('[SalesDB] Deleted sale:', id);
  return true;
};
