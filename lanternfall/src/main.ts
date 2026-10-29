import { Game } from './core/Game';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app element');

let game: Game | null = null;
try {
  game = new Game(container);
  game.start();
} catch (err) {
  // e.g. WebGL unavailable
  container.textContent = 'Could not start Lanternfall: ' + (err instanceof Error ? err.message : String(err));
}

// Vite hot reload: free the old renderer before the new module runs.
if (import.meta.hot) {
  import.meta.hot.dispose(() => game?.dispose());
}
