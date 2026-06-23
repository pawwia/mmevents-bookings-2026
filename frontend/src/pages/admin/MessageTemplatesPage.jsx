import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack,
  Switch, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import { api, apiError } from '../../api/client';

/** CRM: edycja treści e-mail i SMS — z listą dostępnych zmiennych {{...}}. */
export default function MessageTemplatesPage() {
  const [tab, setTab] = useState('email');
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);

  const endpoint = tab === 'email' ? '/admin/email-templates' : '/admin/sms-templates';

  const load = useCallback(() => {
    api.get(endpoint).then(({ data }) => setTemplates(data));
  }, [endpoint]);
  useEffect(load, [load]);

  const save = async () => {
    setMessage(null);
    try {
      await api.put(`${endpoint}/${editing.id}`, editing);
      setEditing(null);
      setMessage({ severity: 'success', text: 'Szablon zapisany.' });
      load();
    } catch (e) {
      setMessage({ severity: 'error', text: apiError(e) });
    }
  };

  const variables = (template) => {
    try {
      return JSON.parse(template.variables || '[]');
    } catch {
      return [];
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Treści wiadomości
      </Typography>
      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
        <Tab label="E-mail (Brevo)" value="email" />
        <Tab label="SMS (SMSAPI)" value="sms" />
      </Tabs>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Szablon</TableCell>
              {tab === 'email' && <TableCell>Temat</TableCell>}
              <TableCell>Zmienne</TableCell>
              <TableCell>Aktywny</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id} hover>
                <TableCell>
                  <strong>{template.name}</strong>
                  <Typography variant="caption" display="block" color="text.secondary">
                    {template.code}
                  </Typography>
                </TableCell>
                {tab === 'email' && <TableCell>{template.subject}</TableCell>}
                <TableCell>
                  {variables(template).map((v) => (
                    <Chip key={v} size="small" label={`{{${v}}}`} sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={!!Number(template.is_active)}
                    onChange={async (e) => {
                      await api.put(`${endpoint}/${template.id}`, { is_active: e.target.checked ? 1 : 0 });
                      load();
                    }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setEditing(template)}>
                    Edytuj
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="md">
        <DialogTitle>{editing?.name}</DialogTitle>
        <DialogContent>
          {editing && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Box>
                {variables(editing).map((v) => (
                  <Chip
                    key={v}
                    size="small"
                    label={`{{${v}}}`}
                    onClick={() => setEditing((s) => ({ ...s, body: (s.body || '') + `{{${v}}}` }))}
                    sx={{ mr: 0.5, mb: 0.5, cursor: 'pointer' }}
                  />
                ))}
              </Box>
              {tab === 'email' && (
                <TextField
                  label="Temat"
                  fullWidth
                  value={editing.subject || ''}
                  onChange={(e) => setEditing((s) => ({ ...s, subject: e.target.value }))}
                />
              )}
              <TextField
                label={tab === 'email' ? 'Treść (HTML)' : 'Treść SMS (maks. 500 znaków)'}
                fullWidth
                multiline
                minRows={tab === 'email' ? 12 : 4}
                value={editing.body || ''}
                onChange={(e) => setEditing((s) => ({ ...s, body: e.target.value }))}
                inputProps={tab === 'sms' ? { maxLength: 500 } : undefined}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Anuluj</Button>
          <Button variant="contained" onClick={save}>
            Zapisz
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
