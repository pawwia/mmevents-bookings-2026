export const formatPrice = (value) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(Number(value || 0));

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const formatDateTime = (value) =>
  value ? new Date(value.replace(' ', 'T')).toLocaleString('pl-PL') : '—';

export const formatTime = (value) => (value ? String(value).slice(0, 5) : '—');

export const EVENT_TYPES = [
  { value: 'wesele', label: 'Wesele', standard: true },
  { value: 'urodziny', label: 'Urodziny', standard: true },
  { value: 'impreza firmowa', label: 'Impreza firmowa', standard: false },
  { value: 'studniówka', label: 'Studniówka', standard: false },
  { value: 'impreza plenerowa', label: 'Impreza plenerowa', standard: false },
  { value: 'bal', label: 'Bal', standard: false },
  { value: 'impreza masowa', label: 'Impreza masowa', standard: false },
  { value: 'inna', label: 'Inna', standard: false },
];

// Predefiniowane hashtagi szablonów wydruków / wzorów ksiąg — do szybkiego klikania w CRM.
export const PRESET_HASHTAGS = [
  'wesele', 'urodziny', 'rocznica', 'studniówka', 'firmowe', 'bal',
  'chrzciny', 'komunia', 'sylwester', 'walentynki', 'panieński', 'kawalerski',
];

export const STATUS_COLORS = {
  new: 'warning',
  awaiting_contract: 'info',
  awaiting_deposit: 'secondary',
  confirmed: 'success',
  last_call: 'warning',
  ready: 'primary',
  completed: 'default',
  cancelled: 'error',
};
