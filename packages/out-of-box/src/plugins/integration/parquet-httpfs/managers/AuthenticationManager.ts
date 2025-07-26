import { IAuthProvider, Credentials, AuthenticationError } from "../types/interfaces.js";
import { AWSProvider } from "../providers/AWSProvider.js";
import { CloudflareProvider } from "../providers/CloudflareProvider.js";

export class AuthenticationManager {
  private providers: Map<string, IAuthProvider> = new Map();
  private credentialStore: Map<string, Credentials> = new Map();

  constructor() {
    // Initialize default providers
    this.registerProvider('aws', new AWSProvider());
    this.registerProvider('cloudflare', new CloudflareProvider());
  }

  registerProvider(name: string, provider: IAuthProvider): void {
    this.providers.set(name, provider);
  }

  getProvider(name: string): IAuthProvider | undefined {
    return this.providers.get(name);
  }

  async setCredentials(provider: string, credentials: Credentials): Promise<void> {
    const authProvider = this.providers.get(provider);
    if (!authProvider) {
      throw new AuthenticationError(`Unknown provider: ${provider}`, provider);
    }

    if (!authProvider.validateCredentials(credentials)) {
      throw new AuthenticationError(`Invalid credentials for provider: ${provider}`, provider);
    }

    const authenticated = await authProvider.authenticate(credentials);
    if (!authenticated) {
      throw new AuthenticationError(`Authentication failed for provider: ${provider}`, provider);
    }

    this.credentialStore.set(provider, credentials);
  }

  async refreshCredentials(provider: string): Promise<boolean> {
    const authProvider = this.providers.get(provider);
    const credentials = this.credentialStore.get(provider);

    if (!authProvider || !credentials) {
      return false;
    }

    try {
      const refreshed = await authProvider.refreshCredentials();
      return refreshed;
    } catch (error) {
      // If refresh fails, remove credentials
      this.credentialStore.delete(provider);
      return false;
    }
  }

  async getHeaders(provider: string, url: string, method: string = 'GET'): Promise<Record<string, string>> {
    const authProvider = this.providers.get(provider);
    if (!authProvider) {
      throw new AuthenticationError(`Unknown provider: ${provider}`, provider);
    }

    const credentials = this.credentialStore.get(provider);
    if (!credentials) {
      throw new AuthenticationError(`No credentials found for provider: ${provider}`, provider);
    }

    return await authProvider.getHeaders(url, method);
  }

  hasCredentials(provider: string): boolean {
    return this.credentialStore.has(provider);
  }

  removeCredentials(provider: string): void {
    this.credentialStore.delete(provider);
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async testConnection(provider: string, url: string): Promise<boolean> {
    try {
      const headers = await this.getHeaders(provider, url, 'HEAD');
      
      // Make a lightweight HEAD request to test connectivity
      const response = await fetch(url, {
        method: 'HEAD',
        headers,
      });

      return response.ok || response.status === 405; // 405 = Method Not Allowed is also acceptable
    } catch (error) {
      return false;
    }
  }

  getProviderForUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // AWS S3 patterns
      if (hostname.includes('.s3.') || hostname.includes('s3.') || hostname === 's3.amazonaws.com') {
        return 'aws';
      }

      // CloudFlare R2 patterns
      if (hostname.includes('.r2.cloudflarestorage.com') || 
          hostname.includes('.r2-') || 
          hostname.includes('workers.dev')) {
        return 'cloudflare';
      }

      // Custom domain handling - would need configuration
      return null;
    } catch (error) {
      return null;
    }
  }

  async autoAuthenticate(url: string, credentials: Credentials): Promise<string> {
    const provider = this.getProviderForUrl(url);
    if (!provider) {
      throw new AuthenticationError(`Could not determine provider for URL: ${url}`, 'auto');
    }

    await this.setCredentials(provider, credentials);
    return provider;
  }

  cleanup(): void {
    this.credentialStore.clear();
    this.providers.clear();
  }
}