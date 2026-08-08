import { createRoot } from 'react-dom/client';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './index.css';
import App from './App';
import { applyTheme } from './lib/theme';
import { readStoredSettings } from './store/settings';

// Paint the persisted theme onto <html> before React mounts, so the saved base
// palette and accent are already correct on the first frame. Doing it in an
// effect instead would flash the stylesheet defaults on every launch.
applyTheme(readStoredSettings());

// No StrictMode: our effects open/close real SSH sessions, which isn't safe to
// double-invoke the way StrictMode does in dev.
createRoot(document.getElementById('root')!).render(<App />);
