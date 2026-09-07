interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
}

export class AppCache {
  private store = new Map<string, CacheEntry<any>>();
  private hits = 0;
  private misses = 0;

  // Set with TTL in milliseconds and optional tags
  set<T>(key: string, value: T, ttlMs: number, tags: string[] = []): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      tags,
    });
  }

  // Get unexpired value
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value as T;
  }

  // Invalidate specific key
  del(key: string): void {
    this.store.delete(key);
  }

  // Invalidate all keys matching any of the given tags
  invalidateTags(tags: string[]): void {
    const tagSet = new Set(tags);
    for (const [key, entry] of this.store.entries()) {
      if (entry.tags.some((t) => tagSet.has(t))) {
        this.store.delete(key);
      }
    }
  }

  // Clear entire cache
  clear(): void {
    this.store.clear();
  }

  // Memory hygiene: sweep expired keys periodically
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  // Cache Telemetry Stats
  stats() {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRatioPercent: this.hits + this.misses > 0 ? Math.round((this.hits / (this.hits + this.misses)) * 100) : 0,
    };
  }
}

export const appCache = new AppCache();

// Periodic prune every 60 seconds
setInterval(() => {
  appCache.prune();
}, 60000);
