import { useRef, useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { api, apiError } from '../../api/client';

/**
 * Pole obrazu: URL lub upload pliku (POST /admin/upload).
 * `uploadParams` — dodatkowe pola multipart (np. { cut_strip: 1, to_webp: 1 } dla szablonów wydruków).
 */
export default function ImageField({ label, value, onChange, uploadParams }) {
  const fileRef = useRef(null);
  const [error, setError] = useState('');

  const upload = async (file) => {
    setError('');
    const form = new FormData();
    form.append('file', file);
    Object.entries(uploadParams || {}).forEach(([k, v]) => form.append(k, v ? '1' : '0'));
    try {
      const { data } = await api.post('/admin/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      onChange(`${base}${data.url}`);
    } catch (e) {
      setError(apiError(e));
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField label={label} size="small" fullWidth value={value || ''} onChange={(e) => onChange(e.target.value)} />
        <Button variant="outlined" size="small" onClick={() => fileRef.current?.click()}>
          Wgraj
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </Stack>
      {value && <Box component="img" src={value} alt="" sx={{ mt: 1, height: 60, borderRadius: 1, bgcolor: '#EEE' }} />}
      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
    </Box>
  );
}
