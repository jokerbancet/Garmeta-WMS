// src/context/SettingsContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchSettings, AppSettings } from '@/services/settingsService';

interface SettingsContextType {
  settings: AppSettings;
  updateLocalSettings: (newSettings: AppSettings) => void;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>({
    id: '',
    brand_name: 'StitchFlow',
    brand_logo_icon: 'Box'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings()
      .then(data => {
        if (data) setSettings(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const updateLocalSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateLocalSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
