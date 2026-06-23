import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Box, Button, Container, Tabs, Tab, Link } from '@mui/material';
import Logo from './Logo';
import { useAuthStore } from '../../store/authStore';

export default function ClientLayout() {
  const { logout, user } = useAuthStore();
  const location = useLocation();
  const tab = location.pathname.startsWith('/konto/profil') ? '/konto/profil' : '/konto';

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="inherit" sx={{ boxShadow: 'none', borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
        <Toolbar>
          <RouterLink to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Logo />
          </RouterLink>
          <Tabs value={tab} sx={{ ml: 4, flexGrow: 1 }}>
            <Tab label="Moje rezerwacje" value="/konto" component={RouterLink} to="/konto" />
            <Tab label="Mój profil" value="/konto/profil" component={RouterLink} to="/konto/profil" />
          </Tabs>
          <Button component={RouterLink} to="/rezerwacja" variant="contained" sx={{ mr: 2 }}>
            Nowa rezerwacja
          </Button>
          <Button onClick={logout}>Wyloguj ({user?.first_name})</Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 4, flexGrow: 1 }}>
        <Outlet />
      </Container>
      <Box component="footer" sx={{ borderTop: '1px solid', borderColor: 'divider', bgcolor: '#fff', py: 2 }}>
        <Container maxWidth="md" sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Link component={RouterLink} to="/polityka-prywatnosci" variant="body2" color="text.secondary">
            Polityka prywatności
          </Link>
          <Link component={RouterLink} to="/regulamin" variant="body2" color="text.secondary">
            Regulamin
          </Link>
        </Container>
      </Box>
    </Box>
  );
}
