import { useState } from 'react';
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar,
  AppBar, Typography, Button, Divider, IconButton,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/SpaceDashboardOutlined';
import InsightsIcon from '@mui/icons-material/InsightsOutlined';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonthOutlined';
import EventNoteIcon from '@mui/icons-material/EventNoteOutlined';
import EventBusyIcon from '@mui/icons-material/EventBusyOutlined';
import RequestQuoteIcon from '@mui/icons-material/RequestQuoteOutlined';
import TravelExploreIcon from '@mui/icons-material/TravelExploreOutlined';
import InventoryIcon from '@mui/icons-material/Inventory2Outlined';
import MovieIcon from '@mui/icons-material/MovieOutlined';
import WallpaperIcon from '@mui/icons-material/WallpaperOutlined';
import PrintIcon from '@mui/icons-material/PrintOutlined';
import AutoStoriesIcon from '@mui/icons-material/AutoStoriesOutlined';
import LocalOfferIcon from '@mui/icons-material/LocalOfferOutlined';
import EmailIcon from '@mui/icons-material/EmailOutlined';
import PeopleIcon from '@mui/icons-material/PeopleAltOutlined';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import HistoryIcon from '@mui/icons-material/HistoryOutlined';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongOutlined';
import Logo from '../common/Logo';
import ChatNotifications from './ChatNotifications';
import { useAuthStore } from '../../store/authStore';

const WIDTH = 248;

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: <DashboardIcon />, exact: true },
  { to: '/admin/statystyki', label: 'Statystyki', icon: <InsightsIcon /> },
  { to: '/admin/kalendarz', label: 'Kalendarz', icon: <CalendarMonthIcon /> },
  { to: '/admin/rezerwacje', label: 'Rezerwacje', icon: <EventNoteIcon /> },
  { to: '/admin/urlopy', label: 'Urlopy / blokady', icon: <EventBusyIcon /> },
  { to: '/admin/oferty', label: 'Oferty', icon: <RequestQuoteIcon /> },
  { to: '/admin/sprawdzenia-terminow', label: 'Sprawdzenia terminów', icon: <TravelExploreIcon /> },
  { to: '/admin/klienci', label: 'Klienci', icon: <PeopleIcon /> },
  { divider: true },
  { to: '/admin/pakiety', label: 'Pakiety i cennik', icon: <InventoryIcon /> },
  { to: '/admin/animacje', label: 'Animacje', icon: <MovieIcon /> },
  { to: '/admin/tla', label: 'Tła', icon: <WallpaperIcon /> },
  { to: '/admin/szablony-wydrukow', label: 'Szablony wydruków', icon: <PrintIcon /> },
  { to: '/admin/ksiegi-gosci', label: 'Księgi gości (wzory)', icon: <AutoStoriesIcon /> },
  { to: '/admin/kody-rabatowe', label: 'Kody rabatowe', icon: <LocalOfferIcon /> },
  { divider: true },
  { to: '/admin/tresci', label: 'Treści e-mail / SMS', icon: <EmailIcon /> },
  { to: '/admin/ustawienia', label: 'Ustawienia systemu', icon: <SettingsIcon /> },
  { to: '/admin/audyt', label: 'Audyt zmian', icon: <HistoryIcon /> },
  { to: '/admin/logi', label: 'Logi i kolejki', icon: <ReceiptLongIcon /> },
];

export default function AdminLayout() {
  const location = useLocation();
  const { logout, user } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navList = (
    <List dense sx={{ px: 1, pt: 2 }}>
      {NAV.map((item, i) =>
        item.divider ? (
          <Divider key={i} sx={{ my: 1 }} />
        ) : (
          <ListItemButton
            key={item.to}
            component={RouterLink}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            selected={item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to)}
            sx={{
              borderRadius: 2,
              mb: 0.25,
              '&.Mui-selected': { bgcolor: 'pink.light', '&:hover': { bgcolor: 'pink.light' } },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: 500 }} />
          </ListItemButton>
        )
      )}
    </List>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        sx={{ zIndex: (t) => t.zIndex.drawer + 1, boxShadow: 'none', borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen((v) => !v)}
            sx={{ mr: 1, display: { md: 'none' } }}
            aria-label="Otwórz menu"
          >
            <MenuIcon />
          </IconButton>
          <Logo height={44} />
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2, display: { xs: 'none', sm: 'block' } }}>
            CRM
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <ChatNotifications />
          <Typography variant="body2" color="text.secondary" sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>
            {user?.first_name} {user?.last_name}
          </Typography>
          <Button onClick={logout} size="small">
            Wyloguj
          </Button>
        </Toolbar>
      </AppBar>

      {/* Desktop: stałe menu; mobile: wysuwane spod hamburgera */}
      <Box component="nav" sx={{ width: { md: WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: WIDTH, boxSizing: 'border-box', bgcolor: '#fff' },
          }}
        >
          <Toolbar />
          {navList}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: WIDTH, boxSizing: 'border-box', borderRight: '1px solid #EAECEF', bgcolor: '#fff' },
          }}
        >
          <Toolbar />
          {navList}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, width: { md: `calc(100% - ${WIDTH}px)` } }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
