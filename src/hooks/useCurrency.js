import { useApp } from '../contexts/AppContext';

export function useCurrency() {
  const { currency, exchangeRate } = useApp();

  const format = (usdAmount) => {
    if (currency === 'USD') {
      return `$${Number(usdAmount || 0).toFixed(2)}`;
    }
    return `L$${(Number(usdAmount || 0) * exchangeRate).toFixed(0)}`;
  };

  const formatBoth = (usdAmount) => ({
    primary: format(usdAmount),
    usd: `$${Number(usdAmount || 0).toFixed(2)}`,
    lrd: `L$${(Number(usdAmount || 0) * exchangeRate).toFixed(0)}`,
  });

  const toUSD = (amount) => currency === 'USD' ? amount : amount / exchangeRate;
  const toLRD = (usdAmount) => usdAmount * exchangeRate;

  return { currency, exchangeRate, format, formatBoth, toUSD, toLRD };
}
