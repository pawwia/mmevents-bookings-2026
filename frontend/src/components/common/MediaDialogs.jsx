import { Dialog, DialogContent, DialogTitle, IconButton, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

function DialogHeader({ title, onClose }) {
  return (
    <DialogTitle sx={{ pr: 6 }}>
      {title}
      <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
        <CloseIcon />
      </IconButton>
    </DialogTitle>
  );
}

/** Powiększony podgląd obrazu (tła, szablony wydruków, księgi). */
export function ImagePreviewDialog({ open, src, title, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogHeader title={title} onClose={onClose} />
      <DialogContent sx={{ textAlign: 'center', bgcolor: '#FAFAFB' }}>
        {src && (
          <Box
            component="img"
            src={src}
            alt={title}
            sx={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 1, boxShadow: 2 }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Wyodrębnia ID filmu z linku YouTube (watch, youtu.be, shorts, embed). */
function youtubeId(url) {
  const match = String(url || '').match(
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/
  );
  return match ? match[1] : null;
}

/** Odtwarzanie animacji z YouTube w popupie — bez wychodzenia ze strony. */
export function YouTubeDialog({ open, url, title, onClose }) {
  const id = youtubeId(url);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogHeader title={title} onClose={onClose} />
      <DialogContent>
        {open && id ? (
          <Box sx={{ position: 'relative', pt: '56.25%' }}>
            <Box
              component="iframe"
              src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 1 }}
            />
          </Box>
        ) : (
          open && <Box sx={{ p: 2 }}>Nieprawidłowy link YouTube.</Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
