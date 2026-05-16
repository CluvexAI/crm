import { BASE_CURRENCY, convertCurrency, formatCurrencyAmount } from './currencyService';

export const aggregateCustomerPayments = (sales) => {
  const customerMap = {};
  
  sales.forEach(sale => {
    const customerKey = sale.businessName || 'Unknown';
    
    if (!customerMap[customerKey]) {
      customerMap[customerKey] = {
        customerName: customerKey,
        contactName: sale.leadName || '',
        sales: [],
        totalSaleAmount: 0,
        totalPaid: 0,
        totalDue: 0,
        saleCount: 0,
        fullyPaidSales: 0,
        partiallyPaidSales: 0,
        unpaidSales: 0,
      };
    }
    
    const customer = customerMap[customerKey];
    const saleAmount = sale.baseAmount || sale.amount || 0;
    
    customer.sales.push(sale);
    customer.totalSaleAmount += saleAmount;
    customer.saleCount++;
    
    const paymentRatio = getPaymentRatio(sale);
    if (paymentRatio >= 1) {
      customer.totalPaid += saleAmount;
      customer.fullyPaidSales++;
    } else if (paymentRatio > 0) {
      const paidAmount = saleAmount * paymentRatio;
      customer.totalPaid += paidAmount;
      customer.totalDue += saleAmount - paidAmount;
      customer.partiallyPaidSales++;
    } else {
      customer.totalDue += saleAmount;
      customer.unpaidSales++;
    }
  });
  
  return Object.values(customerMap);
};

const getPaymentRatio = (sale) => {
  if (sale.paymentStatus === 'Full Payment') return 1;
  if (sale.paymentStatus === 'Installments') {
    const plan = sale.installmentPlan || [];
    if (plan.length > 0) {
      const paidCount = plan.filter(i => i.status === 'paid').length;
      return plan.length > 0 ? paidCount / plan.length : 0;
    }
    if (sale.installments > 0) {
      return (sale.paidInstallments || 0) / sale.installments;
    }
  }
  return 0;
};

export const getCustomerPaymentStatus = (customer) => {
  if (customer.totalDue === 0 && customer.totalSaleAmount > 0) {
    return 'PAID';
  }
  if (customer.totalDue === customer.totalSaleAmount) {
    return 'UNPAID';
  }
  return 'PARTIAL';
};

export const getPaymentStatusColor = (status) => {
  switch (status) {
    case 'PAID': return 'var(--success)';
    case 'PARTIAL': return 'var(--warning)';
    case 'UNPAID': return 'var(--danger)';
    default: return 'var(--text-muted)';
  }
};

export const getPaymentStatusBadge = (status) => {
  switch (status) {
    case 'PAID': return 'badge-success';
    case 'PARTIAL': return 'badge-warning';
    case 'UNPAID': return 'badge-danger';
    default: return 'badge-neutral';
  }
};

export const getOverallPaymentStats = (sales) => {
  const customers = aggregateCustomerPayments(sales);
  
  const totalSales = customers.reduce((sum, c) => sum + c.totalSaleAmount, 0);
  const totalPaid = customers.reduce((sum, c) => sum + c.totalPaid, 0);
  const totalDue = customers.reduce((sum, c) => sum + c.totalDue, 0);
  
  const paidCustomers = customers.filter(c => c.totalDue === 0).length;
  const partialCustomers = customers.filter(c => c.totalDue > 0 && c.totalDue < c.totalSaleAmount).length;
  const unpaidCustomers = customers.filter(c => c.totalDue === c.totalSaleAmount && c.totalSaleAmount > 0).length;
  
  return {
    totalSales,
    totalPaid,
    totalDue,
    customerCount: customers.length,
    paidCustomers,
    partialCustomers,
    unpaidCustomers,
  };
};

export const formatCustomerAmount = (amount) => {
  return formatCurrencyAmount(amount, BASE_CURRENCY);
};

export const formatDueIndicator = (customer) => {
  if (customer.totalDue === 0) return '🟢 Fully Paid';
  if (customer.totalDue === customer.totalSaleAmount) return '🔴 Full Due';
  return '🟡 Partial Payment';
};

export const calculateAgingBuckets = (sales, paymentTermDays = 30) => {
  const today = new Date();
  const buckets = {
    current: { label: 'Current (0-30 days)', amount: 0, sales: [], color: 'var(--success)' },
    aging30: { label: '31-60 days overdue', amount: 0, sales: [], color: 'var(--warning)' },
    aging60: { label: '61-90 days overdue', amount: 0, sales: [], color: 'var(--orange)' },
    aging90plus: { label: '90+ days overdue', amount: 0, sales: [], color: 'var(--danger)' },
  };

  sales.forEach(sale => {
    const saleAmount = sale.baseAmount || sale.amount || 0;
    const saleDue = getDueAmount(sale);
    if (saleDue <= 0) return;

    const saleDate = new Date(sale.createdAt || sale.createdAt);
    const dueDate = new Date(saleDate);
    dueDate.setDate(dueDate.getDate() + paymentTermDays);

    const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

    let bucket;
    if (daysOverdue <= 0) {
      bucket = buckets.current;
    } else if (daysOverdue <= 30) {
      bucket = buckets.aging30;
    } else if (daysOverdue <= 60) {
      bucket = buckets.aging60;
    } else {
      bucket = buckets.aging90plus;
    }

    bucket.amount += saleDue;
    bucket.sales.push({
      ...sale,
      daysOverdue: Math.max(0, daysOverdue),
      dueDate: dueDate.toISOString().split('T')[0],
    });
  });

  return buckets;
};

const getDueAmount = (sale) => {
  const saleAmount = sale.baseAmount || sale.amount || 0;
  const paymentRatio = getPaymentRatio(sale);
  if (paymentRatio >= 1) return 0;
  if (paymentRatio > 0) {
    return saleAmount * (1 - paymentRatio);
  }
  return saleAmount;
};

export const getAgingSummary = (sales) => {
  const buckets = calculateAgingBuckets(sales);
  return {
    current: { amount: buckets.current.amount, count: buckets.current.sales.length },
    aging30: { amount: buckets.aging30.amount, count: buckets.aging30.sales.length },
    aging60: { amount: buckets.aging60.amount, count: buckets.aging60.sales.length },
    aging90plus: { amount: buckets.aging90plus.amount, count: buckets.aging90plus.sales.length },
    totalOverdue: buckets.aging30.amount + buckets.aging60.amount + buckets.aging90plus.amount,
  };
};
