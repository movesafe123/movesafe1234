/**
 * api-quota-guard.js - Bộ bảo vệ Hạn mức & Xoay vòng API Key (MoveSafe VN Backend)
 * Tính năng:
 *  1. Xoay vòng nhiều API Key (Key Pool) khi có biến môi trường *_KEYS hoặc key dự phòng.
 *  2. Ngắt mạch tự động (Circuit Breaker) khi gặp HTTP 403 / 429 để tránh spam làm khóa key.
 *  3. Khử trùng lặp request đồng thời (In-flight Dedup) + Cache LRU có TTL dùng chung cho mọi Client.
 */

const crypto = require('crypto');

function parseKeyPool(...sources) {
  const keys = [];
  const seen = new Set();
  for (const src of sources) {
    if (!src) continue;
    const parts = Array.isArray(src) ? src : String(src).split(/[\s,;]+/);
    for (const raw of parts) {
      const k = String(raw || '').trim().replace(/^['"]|['"]$/g, '');
      if (k && !seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys;
}

class ApiQuotaGuard {
  constructor() {
    this.keyCooldowns = new Map(); // `${provider}:${keyHash}` -> unblockTimestampMs
    this.cache = new Map();        // cacheKey -> { expiresAt, value }
    this.inflight = new Map();     // cacheKey -> Promise
    this.maxCacheEntries = 1000;
  }

  _hashKey(apiKey) {
    return crypto.createHash('sha256').update(String(apiKey || '')).digest('hex').slice(0, 12);
  }

  isKeyBlocked(provider, apiKey) {
    if (!apiKey) return true;
    const id = `${provider}:${this._hashKey(apiKey)}`;
    const until = this.keyCooldowns.get(id) || 0;
    if (Date.now() < until) return true;
    if (until > 0) this.keyCooldowns.delete(id);
    return false;
  }

  getHealthyKey(provider, keyPool = []) {
    const keys = Array.isArray(keyPool) ? keyPool.filter(Boolean) : [keyPool].filter(Boolean);
    for (const k of keys) {
      if (!this.isKeyBlocked(provider, k)) return k;
    }
    return null;
  }

  getHealthyKeys(provider, keyPool = []) {
    const keys = Array.isArray(keyPool) ? keyPool.filter(Boolean) : [keyPool].filter(Boolean);
    return keys.filter(k => !this.isKeyBlocked(provider, k));
  }

  markRateLimited(provider, apiKey, statusCode = 429, retryAfterHeader = null) {
    if (!apiKey) return 0;
    const defaultMs = statusCode === 403
      ? 30 * 60 * 1000 // 403 Hết hạn mức ngày / InsufficientFunds -> nghỉ 30 phút
      : (provider === 'gemini' ? 90 * 1000 : 15 * 60 * 1000); // 429 Too Many Requests

    let cooldownMs = defaultMs;
    if (retryAfterHeader) {
      const parsedSec = Number(retryAfterHeader);
      if (Number.isFinite(parsedSec) && parsedSec > 0) {
        cooldownMs = Math.max(cooldownMs, parsedSec * 1000);
      }
    }

    const id = `${provider}:${this._hashKey(apiKey)}`;
    const until = Date.now() + cooldownMs;
    this.keyCooldowns.set(id, until);
    console.warn(`[QuotaGuard] Tạm khóa key ${provider} (${id.split(':')[1]}) trong ${Math.round(cooldownMs / 60000 * 10) / 10} phút do HTTP ${statusCode}.`);
    return cooldownMs;
  }

  getCached(cacheKey) {
    const entry = this.cache.get(cacheKey);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(cacheKey);
      return undefined;
    }
    return entry.value;
  }

  setCached(cacheKey, value, ttlMs = 30 * 60 * 1000) {
    if (this.cache.size >= this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(cacheKey, { expiresAt: Date.now() + ttlMs, value });
  }

  async withDedupAndCache(cacheKey, ttlMs, fetcherFn) {
    const hit = this.getCached(cacheKey);
    if (hit !== undefined) {
      return { value: hit, cached: true };
    }

    if (this.inflight.has(cacheKey)) {
      const shared = await this.inflight.get(cacheKey);
      return { value: shared, cached: true, deduped: true };
    }

    const promise = (async () => {
      try {
        const res = await fetcherFn();
        if (res !== undefined && res !== null) {
          this.setCached(cacheKey, res, ttlMs);
        }
        return res;
      } finally {
        this.inflight.delete(cacheKey);
      }
    })();

    this.inflight.set(cacheKey, promise);
    const value = await promise;
    return { value, cached: false };
  }

  getStats() {
    const now = Date.now();
    const activeCooldowns = [];
    for (const [id, until] of this.keyCooldowns.entries()) {
      if (until > now) {
        activeCooldowns.push({
          provider: id.split(':')[0],
          remainingSec: Math.ceil((until - now) / 1000)
        });
      }
    }
    return {
      cacheEntries: this.cache.size,
      inflightRequests: this.inflight.size,
      activeCooldowns
    };
  }
}

const apiQuotaGuard = new ApiQuotaGuard();

module.exports = {
  ApiQuotaGuard,
  apiQuotaGuard,
  parseKeyPool
};

