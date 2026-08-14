import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './index.css';
import App from './App';
import { applyTheme } from './lib/theme';
import { readStoredSettings } from './store/settings';

applyTheme(readStoredSettings());

window.addEventListener('contextmenu', (e) => e.preventDefault(), {
  capture: true,
});

createRoot(document.getElementById('root')!).render(<App />);
