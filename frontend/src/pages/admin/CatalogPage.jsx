import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Card, CardContent, CardMedia, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, Stack, Switch, TextField, Typography, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import PlayCircleIcon from '@mui/icons-material/PlayCircleOutline';
import { api, apiError } from '../../api/client';
import ImageField from '../../components/admin/ImageField';
import BulkTemplateUpload from '../../components/admin/BulkTemplateUpload';
import { ImagePreviewDialog, YouTubeDialog } from '../../components/common/MediaDialogs';
import { PRESET_HASHTAGS } from '../../utils/format';

const IMAGE_KEY = {
  animations: 'thumbnail_url',
  backgrounds: 'image_url',
  'print-templates': 'image_url',
  'guestbook-designs': 'image_url',
};
const TYPES_WITH_TAGS = ['print-templates', 'guestbook-designs'];

/**
 * Wspólny CRUD katalogów personalizacji:
 *  - animacje: nazwa + miniatura + link YouTube
 *  - tła: nazwa + zdjęcie
 *  - szablony wydruków: nazwa + zdjęcie + hashtagi (np. #wesele #urodziny #firmowe #studniówka)
 */
export default function CatalogPage({ type, title }) {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const isPrintTemplate = type === 'print-templates';
  const stripLike = TYPES_WITH_TAGS.includes(type); // wydruki / wzory ksiąg — różne orientacje
  const toggleTagInText = (tag) =>
    setEditing((s) => {
      const tags = new Set((s.hashtagsText || '').split(/[\s,]+/).filter(Boolean));
      tags.has(tag) ? tags.delete(tag) : tags.add(tag);
      return { ...s, hashtagsText: [...tags].join(' ') };
    });

  const load = useCallback(() => {
    api.get(`/admin/catalog/${type}`).then(({ data }) => setItems(data));
  }, [type]);

  useEffect(load, [load]);

  const save = async () => {
    setError('');
    const payload = { ...editing };
    if (TYPES_WITH_TAGS.includes(type) && typeof payload.hashtagsText === 'string') {
      payload.hashtags = payload.hashtagsText.split(/[\s,]+/).filter(Boolean);
    }
    try {
      if (editing.id) await api.put(`/admin/catalog/${type}/${editing.id}`, payload);
      else await api.post(`/admin/catalog/${type}`, payload);
      setEditing(null);
      load();
    } catch (e) {
      setError(apiError(e));
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Usunąć tę pozycję?')) return;
    await api.delete(`/admin/catalog/${type}/${id}`);
    load();
  };

  const imageKey = IMAGE_KEY[type];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{title}</Typography>
        <Stack direction="row" spacing={1}>
          {isPrintTemplate && (
            <Button variant="outlined" startIcon={<LibraryAddIcon />} onClick={() => setBulkOpen(true)}>
              Dodawanie masowe
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setEditing({ is_active: 1, cut_strip: isPrintTemplate })}
          >
            Dodaj
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        {items.map((item) => (
          <Grid item xs={6} sm={4} md={3} key={item.id}>
            <Card sx={{ opacity: Number(item.is_active) ? 1 : 0.5 }}>
              <CardMedia
                component="img"
                height={stripLike ? 200 : 120}
                image={item[imageKey] || '/images/placeholder-background.png'}
                sx={{ bgcolor: '#EEE', objectFit: stripLike ? 'contain' : 'cover' }}
              />
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="subtitle2">{item.name}</Typography>
                {TYPES_WITH_TAGS.includes(type) && (
                  <Box sx={{ my: 0.5 }}>
                    {(item.hashtags || []).map((tag) => (
                      <Chip key={tag} size="small" label={`#${tag}`} sx={{ mr: 0.5, mb: 0.5 }} />
                    ))}
                  </Box>
                )}
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {type === 'animations' ? (
                    <Button
                      size="small"
                      startIcon={<PlayCircleIcon />}
                      onClick={() => setVideoPreview({ url: item.youtube_url, title: item.name })}
                    >
                      Podejrzyj
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      startIcon={<ZoomInIcon />}
                      onClick={() => setImagePreview({ src: item[imageKey], title: item.name })}
                    >
                      Podejrzyj
                    </Button>
                  )}
                  <Button size="small" onClick={() => setEditing({ ...item, hashtagsText: (item.hashtags || []).join(' ') })}>
                    Edytuj
                  </Button>
                  <Button size="small" color="error" onClick={() => remove(item.id)}>
                    Usuń
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {bulkOpen && (
        <BulkTemplateUpload type={type} onClose={() => setBulkOpen(false)} onUploaded={load} />
      )}

      <ImagePreviewDialog open={!!imagePreview} src={imagePreview?.src} title={imagePreview?.title} onClose={() => setImagePreview(null)} />
      <YouTubeDialog open={!!videoPreview} url={videoPreview?.url} title={videoPreview?.title} onClose={() => setVideoPreview(null)} />

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>{editing?.id ? 'Edytuj pozycję' : 'Nowa pozycja'}</DialogTitle>
        <DialogContent>
          {editing && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {error && <Typography color="error">{error}</Typography>}
              <TextField
                label="Nazwa"
                value={editing.name || ''}
                onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))}
                fullWidth
              />
              {isPrintTemplate && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={editing.cut_strip ?? true}
                      onChange={(e) => setEditing((s) => ({ ...s, cut_strip: e.target.checked }))}
                    />
                  }
                  label="Przekrój na pojedynczy pasek (paski fotobudkowe) — ustaw przed wgraniem pliku"
                />
              )}
              <ImageField
                label={type === 'animations' ? 'Miniatura (URL)' : 'Zdjęcie (URL)'}
                value={editing[imageKey]}
                onChange={(url) => setEditing((s) => ({ ...s, [imageKey]: url }))}
                uploadParams={isPrintTemplate ? { cut_strip: editing.cut_strip ?? true, to_webp: true } : undefined}
              />
              {type === 'animations' && (
                <TextField
                  label="Link YouTube"
                  value={editing.youtube_url || ''}
                  onChange={(e) => setEditing((s) => ({ ...s, youtube_url: e.target.value }))}
                  fullWidth
                />
              )}
              {TYPES_WITH_TAGS.includes(type) && (
                <Box>
                  <TextField
                    label="Hashtagi (oddzielone spacją, np. wesele urodziny rocznica)"
                    value={editing.hashtagsText || ''}
                    onChange={(e) => setEditing((s) => ({ ...s, hashtagsText: e.target.value }))}
                    fullWidth
                  />
                  <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', mt: 1 }}>
                    {PRESET_HASHTAGS.map((tag) => {
                      const active = (editing.hashtagsText || '').split(/[\s,]+/).includes(tag);
                      return (
                        <Chip
                          key={tag}
                          size="small"
                          label={`#${tag}`}
                          variant={active ? 'filled' : 'outlined'}
                          color={active ? 'primary' : 'default'}
                          onClick={() => toggleTagInText(tag)}
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      );
                    })}
                  </Stack>
                </Box>
              )}
              <TextField
                label="Kolejność"
                type="number"
                value={editing.sort_order ?? 0}
                onChange={(e) => setEditing((s) => ({ ...s, sort_order: Number(e.target.value) }))}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={!!Number(editing.is_active)}
                    onChange={(e) => setEditing((s) => ({ ...s, is_active: e.target.checked ? 1 : 0 }))}
                  />
                }
                label="Aktywna (widoczna dla klientów)"
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
