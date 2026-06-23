import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControlLabel, IconButton, LinearProgress, Stack, Switch, TextField, Typography,
} from '@mui/material';
import AddPhotoIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { api, apiError } from '../../api/client';
import { PRESET_HASHTAGS } from '../../utils/format';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
let nextId = 1;

/**
 * Podgląd pojedynczego paska (cięcie w przeglądarce, tylko do podglądu — serwer i tak tnie ponownie).
 * Wzdłuż dłuższej krawędzi: obraz pionowy → lewa połowa, poziomy → górna połowa.
 */
const cropToStrip = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const cw = w >= h ? w : Math.max(1, Math.floor(w / 2));
      const ch = w >= h ? Math.max(1, Math.floor(h / 2)) : h;
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      canvas.getContext('2d').drawImage(img, 0, 0, cw, ch, 0, 0, cw, ch);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), 'image/webp', 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });

/**
 * Masowe dodawanie szablonów wydruków.
 *  - wgraj wiele plików naraz; każdy pokazuje się jako miniatura z polem hashtagów,
 *  - predefiniowane hashtagi (wesele, urodziny…) klikasz, by dodać je do danego szablonu,
 *  - wspólny przełącznik „przekrój na pasek" + konwersja do WebP (jak przy pojedynczym dodawaniu),
 *  - wszystko żyje we frontendzie do kliknięcia „Wgraj na serwer" — wcześniej nic nie jest zapisywane.
 */
export default function BulkTemplateUpload({ type = 'print-templates', title = 'Masowe dodawanie', allowStrip = true, onClose, onUploaded }) {
  const fileRef = useRef(null);
  const [items, setItems] = useState([]); // { id, file, previewUrl, name, hashtags: [] }
  const [cutStrip, setCutStrip] = useState(allowStrip);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');

  // Zwolnij obiektowe URL-e podglądów dopiero przy odmontowaniu (ref, by nie czyścić w trakcie edycji).
  const itemsRef = useRef([]);
  itemsRef.current = items;
  useEffect(
    () => () =>
      itemsRef.current.forEach((it) => {
        URL.revokeObjectURL(it.previewUrl);
        if (it.stripUrl) URL.revokeObjectURL(it.stripUrl);
      }),
    []
  );

  const addFiles = (fileList) => {
    [...fileList].forEach((file) => {
      const id = nextId++;
      setItems((prev) => [
        ...prev,
        { id, file, previewUrl: URL.createObjectURL(file), stripUrl: null, name: file.name.replace(/\.[^.]+$/, ''), hashtags: [] },
      ]);
      // Podgląd przyciętego paska tylko tam, gdzie cięcie ma sens (szablony wydruków).
      if (allowStrip) {
        cropToStrip(file).then((stripUrl) => {
          if (stripUrl) setItems((prev) => prev.map((it) => (it.id === id ? { ...it, stripUrl } : it)));
        });
      }
    });
  };

  const update = (id, patch) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id) =>
    setItems((prev) =>
      prev.filter((it) => {
        if (it.id !== id) return true;
        URL.revokeObjectURL(it.previewUrl);
        if (it.stripUrl) URL.revokeObjectURL(it.stripUrl);
        return false;
      })
    );

  const toggleTag = (id, tag) =>
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, hashtags: it.hashtags.includes(tag) ? it.hashtags.filter((t) => t !== tag) : [...it.hashtags, tag] }
          : it
      )
    );

  const addCustomTag = (id, raw) => {
    const tag = raw.trim().replace(/^#/, '').toLowerCase();
    if (!tag) return;
    setItems((prev) =>
      prev.map((it) => (it.id === id && !it.hashtags.includes(tag) ? { ...it, hashtags: [...it.hashtags, tag] } : it))
    );
  };

  const uploadAll = async () => {
    setError('');
    setBusy(true);
    setProgress({ done: 0, total: items.length });
    try {
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i];
        const form = new FormData();
        form.append('file', it.file);
        form.append('cut_strip', allowStrip && cutStrip ? '1' : '0');
        form.append('to_webp', '1');
        const { data } = await api.post('/admin/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        await api.post(`/admin/catalog/${type}`, {
          name: it.name || 'Pozycja',
          image_url: `${API_BASE}${data.url}`,
          hashtags: it.hashtags,
          is_active: 1,
        });
        setProgress({ done: i + 1, total: items.length });
      }
      onUploaded?.();
      onClose?.();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<AddPhotoIcon />} onClick={() => fileRef.current?.click()} disabled={busy}>
            Wybierz pliki
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          {allowStrip && (
            <FormControlLabel
              control={<Switch checked={cutStrip} onChange={(e) => setCutStrip(e.target.checked)} disabled={busy} />}
              label="Przekrój na pojedynczy pasek (paski fotobudkowe)"
            />
          )}
          <Typography variant="caption" color="text.secondary">
            Pliki konwertowane do WebP. Nic nie trafia na serwer, dopóki nie klikniesz „Wgraj na serwer".
          </Typography>
        </Stack>

        {items.length === 0 && (
          <Alert severity="info">Wybierz pliki — pojawią się tutaj jeden pod drugim do uzupełnienia hashtagami.</Alert>
        )}

        <Stack spacing={2}>
          {items.map((it) => (
            <Box key={it.id}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Box
                  component="img"
                  src={allowStrip && cutStrip && it.stripUrl ? it.stripUrl : it.previewUrl}
                  alt={it.name}
                  sx={{ width: 120, height: 160, objectFit: 'contain', borderRadius: 1, bgcolor: '#EEE', flexShrink: 0 }}
                />
                <Box sx={{ flexGrow: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      label="Nazwa"
                      size="small"
                      fullWidth
                      value={it.name}
                      onChange={(e) => update(it.id, { name: e.target.value })}
                      disabled={busy}
                    />
                    <IconButton color="error" onClick={() => remove(it.id)} disabled={busy}>
                      <DeleteIcon />
                    </IconButton>
                  </Stack>

                  <Box sx={{ mt: 1, mb: 0.5, minHeight: 24 }}>
                    {it.hashtags.map((tag) => (
                      <Chip
                        key={tag}
                        size="small"
                        label={`#${tag}`}
                        onDelete={busy ? undefined : () => toggleTag(it.id, tag)}
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                    {it.hashtags.length === 0 && (
                      <Typography variant="caption" color="text.secondary">
                        Kliknij hashtagi poniżej lub wpisz własny i naciśnij Enter.
                      </Typography>
                    )}
                  </Box>

                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', mb: 1 }}>
                    {PRESET_HASHTAGS.map((tag) => (
                      <Chip
                        key={tag}
                        size="small"
                        variant={it.hashtags.includes(tag) ? 'filled' : 'outlined'}
                        color={it.hashtags.includes(tag) ? 'primary' : 'default'}
                        label={`#${tag}`}
                        onClick={busy ? undefined : () => toggleTag(it.id, tag)}
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  </Stack>

                  <TextField
                    label="Dodaj własny hashtag (Enter)"
                    size="small"
                    disabled={busy}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomTag(it.id, e.target.value);
                        e.target.value = '';
                      }
                    }}
                  />
                </Box>
              </Stack>
              <Divider sx={{ mt: 2 }} />
            </Box>
          ))}
        </Stack>

        {busy && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption">
              Wgrywanie: {progress.done} / {progress.total}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={progress.total ? (progress.done / progress.total) * 100 : 0}
            />
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Anuluj
        </Button>
        <Button variant="contained" onClick={uploadAll} disabled={busy || items.length === 0}>
          Wgraj na serwer ({items.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
}
