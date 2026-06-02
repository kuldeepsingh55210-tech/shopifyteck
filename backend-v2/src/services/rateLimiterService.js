let PQueue;
try {
  PQueue = require('p-queue').default;
  if (!PQueue) PQueue = require('p-queue');
} catch(e) {
  PQueue = require('p-queue');
}
const pQueue = PQueue;

console.log('[RateLimiter] PQueue loaded successfully:', typeof PQueue);

class RateLimiter {
  constructor() {
    this.queue = new pQueue({
      concurrency: 2,
      interval: 60000,
      intervalCap: 90
    });
    this.requestTimestamps = [];
    this.cooldownUntil = 0;
  }

  isGlobalCooldown() {
    return Date.now() < this.cooldownUntil;
  }

  setGlobalCooldown(seconds = 60) {
    this.cooldownUntil = Date.now() + (seconds * 1000);
    console.warn(`[RateLimiter] GLOBAL COOLDOWN ACTIVATED for ${seconds} seconds.`);
  }

  async executeWithRetry(fn, maxRetries = 3) {
    if (this.isGlobalCooldown()) {
       console.warn(`[RateLimiter] In global cooldown. Skipping API call.`);
       const error = new Error('Rate Limit Cooldown');
       error.response = { status: 429 };
       throw error;
    }

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.checkRateLimit();
        const result = await fn();
        this.recordRequest();
        return result;
      } catch (error) {
        lastError = error;
        const status = error.response?.status;

        if (status === 429) {
          const waitTime = this.calculateBackoffDelay(attempt);
          console.warn(`[RateLimiter] 429 Rate limit hit. Attempt ${attempt}/${maxRetries}. Waiting ${waitTime}ms before retry...`);
          await this.sleep(waitTime);
        } else if (status === 500 || status === 503) {
          if (attempt < maxRetries) {
            const waitTime = this.calculateBackoffDelay(attempt);
            console.warn(`[RateLimiter] Server error (${status}). Attempt ${attempt}/${maxRetries}. Waiting ${waitTime}ms...`);
            await this.sleep(waitTime);
          } else {
            throw error;
          }
        } else {
          throw error;
        }

        if (attempt === maxRetries) {
          if (status === 429) {
            this.setGlobalCooldown(60);
          }
          throw error;
        }
      }
    }

    throw lastError;
  }

  async executeQueued(fn) {
    return this.queue.add(() => this.executeWithRetry(fn));
  }

  calculateBackoffDelay(attempt) {
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 1000;
    return delay + jitter;
  }

  async checkRateLimit() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);

    if (this.requestTimestamps.length >= 90) {
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = oldestRequest + 60000 - now + 100;
      console.warn(`[RateLimiter] Request queue at limit. Waiting ${waitTime}ms...`);
      await this.sleep(Math.max(waitTime, 0));
    }
  }

  recordRequest() {
    this.requestTimestamps.push(Date.now());
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getQueueSize() {
    return this.queue.size;
  }

  getPendingCount() {
    return this.queue.pending;
  }
}

module.exports = new RateLimiter();
