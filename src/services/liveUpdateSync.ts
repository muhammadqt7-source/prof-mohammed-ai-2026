/**
 * Live Deployment Auto-Sync Service
 * 
 * Automatically detects when a new version of the app is built and deployed
 * to the shared Cloud Run URL, and seamlessly reloads the WebView/browser
 * so that users always run the latest live build without needing a new APK.
 * 
 * All user data, identity (localStorage), points, and campaign states are 100% preserved.
 */

let currentBuildId: string | null = null;
let isChecking = false;
let lastReloadTimestamp = 0;

export async function checkServerVersion(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isChecking) return false;

  // Prevent multiple rapid reloads (must be at least 10 seconds apart)
  if (Date.now() - lastReloadTimestamp < 10000) return false;

  try {
    isChecking = true;
    const res = await fetch(`/api/version?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    if (!res.ok) return false;
    const data = await res.json();
    const serverBuildId = data.buildId;

    if (!serverBuildId) return false;

    // First check on application mount
    if (!currentBuildId) {
      currentBuildId = serverBuildId;
      return false;
    }

    // New deployment detected on server!
    if (serverBuildId !== currentBuildId) {
      console.log(`[LiveSync] New deployment detected: ${currentBuildId} -> ${serverBuildId}. Refreshing app...`);
      lastReloadTimestamp = Date.now();
      // Hard reload to bypass any browser/WebView memory cache
      window.location.reload();
      return true;
    }

    return false;
  } catch {
    // Network offline or momentary disconnect: keep current screen operational
    return false;
  } finally {
    isChecking = false;
  }
}

export function initLiveUpdateSync(): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Check version immediately on mount
  checkServerVersion();

  // 2. Check whenever user reopens the app from background or unlocks the device
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      checkServerVersion();
    }
  };

  // 3. Check whenever the window/tab regains focus
  const handleFocus = () => {
    checkServerVersion();
  };

  // 4. Periodic background check every 60 seconds
  const intervalId = setInterval(() => {
    checkServerVersion();
  }, 60000);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);

  return () => {
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
  };
}
