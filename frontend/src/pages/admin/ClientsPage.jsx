import { useEffect, useState } from 'react';
import {
  Box, Chip, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { api } from '../../api/client';
import { formatDate } from '../../utils/format';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/admin/clients', { params: { q: query || undefined } }).then(({ data }) => setClients(data));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Klienci
      </Typography>
      <TextField
        size="small"
        label="Szukaj klienta"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ mb: 2, minWidth: 320 }}
      />
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Klient</TableCell>
              <TableCell>Kontakt</TableCell>
              <TableCell>Typ</TableCell>
              <TableCell>Miasto</TableCell>
              <TableCell>Rezerwacje</TableCell>
              <TableCell>Od</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id} hover>
                <TableCell>
                  <strong>
                    {client.first_name} {client.last_name}
                  </strong>
                  {client.company_name && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      {client.company_name}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {client.email}
                  <Typography variant="caption" display="block" color="text.secondary">
                    {client.phone}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={client.type === 'company' ? 'firma' : 'prywatny'} />
                </TableCell>
                <TableCell>{client.city || '—'}</TableCell>
                <TableCell>{client.bookings_count}</TableCell>
                <TableCell>{formatDate(client.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
