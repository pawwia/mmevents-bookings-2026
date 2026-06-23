import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, CardMedia, Chip, Dialog,
  DialogActions, DialogContent, DialogTitle, Grid, IconButton, Stack, TextField, Typography,
} from '@mui/material';
import PlayCircleIcon from '@mui/icons-material/PlayCircleOutline';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import GridViewIcon from '@mui/icons-material/GridViewOutlined';
import { api, apiError } from '../../api/client';
import { ImagePreviewDialog, YouTubeDialog } from '../common/MediaDialogs';

function SelectableCard({ selected, onClick, image, title, footer, disabled }) {
  return (
    <Card
      variant="outlined"
      sx={{ borderColor: selected ? 'primary.main' : 'divider', borderWidth: selected ? 2 : 1, height: '100%' }}
    >
      <CardActionArea onClick={onClick} disabled={disabled} sx={{ height: '100%' }}>
        {image && <CardMedia component="img" height="110" image={image} alt={title} sx={{ objectFit: 'cover', bgcolor: '#EEE' }} />}
        <CardContent sx={{ py: 1.5 }}>
          <Typography variant="subtitle2">{title}</Typography>
          {footer}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

/**
 * Personalizacja po rezerwacji:
 *  - animacja: „Wyświetl animację" odtwarza film z YouTube w popupie (bez wychodzenia ze strony),
 *  - tło: wybór po miniaturze,
 *  - szablon wydruku: wybór w przewijanym popupie (katalog ~100 szablonów) z filtrowaniem
 *    po hashtagach i przyciskiem chwilowego powiększenia,
 *  - dowolny tekst na wydruku.
 */
export default function PersonalizationEditor({ bookingId, initial, editable, guestbook = 'none', onSaved }) {
  const [animations, setAnimations] = useState([]);
  const [backgrounds, setBackgrounds] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [hashtags, setHashtags] = useState([]);
  const [activeTag, setActiveTag] = useState(null);
  const [activeDesignTag, setActiveDesignTag] = useState(null);

  const [videoPreview, setVideoPreview] = useState(null); // { url, title }
  const [imagePreview, setImagePreview] = useState(null); // { src, title }
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [designPickerOpen, setDesignPickerOpen] = useState(false);

  const [selection, setSelection] = useState({
    animation_id: initial?.animation_id ?? null,
    background_id: initial?.background_id ?? null,
    print_template_id: initial?.print_template_id ?? null,
    print_text: initial?.print_text ?? '',
    guestbook_design_id: initial?.guestbook_design_id ?? null,
    guestbook_names: initial?.guestbook_names ?? '',
    guestbook_date: initial?.guestbook_date ?? '',
  });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/catalog/animations'),
      api.get('/catalog/backgrounds'),
      api.get('/catalog/print-templates'),
      api.get('/catalog/guestbook-designs'),
      api.get('/catalog/hashtags'),
    ]).then(([a, b, t, d, h]) => {
      setAnimations(a.data);
      setBackgrounds(b.data);
      setTemplates(t.data);
      setDesigns(d.data);
      setHashtags(h.data);
    });
  }, []);

  const visibleTemplates = useMemo(
    () => (activeTag ? templates.filter((t) => t.hashtags.includes(activeTag)) : templates),
    [templates, activeTag]
  );
  const visibleDesigns = useMemo(
    () => (activeDesignTag ? designs.filter((d) => d.hashtags.includes(activeDesignTag)) : designs),
    [designs, activeDesignTag]
  );
  const selectedTemplate = templates.find((t) => t.id === selection.print_template_id) || null;
  const selectedDesign = designs.find((d) => d.id === selection.guestbook_design_id) || null;

  const save = async () => {
    setMessage(null);
    try {
      await api.put(`/bookings/${bookingId}/personalization`, selection);
      setMessage({ severity: 'success', text: 'Personalizacja zapisana! 🎀' });
      onSaved?.(selection);
    } catch (e) {
      setMessage({ severity: 'error', text: apiError(e) });
    }
  };

  const pick = (key, id) => editable && setSelection((s) => ({ ...s, [key]: s[key] === id ? null : id }));

  return (
    <Box>
      {!editable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Personalizacja jest zablokowana — zmiany były możliwe do kilku dni przed imprezą. W pilnych sprawach
          skontaktuj się z nami telefonicznie.
        </Alert>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1 }}>
        🎬 Animacja
      </Typography>
      <Grid container spacing={1.5} sx={{ my: 0.5 }}>
        {animations.map((animation) => (
          <Grid item xs={6} sm={4} md={3} key={animation.id}>
            <SelectableCard
              selected={selection.animation_id === animation.id}
              onClick={() => pick('animation_id', animation.id)}
              disabled={!editable}
              image={animation.thumbnail_url}
              title={animation.name}
              footer={
                <Button
                  size="small"
                  startIcon={<PlayCircleIcon />}
                  sx={{ mt: 0.5, p: 0 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setVideoPreview({ url: animation.youtube_url, title: animation.name });
                  }}
                >
                  Wyświetl animację
                </Button>
              }
            />
          </Grid>
        ))}
      </Grid>

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2 }}>
        🖼️ Tło
      </Typography>
      <Grid container spacing={1.5} sx={{ my: 0.5 }}>
        {backgrounds.map((background) => (
          <Grid item xs={6} sm={4} md={3} key={background.id}>
            <SelectableCard
              selected={selection.background_id === background.id}
              onClick={() => pick('background_id', background.id)}
              disabled={!editable}
              image={background.image_url}
              title={background.name}
            />
          </Grid>
        ))}
      </Grid>

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2 }}>
        🖨️ Szablon wydruku
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ my: 1 }}>
        {selectedTemplate ? (
          <Card variant="outlined" sx={{ display: 'flex', alignItems: 'center', pr: 1, borderColor: 'primary.main', borderWidth: 2 }}>
            <CardMedia
              component="img"
              image={selectedTemplate.image_url}
              alt={selectedTemplate.name}
              sx={{ width: 72, height: 96, objectFit: 'contain', bgcolor: '#EEE' }}
            />
            <Box sx={{ px: 1.5 }}>
              <Typography variant="subtitle2">{selectedTemplate.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedTemplate.hashtags.map((t) => `#${t}`).join(' ')}
              </Typography>
            </Box>
            <IconButton onClick={() => setImagePreview({ src: selectedTemplate.image_url, title: selectedTemplate.name })}>
              <ZoomInIcon />
            </IconButton>
          </Card>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Nie wybrano jeszcze szablonu.
          </Typography>
        )}
        {editable && (
          <Button variant="outlined" startIcon={<GridViewIcon />} onClick={() => setTemplatePickerOpen(true)}>
            {selectedTemplate ? 'Zmień szablon' : 'Wybierz szablon z katalogu'}
          </Button>
        )}
      </Stack>

      {guestbook === 'personalized' && (
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2 }}>
            📖 Księga gości — personalizacja
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ my: 1 }}>
            {selectedDesign ? (
              <Card variant="outlined" sx={{ display: 'flex', alignItems: 'center', pr: 1, borderColor: 'primary.main', borderWidth: 2 }}>
                <CardMedia
                  component="img"
                  image={selectedDesign.image_url}
                  alt={selectedDesign.name}
                  sx={{ width: 72, height: 96, objectFit: 'contain', bgcolor: '#EEE' }}
                />
                <Box sx={{ px: 1.5 }}>
                  <Typography variant="subtitle2">{selectedDesign.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedDesign.hashtags.map((t) => `#${t}`).join(' ')}
                  </Typography>
                </Box>
                <IconButton onClick={() => setImagePreview({ src: selectedDesign.image_url, title: selectedDesign.name })}>
                  <ZoomInIcon />
                </IconButton>
              </Card>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Nie wybrano jeszcze wzoru księgi.
              </Typography>
            )}
            {editable && (
              <Button variant="outlined" startIcon={<GridViewIcon />} onClick={() => setDesignPickerOpen(true)}>
                {selectedDesign ? 'Zmień wzór księgi' : 'Wybierz wzór księgi'}
              </Button>
            )}
          </Stack>
          <Grid container spacing={2} sx={{ mb: 1 }}>
            <Grid item xs={12} sm={7}>
              <TextField
                fullWidth
                label="Imię / imiona na okładce (dobrze odmienione)"
                placeholder='np. "Kasi i Tomka", "Michała"'
                value={selection.guestbook_names || ''}
                onChange={(e) => setSelection((s) => ({ ...s, guestbook_names: e.target.value }))}
                disabled={!editable}
                inputProps={{ maxLength: 255 }}
                helperText="Dokładnie tak, jak ma być nadrukowane na księdze"
              />
            </Grid>
            <Grid item xs={12} sm={5}>
              <TextField
                fullWidth
                label="Data na księdze"
                placeholder="np. 15.08.2026"
                value={selection.guestbook_date || ''}
                onChange={(e) => setSelection((s) => ({ ...s, guestbook_date: e.target.value }))}
                disabled={!editable}
                inputProps={{ maxLength: 60 }}
              />
            </Grid>
          </Grid>
        </>
      )}

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2 }}>
        ✏️ Tekst na wydruku
      </Typography>
      <TextField
        fullWidth
        placeholder='np. "Wesele Kasi i Tomka", "18 Urodziny Michała", "Bal Firmowy XYZ"'
        value={selection.print_text || ''}
        onChange={(e) => setSelection((s) => ({ ...s, print_text: e.target.value }))}
        disabled={!editable}
        inputProps={{ maxLength: 255 }}
        sx={{ my: 1 }}
      />

      {message && (
        <Alert severity={message.severity} sx={{ my: 1 }}>
          {message.text}
        </Alert>
      )}
      {editable && (
        <Button variant="contained" size="large" onClick={save} sx={{ mt: 1 }}>
          Zapisz personalizację
        </Button>
      )}

      {/* Popup wyboru szablonu — przewijany katalog z filtrowaniem i powiększeniem */}
      <Dialog open={templatePickerOpen} onClose={() => setTemplatePickerOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Wybierz szablon wydruku</DialogTitle>
        <DialogContent dividers sx={{ maxHeight: '70vh' }}>
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', position: 'sticky', top: 0, bgcolor: '#fff', zIndex: 1, py: 1 }}>
            <Chip label="wszystkie" size="small" color={!activeTag ? 'primary' : 'default'} onClick={() => setActiveTag(null)} />
            {hashtags.map((tag) => (
              <Chip
                key={tag.id}
                label={`#${tag.name}`}
                size="small"
                color={activeTag === tag.name ? 'primary' : 'default'}
                onClick={() => setActiveTag(activeTag === tag.name ? null : tag.name)}
              />
            ))}
          </Stack>
          <Grid container spacing={1.5}>
            {visibleTemplates.map((template) => (
              <Grid item xs={6} sm={4} md={3} key={template.id}>
                <Card
                  variant="outlined"
                  sx={{
                    borderColor: selection.print_template_id === template.id ? 'primary.main' : 'divider',
                    borderWidth: selection.print_template_id === template.id ? 2 : 1,
                  }}
                >
                  <CardActionArea onClick={() => pick('print_template_id', template.id)}>
                    <CardMedia
                      component="img"
                      height="200"
                      image={template.image_url}
                      alt={template.name}
                      sx={{ objectFit: 'contain', bgcolor: '#EEE' }}
                    />
                    <CardContent sx={{ py: 1 }}>
                      <Typography variant="subtitle2" noWrap>
                        {template.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {template.hashtags.map((t) => `#${t}`).join(' ')}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                  <Button
                    size="small"
                    fullWidth
                    startIcon={<ZoomInIcon />}
                    onClick={() => setImagePreview({ src: template.image_url, title: template.name })}
                  >
                    Powiększ
                  </Button>
                </Card>
              </Grid>
            ))}
            {visibleTemplates.length === 0 && (
              <Grid item xs={12}>
                <Typography color="text.secondary">Brak szablonów dla wybranego hashtagu.</Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplatePickerOpen(false)}>Zamknij</Button>
          <Button variant="contained" disabled={!selection.print_template_id} onClick={() => setTemplatePickerOpen(false)}>
            Zatwierdź wybór
          </Button>
        </DialogActions>
      </Dialog>

      {/* Popup wyboru wzoru księgi gości — kategorie (rocznica, wesele, urodziny…) + powiększenie */}
      <Dialog open={designPickerOpen} onClose={() => setDesignPickerOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Wybierz wzór księgi gości</DialogTitle>
        <DialogContent dividers sx={{ maxHeight: '70vh' }}>
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', position: 'sticky', top: 0, bgcolor: '#fff', zIndex: 1, py: 1 }}>
            <Chip label="wszystkie" size="small" color={!activeDesignTag ? 'primary' : 'default'} onClick={() => setActiveDesignTag(null)} />
            {hashtags.map((tag) => (
              <Chip
                key={tag.id}
                label={`#${tag.name}`}
                size="small"
                color={activeDesignTag === tag.name ? 'primary' : 'default'}
                onClick={() => setActiveDesignTag(activeDesignTag === tag.name ? null : tag.name)}
              />
            ))}
          </Stack>
          <Grid container spacing={1.5}>
            {visibleDesigns.map((design) => (
              <Grid item xs={6} sm={4} md={3} key={design.id}>
                <Card
                  variant="outlined"
                  sx={{
                    borderColor: selection.guestbook_design_id === design.id ? 'primary.main' : 'divider',
                    borderWidth: selection.guestbook_design_id === design.id ? 2 : 1,
                  }}
                >
                  <CardActionArea onClick={() => pick('guestbook_design_id', design.id)}>
                    <CardMedia
                      component="img"
                      height="200"
                      image={design.image_url}
                      alt={design.name}
                      sx={{ objectFit: 'contain', bgcolor: '#EEE' }}
                    />
                    <CardContent sx={{ py: 1 }}>
                      <Typography variant="subtitle2" noWrap>
                        {design.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {design.hashtags.map((t) => `#${t}`).join(' ')}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                  <Button
                    size="small"
                    fullWidth
                    startIcon={<ZoomInIcon />}
                    onClick={() => setImagePreview({ src: design.image_url, title: design.name })}
                  >
                    Powiększ
                  </Button>
                </Card>
              </Grid>
            ))}
            {visibleDesigns.length === 0 && (
              <Grid item xs={12}>
                <Typography color="text.secondary">Brak wzorów dla wybranego hashtagu.</Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDesignPickerOpen(false)}>Zamknij</Button>
          <Button variant="contained" disabled={!selection.guestbook_design_id} onClick={() => setDesignPickerOpen(false)}>
            Zatwierdź wybór
          </Button>
        </DialogActions>
      </Dialog>

      <YouTubeDialog
        open={!!videoPreview}
        url={videoPreview?.url}
        title={videoPreview?.title}
        onClose={() => setVideoPreview(null)}
      />
      <ImagePreviewDialog
        open={!!imagePreview}
        src={imagePreview?.src}
        title={imagePreview?.title}
        onClose={() => setImagePreview(null)}
      />
    </Box>
  );
}
