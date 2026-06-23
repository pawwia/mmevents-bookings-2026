import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api } from '../../api/client';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Podgląd umowy (PDF renderowany przez PDF.js w przewijanym kontenerze).
 * Przycisk „Zapoznałem się z treścią umowy" jest nieaktywny do momentu
 * przewinięcia dokumentu do samego końca.
 */
export default function ContractPreviewDialog({ open, previewUrl, title = 'Treść umowy', onClose, onConfirm, confirming }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  const renderPdf = useCallback(async () => {
    setLoading(true);
    setError('');
    setScrolledToEnd(false);
    try {
      // Pobranie PDF z autoryzowanego endpointu jako binarne dane
      const res = await api.get(previewUrl, { responseType: 'arraybuffer' });
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(res.data) }).promise;
      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = '';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.3 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.cssText = 'display:block;margin:0 auto 12px;max-width:100%;box-shadow:0 1px 4px rgba(0,0,0,.15)';
        container.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      }
      // Krótki dokument mieszczący się bez przewijania = od razu „przewinięty"
      if (container.scrollHeight <= container.clientHeight + 4) {
        setScrolledToEnd(true);
      }
    } catch (e) {
      setError('Nie udało się wczytać treści umowy. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }, [previewUrl]);

  useEffect(() => {
    if (open && previewUrl) renderPdf();
  }, [open, previewUrl, renderPdf]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 24) {
      setScrolledToEnd(true);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {title}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, position: 'relative' }}>
        {loading && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Wczytywanie umowy…
            </Typography>
          </Box>
        )}
        {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
        <Box
          ref={containerRef}
          onScroll={handleScroll}
          sx={{ height: '62vh', overflowY: 'auto', bgcolor: '#525659', p: 2, display: loading ? 'none' : 'block' }}
        />
        {!loading && !error && !scrolledToEnd && (
          <Box sx={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
            <Typography variant="caption" sx={{ bgcolor: 'rgba(0,0,0,.6)', color: '#fff', px: 1.5, py: 0.5, borderRadius: 2 }}>
              ▼ Przewiń do końca, aby kontynuować
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Anuluj</Button>
        <Button
          variant="contained"
          startIcon={<CheckCircleIcon />}
          disabled={!scrolledToEnd || confirming}
          onClick={onConfirm}
        >
          {confirming ? 'Przetwarzanie…' : 'Zapoznałem się z treścią umowy'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
