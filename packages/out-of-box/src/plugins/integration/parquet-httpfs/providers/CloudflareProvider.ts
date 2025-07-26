import { BaseProvider } from "./BaseProvider.js";
import { CloudflareCredentials, Credentials, AuthenticationError, R2Configuration } from "../types/interfaces.js";

export class CloudflareProvider extends BaseProvider {
  private r2Credentials: CloudflareCredentials | null = null;
  private r2Config: R2Configuration | null = null;

  constructor(credentials?: CloudflareCredentials) {
    super(credentials);
    if (credentials) {
      this.r2Credentials = credentials;
      this.r2Config = this.buildR2Configuration(credentials);
    }
  }

  async authenticate(credentials: Credentials): Promise<boolean> {
    try {
      if (!this.validateCredentials(credentials)) {
        return false;
      }

      this.r2Credentials = credentials as CloudflareCredentials;
      this.r2Config = this.buildR2Configuration(this.r2Credentials);
      this.setCredentials(credentials);

      // Test authentication with a lightweight request
      await this.testCredentials();
      return true;
    } catch (error) {
      this.handleError(error, 'CloudFlare R2 authentication');
      return false;
    }
  }

  async refreshCredentials(): Promise<boolean> {
    if (!this.r2Credentials) {
      return false;
    }

    try {
      // R2 API tokens don't typically expire, but we can test if they're still valid
      await this.testCredentials();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getHeaders(url: string, method: string = 'GET'): Promise<Record<string, string>> {
    await this.ensureAuthenticated();
    
    if (!this.r2Credentials || !this.r2Config) {
      throw new AuthenticationError('CloudFlare R2 credentials not available', 'CloudflareProvider');
    }

    // Handle worker endpoint proxy
    if (this.r2Credentials.workerEndpoint) {
      return this.getWorkerProxyHeaders(url, method);
    }

    this.validateUrl(url);
    const urlObj = new URL(url);
    
    const headers = this.createHeaders();
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const datestamp = timestamp.substr(0, 8);
    
    // Add R2-specific headers
    headers['Host'] = urlObj.host;
    headers['X-Amz-Date'] = timestamp;
    headers['X-Amz-Content-Sha256'] = 'UNSIGNED-PAYLOAD';

    // Create AWS-compatible signature for R2
    const signature = await this.createR2Signature(
      method,
      urlObj,
      headers,
      timestamp,
      datestamp
    );

    headers['Authorization'] = signature;
    
    return headers;
  }

  validateCredentials(credentials: Credentials): boolean {
    const r2Creds = credentials as CloudflareCredentials;
    return !!(
      r2Creds.accountId &&
      r2Creds.accessKeyId &&
      r2Creds.secretAccessKey &&
      typeof r2Creds.accountId === 'string' &&
      typeof r2Creds.accessKeyId === 'string' &&
      typeof r2Creds.secretAccessKey === 'string' &&
      r2Creds.accountId.length > 0 &&
      r2Creds.accessKeyId.length > 0 &&
      r2Creds.secretAccessKey.length > 0
    );
  }

  getEndpoint(): string {
    if (!this.r2Credentials) {
      throw new AuthenticationError('R2 credentials required to get endpoint', 'CloudflareProvider');
    }

    if (this.r2Credentials.customDomain) {
      return `https://${this.r2Credentials.customDomain}`;
    }
    
    const jurisdictionSuffix = this.r2Credentials.jurisdiction === 'eu' ? '-eu' : 
                              this.r2Credentials.jurisdiction === 'fedramp-moderate' ? '-fedramp' : '';
    return `https://${this.r2Credentials.accountId}.r2${jurisdictionSuffix}.cloudflarestorage.com`;
  }

  async selectOptimalEndpoint(userLocation?: GeolocationPosition): Promise<string> {
    if (!this.r2Credentials) {
      return this.getEndpoint();
    }

    // CloudFlare R2 automatically routes to nearest edge location
    // but we can optimize based on jurisdiction requirements
    
    if (userLocation) {
      const { latitude, longitude } = userLocation.coords;
      
      // EU jurisdiction for European users
      if (this.isEuropeanLocation(latitude, longitude)) {
        return `https://${this.r2Credentials.accountId}.r2-eu.cloudflarestorage.com`;
      }
      
      // FedRAMP for US government requirements
      if (this.requiresFedRAMP(userLocation)) {
        return `https://${this.r2Credentials.accountId}.r2-fedramp.cloudflarestorage.com`;
      }
    }
    
    // Default auto-routing
    return this.getEndpoint();
  }

  private buildR2Configuration(credentials: CloudflareCredentials): R2Configuration {
    return {
      endpoint: this.getEndpoint(),
      jurisdiction: credentials.jurisdiction || 'auto',
      customDomain: credentials.customDomain,
      corsPolicy: {
        enabled: true,
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        credentials: true,
      },
      pathStyle: true, // R2 uses path-style URLs by default
    };
  }

  private async testCredentials(): Promise<void> {
    if (!this.r2Credentials) {
      throw new AuthenticationError('No R2 credentials to test', 'CloudflareProvider');
    }

    // We'll implement a lightweight test when we have DuckDB integration
    // For now, just validate the credentials format
    if (!this.validateCredentials(this.r2Credentials)) {
      throw new AuthenticationError('Invalid R2 credentials format', 'CloudflareProvider');
    }
  }

  private async getWorkerProxyHeaders(url: string, method: string): Promise<Record<string, string>> {
    if (!this.r2Credentials?.workerEndpoint) {
      throw new AuthenticationError('Worker endpoint not configured', 'CloudflareProvider');
    }

    const headers = this.createHeaders();
    
    // Add worker-specific authentication
    headers['Authorization'] = `Bearer ${this.r2Credentials.accessKeyId}`;
    headers['X-Original-URL'] = url;
    headers['X-Original-Method'] = method;
    
    return headers;
  }

  private async createR2Signature(
    method: string,
    url: URL,
    headers: Record<string, string>,
    timestamp: string,
    datestamp: string
  ): Promise<string> {
    if (!this.r2Credentials) {
      throw new AuthenticationError('R2 credentials required for signature', 'CloudflareProvider');
    }

    // R2 uses AWS-compatible signatures but with 'auto' region
    const region = 'auto';
    const service = 's3';
    
    // Step 1: Create canonical request
    const canonicalUri = url.pathname || '/';
    const canonicalQuerystring = url.search.substring(1) || '';
    
    // Sort headers and create canonical headers string
    const sortedHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key].trim()}`)
      .join('\n');
    
    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');
    
    const payloadHash = 'UNSIGNED-PAYLOAD';
    
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuerystring,
      sortedHeaders,
      '',
      signedHeaders,
      payloadHash
    ].join('\n');

    // Step 2: Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${datestamp}/${region}/${service}/aws4_request`;
    const canonicalRequestHash = await this.sha256(canonicalRequest);
    
    const stringToSign = [
      algorithm,
      timestamp,
      credentialScope,
      canonicalRequestHash
    ].join('\n');

    // Step 3: Calculate signature
    const signingKey = await this.getSignatureKey(
      this.r2Credentials.secretAccessKey,
      datestamp,
      region,
      service
    );
    
    const signature = await this.hmacSha256(signingKey, stringToSign);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Step 4: Create authorization header
    const authorizationHeader = `${algorithm} Credential=${this.r2Credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
    
    return authorizationHeader;
  }

  private async sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const messageBuffer = new TextEncoder().encode(message);
    return await crypto.subtle.sign('HMAC', cryptoKey, messageBuffer);
  }

  private async getSignatureKey(
    key: string,
    dateStamp: string,
    regionName: string,
    serviceName: string
  ): Promise<ArrayBuffer> {
    const kDate = await this.hmacSha256(
      new TextEncoder().encode('AWS4' + key),
      dateStamp
    );
    const kRegion = await this.hmacSha256(kDate, regionName);
    const kService = await this.hmacSha256(kRegion, serviceName);
    const kSigning = await this.hmacSha256(kService, 'aws4_request');
    
    return kSigning;
  }

  private isEuropeanLocation(lat: number, lon: number): boolean {
    // Simplified EU boundary check
    return lat >= 35 && lat <= 72 && lon >= -25 && lon <= 45;
  }

  private requiresFedRAMP(location: GeolocationPosition): boolean {
    // This would be determined by organizational requirements
    // For now, return false as a placeholder
    return false;
  }
}