import { useEffect, useState } from 'react';
import {
  Box, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { api } from '../../api/client';
import { formatDateTime } from '../../utils/format';

/** Audyt zmian ustawień: kto zmienił, kiedy, stara i nowa wartość. */
export default function AuditPage() {
  const [entries, setEntries] = useState([]);
  const [keyFilter, setKeyFilter] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/admin/settings/audit', { params: { key: keyFilter || undefined } }).then(({ data }) => setEntries(data));
    }, 250);
    return () => clearTimeout(t);
  }, [keyFilter]);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Audyt zmian ustawień
      </Typography>
      <TextField
        size="small"
        label="Filtruj po kluczu (np. finance.km_rate)"
        value={keyFilter}
        onChange={(e) => setKeyFilter(e.target.value)}
        sx={{ mb: 2, minWidth: 320 }}
      />
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kiedy</TableCell>
              <TableCell>Kto</TableCell>
              <TableCell>Ustawienie</TableCell>
              <TableCell>Stara wartość</TableCell>
              <TableCell>Nowa wartość</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id} hover>
                <TableCell>{formatDateTime(entry.created_at)}</TableCell>
                <TableCell>{entry.first_name ? `${entry.first_name} ${entry.last_name}` : 'system'}</TableCell>
                <TableCell>
                  <code>{entry.setting_key}</code>
                </TableCell>
                <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {entry.old_value ?? '—'}
                </TableCell>
                <TableCell sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {entry.new_value ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
