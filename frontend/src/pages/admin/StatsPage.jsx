import { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress, Grid, MenuItem, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { api } from '../../api/client';
import { formatPrice } from '../../utils/format';

const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
const MONTHS_FULL = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

function StatCard({ label, value, accent }) {
  return (
    <Paper sx={{ p: 2.5, bgcolor: accent ? 'pink.light' : '#fff', height: '100%' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h4" sx={{ mt: 0.5 }}>{value}</Typography>
    </Paper>
  );
}

/** Prosty wykres słupkowy (bez zewnętrznych bibliotek). */
function BarChart({ data, color, peakMonth, format }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 200, mt: 1 }}>
      {data.map((d) => {
        const isPeak = peakMonth === d.month;
        return (
          <Tooltip key={d.month} title={`${MONTHS_FULL[d.month - 1]}: ${format ? format(d.value) : d.value}`} arrow>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
              <Box sx={{ flexGrow: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <Box
                  sx={{
                    width: '100%',
                    height: `${(d.value / max) * 100}%`,
                    minHeight: d.value > 0 ? 4 : 0,
                    bgcolor: isPeak ? 'primary.dark' : color,
                    borderRadius: 1,
                    transition: 'height .3s',
                  }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                {MONTHS[d.month - 1]}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

export default function StatsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/stats', { params: { year, month: month || undefined } }).then(({ data }) => setData(data));
  }, [year, month]);
  useEffect(load, [load]);

  const yearOptions = data?.years?.length ? data.years : [year];
  const scopeLabel = month ? `${MONTHS_FULL[month - 1]} ${year}` : `rok ${year}`;

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3, flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>Statystyki</Typography>
        <TextField select size="small" label="Rok" value={year} onChange={(e) => setYear(Number(e.target.value))} sx={{ minWidth: 110 }}>
          {yearOptions.map((y) => (
            <MenuItem key={y} value={y}>{y}</MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Miesiąc" value={month} onChange={(e) => setMonth(e.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">Cały rok</MenuItem>
          {MONTHS_FULL.map((m, i) => (
            <MenuItem key={m} value={i + 1}>{m}</MenuItem>
          ))}
        </TextField>
      </Stack>

      {!data ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Podsumowanie: {scopeLabel}
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}>
              <StatCard label="Rezerwacje (wpadłe)" value={data.bookings_in} accent />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard label="Imprezy" value={data.events} />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard label="Przychód (wartość imprez)" value={formatPrice(data.revenue)} />
            </Grid>
            <Grid item xs={6} md={3}>
              <StatCard label="Wpłacono w okresie" value={formatPrice(data.paid)} />
            </Grid>
          </Grid>

          <Paper sx={{ p: 3, mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6">Imprezy w roku {year}</Typography>
              {data.peak_month && (
                <Typography variant="body2" color="text.secondary">
                  Najwięcej imprez: <strong>{MONTHS_FULL[data.peak_month - 1]}</strong>
                </Typography>
              )}
            </Stack>
            <BarChart data={data.by_month.map((m) => ({ month: m.month, value: m.events }))} color="primary.light" peakMonth={data.peak_month} />
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Przychód miesięcznie (wartość imprez) — {year}</Typography>
            <BarChart
              data={data.by_month.map((m) => ({ month: m.month, value: m.revenue }))}
              color="success.light"
              peakMonth={null}
              format={formatPrice}
            />
          </Paper>
        </>
      )}
    </Box>
  );
}
