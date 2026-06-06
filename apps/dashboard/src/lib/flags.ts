const readBool = (value: string | undefined | null) => {
  if (!value) return false;
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
};

export const isFeatureEnabled = (key: string): boolean => {
  const envKey = `VITE_${key.toUpperCase()}`;
  const envValue = (import.meta as { env?: Record<string, string> }).env?.[envKey] as string | undefined;
  if (readBool(envValue)) return true;
  if (typeof window === 'undefined') return false;
  const local = window.localStorage.getItem(key);
  return readBool(local);
};

