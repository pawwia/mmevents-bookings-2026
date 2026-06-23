import { create } from 'zustand';

const initialState = {
  step: 0,
  // krok 1 — termin
  eventDate: null,
  availability: null,
  // krok 2 — pakiet
  packageId: null,
  pkg: null,
  // krok 3 — godzina startu (dowolna)
  startTime: '18:00',
  feasibility: null,
  // krok 4 — lokalizacja (Google Places)
  venue: null, // { name, address, place_id, lat, lng, distance_km, duration_min }
  // krok 5 — dane klienta
  client: null, // { type, first_name, ..., nip, company_name, ... }
  // krok 6 — księga gości
  guestbook: 'none',
  // krok 7 — podsumowanie
  discountCode: '',
  quote: null,
  clientNotes: '',
  // krok 8 — wynik
  result: null,
};

export const useBookingWizard = create((set) => ({
  ...initialState,
  set: (values) => set(values),
  next: () => set((s) => ({ step: Math.min(s.step + 1, 7) })),
  back: () => set((s) => ({ step: Math.max(s.step - 1, 0) })),
  reset: () => set(initialState),
}));
