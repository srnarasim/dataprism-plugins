import { IAuthProvider, Credentials, AuthenticationError } from "../types/interfaces.js";

export abstract class BaseProvider implements IAuthProvider {
  protected credentials: Credentials | null = null;
  protected lastAuthTime: Date | null = null;
  protected authExpiry: Date | null = null;

  constructor(credentials?: Credentials) {
    if (credentials) {
      this.credentials = credentials;
    }
  }

  abstract authenticate(credentials: Credentials): Promise<boolean>;
  abstract refreshCredentials(): Promise<boolean>;
  abstract getHeaders(url: string, method: string): Promise<Record<string, string>>;
  abstract validateCredentials(credentials: Credentials): boolean;

  protected isAuthExpired(): boolean {
    if (!this.authExpiry || !this.lastAuthTime) {
      return true;
    }
    return new Date() >= this.authExpiry;
  }

  protected setCredentials(credentials: Credentials): void {
    this.credentials = credentials;
    this.lastAuthTime = new Date();
    
    // Set default expiry if not specified
    if ('expires' in credentials && credentials.expires) {
      this.authExpiry = new Date(credentials.expires);
    } else {
      // Default 1 hour expiry
      this.authExpiry = new Date(Date.now() + 3600000);
    }
  }

  protected requiresRefresh(): boolean {
    return this.isAuthExpired() && this.credentials && 'refreshable' in this.credentials && this.credentials.refreshable;
  }

  protected async ensureAuthenticated(): Promise<void> {
    if (!this.credentials) {
      throw new AuthenticationError('No credentials provided', this.constructor.name);
    }

    if (this.requiresRefresh()) {
      const refreshed = await this.refreshCredentials();
      if (!refreshed) {
        throw new AuthenticationError('Failed to refresh credentials', this.constructor.name);
      }
    } else if (this.isAuthExpired()) {
      const authenticated = await this.authenticate(this.credentials);
      if (!authenticated) {
        throw new AuthenticationError('Authentication failed', this.constructor.name);
      }
    }
  }

  protected validateUrl(url: string): void {
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL: ${url}`);
    }
  }

  protected createHeaders(baseHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      'User-Agent': 'DataPrism-ParquetHttpfs/1.0.0',
      'Accept': 'application/octet-stream, */*',
      'Cache-Control': 'no-cache',
      ...baseHeaders,
    };
  }

  protected handleError(error: any, context: string): never {
    if (error.name === 'ParquetHttpfsError') {
      throw error;
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new AuthenticationError(`Network error in ${context}: ${error.message}`, this.constructor.name);
    }

    throw new AuthenticationError(`Unexpected error in ${context}: ${error.message}`, this.constructor.name);
  }
}