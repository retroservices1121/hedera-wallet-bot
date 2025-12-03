import { RateLimiter } from "limiter";

export class BotRateLimiter {
  private twitterLimiter: RateLimiter;
  private dbLimiter: RateLimiter;

  constructor() {
    // Twitter: 35 calls per 5 minutes (conservative: 30/min)
    this.twitterLimiter = new RateLimiter({
      tokensPerInterval: 30,
      interval: "minute",
    });

    // Database: 100 writes per minute
    this.dbLimiter = new RateLimiter({
      tokensPerInterval: 100,
      interval: "minute",
    });
  }

  async waitForTwitter(): Promise<void> {
    await this.twitterLimiter.removeTokens(1);
  }

  async waitForDatabase(): Promise<void> {
    await this.dbLimiter.removeTokens(1);
  }
}

// Export singleton
export const rateLimiter = new BotRateLimiter();
