import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import './ui/styles.css';

registerSW({ immediate: true });

// Demande au navigateur de ne pas effacer la base en cas de manque d'espace.
navigator.storage?.persist?.().catch(() => undefined);

const root = document.getElementById('app');
if (root) {
  // L'écran de démarrage statique d'index.html est remplacé par le même rendu côté Preact.
  root.replaceChildren();
  render(<App />, root);
}
