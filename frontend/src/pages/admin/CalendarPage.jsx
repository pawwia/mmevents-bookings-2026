import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Paper, Typography } from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import plLocale from '@fullcalendar/core/locales/pl';
import { api, apiError } from '../../api/client';

const STATUS_BG = {
  new: '#F59E0B',
  awaiting_contract: '#60A5FA',
  awaiting_deposit: '#A78BFA',
  confirmed: '#34D399',
  last_call: '#FBBF24',
  ready: '#E8AEB7',
  completed: '#9CA3AF',
  cancelled: '#F87171',
};

/**
 * Kalendarz CRM: widok dzień/tydzień/miesiąc, drag&drop rezerwacji
 * (PATCH event_date/start_time → automatyczna synchronizacja Google Calendar po stronie API).
 */
export default function CalendarPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const calendarRef = useRef(null);

  const fetchEvents = useCallback((info, success, failure) => {
    Promise.all([
      api.get('/admin/bookings', { params: { from: info.startStr.slice(0, 10), to: info.endStr.slice(0, 10) } }),
      api.get('/admin/blackouts').catch(() => ({ data: [] })), // brak modułu/migracji → bez blokad
    ])
      .then(([bookings, blackouts]) => {
        const bookingEvents = bookings.data
          .filter((b) => b.status !== 'cancelled')
          .map((b) => ({
            id: String(b.id),
            title: `#${b.id} ${b.first_name} ${b.last_name} — ${b.package_name}`,
            start: `${b.event_date}T${b.start_time}`,
            end: addHours(`${b.event_date}T${b.start_time}`, Number(b.duration_hours)),
            backgroundColor: STATUS_BG[b.status],
            borderColor: STATUS_BG[b.status],
          }));
        const blackoutEvents = blackouts.data.map((b) => ({
          id: `blackout-${b.id}`,
          title: b.comment ? `Urlop: ${b.comment}` : 'Urlop / termin niedostępny',
          start: b.start_date,
          end: addDays(b.end_date, 1), // koniec all-day jest wyłączny → +1 dzień
          allDay: true,
          editable: false,
          backgroundColor: '#6B7280',
          borderColor: '#4B5563',
        }));
        success([...bookingEvents, ...blackoutEvents]);
      })
      .catch(failure);
  }, []);

  const handleDrop = async (info) => {
    setError('');
    try {
      await api.patch(`/admin/bookings/${info.event.id}`, {
        event_date: info.event.startStr.slice(0, 10),
        start_time: info.event.startStr.slice(11, 16) || '00:00',
      });
    } catch (e) {
      setError(apiError(e));
      info.revert();
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Kalendarz realizacji
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Paper sx={{ p: 2 }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          locale={plLocale}
          events={fetchEvents}
          editable
          eventDrop={handleDrop}
          eventClick={(info) => {
            if (info.event.id.startsWith('blackout-')) {
              navigate('/admin/urlopy');
              return;
            }
            navigate(`/admin/rezerwacje/${info.event.id}`);
          }}
          height="auto"
          firstDay={1}
          nowIndicator
        />
      </Paper>
    </Box>
  );
}

function addHours(iso, hours) {
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() + Math.round(hours * 60));
  return date.toISOString().slice(0, 19);
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
