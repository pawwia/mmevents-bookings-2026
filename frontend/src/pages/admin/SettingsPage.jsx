import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Grid, Paper, Stack, Switch, Tab, Tabs, TextField, Typography,
  FormControlLabel, InputAdornment, IconButton,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloudDownloadIcon from '@mui/icons-material/CloudDownloadOutlined';
import { api, apiError } from '../../api/client';
import ImageField from '../../components/admin/ImageField';

// Ukryte w CRM: lokalny szablon HTML (zastąpiony Apps Script) i wewnętrzne pola OAuth Drive
const HIDDEN_SETTING_KEYS = ['contract.template_html'];

const GROUPS = [
  { key: 'company', label: 'Dane firmy' },
  { key: 'finance', label: 'Finanse' },
  { key: 'booking', label: 'Rezerwacje' },
  { key: 'appearance', label: 'Wygląd' },
  { key: 'maps', label: 'Google Maps' },
  { key: 'calendar', label: 'Google Calendar' },
  { key: 'drive', label: 'Google Drive' },
  { key: 'brevo', label: 'Brevo (e-mail)' },
  { key: 'smsapi', label: 'SMSAPI' },
  { key: 'paynow', label: 'PayNow' },
  { key: 'signing', label: 'Podpis umów' },
  { key: 'security', label: 'Bezpieczeństwo' },
  { key: 'analytics', label: 'Analityka / Piksele' },
  { key: 'app', label: 'Aplikacja' },
];

function SettingField({ setting, value, onChange }) {
  if (setting.type === 'bool') {
    return (
      <FormControlLabel
        control={<Switch checked={value === '1' || value === 'true'} onChange={(e) => onChange(e.target.checked ? '1' : '0')} />}
        label={setting.label}
      />
    );
  }
  if (setting.key.endsWith('logo_url') || setting.key.endsWith('favicon_url') || setting.key.endsWith('_image')) {
    return <ImageField label={setting.label} value={value} onChange={onChange} />;
  }
  const isColor = setting.key.includes('color');
  // JSON konta serwisowego / długie sekrety wielolinijkowe — pole textarea (paste bez gubienia treści)
  const isJson = setting.key.endsWith('_json');
  const multiline = setting.type === 'text' || isJson;
  return (
    <TextField
      label={setting.label}
      fullWidth
      size="small"
      multiline={multiline}
      minRows={isJson ? 6 : setting.type === 'text' ? 3 : undefined}
      type={isColor ? 'color' : 'text'}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        isJson
          ? 'Wklej całą zawartość pliku JSON konta serwisowego'
          : setting.type === 'secret' && setting.is_set
            ? '•••••• ustawione — wpisz nową wartość, aby zmienić'
            : undefined
      }
      helperText={
        setting.type === 'secret' && setting.is_set
          ? (isJson
              ? 'JSON jest zapisany. Pole jest puste — wklej cały plik JSON, aby go nadpisać. Puste = bez zmian.'
              : 'Wartość ustawiona (pole puste). Wpisz nową, aby nadpisać. Puste = bez zmian.')
          : undefined
      }
      InputProps={
        setting.type === 'secret'
          ? {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton edge="end" tabIndex={-1} size="small" disabled>
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }
          : undefined
      }
    />
  );
}

/**
 * CRM → Ustawienia systemu: 12 sekcji, wszystko w bazie, każdy zapis audytowany.
 * 95% konfiguracji biznesowej bez udziału programisty.
 */
export default function SettingsPage() {
  const [groups, setGroups] = useState({});
  const [tab, setTab] = useState('company');
  const [values, setValues] = useState({});
  const [message, setMessage] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);

  const downloadBackup = async () => {
    setBackupBusy(true);
    setMessage(null);
    try {
      const res = await api.get('/admin/backup', { responseType: 'blob' });
      const cd = res.headers['content-disposition'] || '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const name = match ? match[1] : 'mmevents-backup.sql';
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ severity: 'success', text: 'Kopia zapasowa pobrana.' });
    } catch (e) {
      setMessage({ severity: 'error', text: apiError(e) });
    } finally {
      setBackupBusy(false);
    }
  };

  const load = useCallback(() => {
    api.get('/admin/settings').then(({ data }) => {
      setGroups(data);
      const flat = {};
      Object.values(data)
        .flat()
        .forEach((s) => {
          // Sekrety ładujemy jako puste — użytkownik wpisuje nową wartość do czystego pola
          // (uniknięcie doklejania do maski ••••, którą backend pomija jako „bez zmian").
          flat[s.key] = s.type === 'secret' ? '' : s.value ?? '';
        });
      setValues(flat);
    });
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    setMessage(null);
    const groupSettings = groups[tab] || [];
    const payload = {};
    groupSettings.forEach((s) => {
      payload[s.key] = values[s.key] ?? '';
    });
    try {
      await api.put('/admin/settings', { values: payload });
      setMessage({ severity: 'success', text: 'Ustawienia zapisane (zmiany trafiły do audytu).' });
      load();
    } catch (e) {
      setMessage({ severity: 'error', text: apiError(e) });
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Ustawienia systemu</Typography>
        <Button variant="outlined" startIcon={<CloudDownloadIcon />} onClick={downloadBackup} disabled={backupBusy}>
          {backupBusy ? 'Przygotowuję…' : 'Pobierz kopię zapasową'}
        </Button>
      </Stack>
      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <Paper sx={{ display: 'flex', minHeight: 460 }}>
        <Tabs
          orientation="vertical"
          value={tab}
          onChange={(_, value) => setTab(value)}
          sx={{ borderRight: '1px solid', borderColor: 'divider', minWidth: 200 }}
        >
          {GROUPS.filter((g) => groups[g.key]).map((g) => (
            <Tab key={g.key} value={g.key} label={g.label} sx={{ alignItems: 'flex-start' }} />
          ))}
        </Tabs>
        <Box sx={{ p: 3, flexGrow: 1 }}>
          {tab === 'signing' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Umowy generowane są z szablonu Google Docs przez Apps Script (adres web-app + hasło poniżej).
              Konfiguracja: instrukcja „Umowy z szablonu Google Docs".
            </Alert>
          )}
          <Grid container spacing={2}>
            {(groups[tab] || [])
              .filter((s) => !HIDDEN_SETTING_KEYS.includes(s.key) && !s.key.startsWith('drive.oauth_'))
              .map((setting) => (
              <Grid item xs={12} md={setting.type === 'text' ? 12 : 6} key={setting.key}>
                <SettingField
                  setting={setting}
                  value={values[setting.key]}
                  onChange={(value) => setValues((s) => ({ ...s, [setting.key]: value }))}
                />
              </Grid>
            ))}
          </Grid>
          {tab === 'paynow' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              PayNow jest przygotowany technicznie i domyślnie <strong>wyłączony</strong> — klienci widzą wyłącznie
              przelew tradycyjny, dopóki nie włączysz płatności online powyżej.
            </Alert>
          )}
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
            <Button variant="contained" onClick={save}>
              Zapisz sekcję
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
