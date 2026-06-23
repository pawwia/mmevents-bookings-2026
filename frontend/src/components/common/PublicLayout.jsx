import { useState } from 'react';
import { Outlet, Link as RouterLink } from 'react-router-dom';
import { AppBar, Toolbar, Box, Button, Container, Link, Typography, IconButton, Menu, MenuItem } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import Logo from './Logo';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';

export default function PublicLayout() {
  const { token, user, logout } = useAuthStore();
  const companyName = useSettingsStore((s) => s.settings['company.name']) || 'mmevents.pl';
  const [menuAnchor, setMenuAnchor] = useState(null);
  const closeMenu = () => setMenuAnchor(null);
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="inherit" sx={{ boxShadow: 'none', borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}>
        <Toolbar>
          <RouterLink to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Logo />
          </RouterLink>
          <Box sx={{ flexGrow: 1 }} />

          {/* Desktop: przyciski w linii */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
            {token ? (
              <>
                <Button component={RouterLink} to={user?.role === 'admin' ? '/admin' : '/konto'} variant="outlined" sx={{ mr: 1 }}>
                  {user?.role === 'admin' ? 'Panel CRM' : 'Moje konto'}
                </Button>
                <Button onClick={logout}>Wyloguj</Button>
              </>
            ) : (
              <>
                <Button component={RouterLink} to="/logowanie" sx={{ mr: 1 }}>
                  Zaloguj się
                </Button>
                <Button component={RouterLink} to="/rezerwacja" variant="contained">
                  Zarezerwuj termin
                </Button>
              </>
            )}
          </Box>

          {/* Telefon: hamburger z menu */}
          <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
            <IconButton edge="end" aria-label="Menu" onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MenuIcon />
            </IconButton>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu} keepMounted>
              {token ? (
                [
                  <MenuItem
                    key="panel"
                    component={RouterLink}
                    to={user?.role === 'admin' ? '/admin' : '/konto'}
                    onClick={closeMenu}
                  >
                    {user?.role === 'admin' ? 'Panel CRM' : 'Moje konto'}
                  </MenuItem>,
                  <MenuItem key="logout" onClick={() => { closeMenu(); logout(); }}>
                    Wyloguj
                  </MenuItem>,
                ]
              ) : (
                [
                  <MenuItem key="login" component={RouterLink} to="/logowanie" onClick={closeMenu}>
                    Zaloguj się
                  </MenuItem>,
                  <MenuItem key="book" component={RouterLink} to="/rezerwacja" onClick={closeMenu}>
                    Zarezerwuj termin
                  </MenuItem>,
                ]
              )}
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 4, flexGrow: 1 }}>
        <Outlet />
      </Container>

      <Box component="footer" sx={{ borderTop: '1px solid', borderColor: 'divider', bgcolor: '#fff', py: 2.5, mt: 2 }}>
        <Container maxWidth="md">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              © {new Date().getFullYear()} {companyName}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Link component={RouterLink} to="/polityka-prywatnosci" variant="body2" color="text.secondary">
                Polityka prywatności
              </Link>
              <Link component={RouterLink} to="/regulamin" variant="body2" color="text.secondary">
                Regulamin
              </Link>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
