import { create } from 'zustand';
import { api } from '../api/client';

/**
 * Publiczne ustawienia (kolory, logo, nazwa firmy) — pobierane raz przy starcie.
 * Dzięki temu rebranding (kolory/logo zmienione w CRM) działa bez zmian w kodzie.
 */
export const useSettingsStore = create((set) => ({
  settings: {},
  loaded: false,
  load: async () => {
    try {
      const { data } = await api.get('/settings/public');
      set({ settings: data, loaded: true });
    } catch {
      set({ loaded: true }); // brak ustawień nie blokuje aplikacji — motyw domyślny
    }
  },
}));
