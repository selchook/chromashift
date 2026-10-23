// Single entry point for platform features (Ayvago when embedded, no-ops standalone).
// Calls made before the adapter is ready are queued, so nothing is lost during the handshake.
import { createPlatformAdapter, type PlatformAdapter } from './adapter';

const ready: Promise<PlatformAdapter> = createPlatformAdapter({ gameId: 'chromashift' });

export function onPlatform(action: (platform: PlatformAdapter) => void): void {
  ready.then(action).catch((error) => console.error('[ayvago] platform call failed', error));
}
