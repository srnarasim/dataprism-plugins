import { BaseProvider } from "./BaseProvider.js";
import { AWSCredentials, Credentials, AuthenticationError } from "../types/interfaces.js";

export class AWSProvider extends BaseProvider {
  private awsCredentials: AWSCredentials | null = null;

  constructor(credentials?: AWSCredentials) {
    super(credentials);
    if (credentials) {
      this.awsCredentials = credentials;
    }
  }

  async authenticate(credentials: Credentials): Promise<boolean> {
    try {
      if (!this.validateCredentials(credentials)) {
        return false;
      }

      this.awsCredentials = credentials as AWSCredentials;
      this.setCredentials(credentials);

      // Test authentication with a lightweight request
      await this.testCredentials();
      return true;
    } catch (error) {
      this.handleError(error, 'AWS authentication');
      return false;
    }
  }

  async refreshCredentials(): Promise<boolean> {
    if (!this.awsCredentials || !this.awsCredentials.sessionToken) {
      return false;
    }

    try {
      // For AWS STS tokens, we would need to refresh using the STS service
      // For now, we'll just test if the current credentials are still valid
      await this.testCredentials();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getHeaders(url: string, method: string = 'GET'): Promise<Record<string, string>> {
    await this.ensureAuthenticated();
    
    if (!this.awsCredentials) {
      throw new AuthenticationError('AWS credentials not available', 'AWSProvider');
    }

    this.validateUrl(url);
    const urlObj = new URL(url);
    
    const headers = this.createHeaders();
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const datestamp = timestamp.substr(0, 8);
    
    // Add AWS-specific headers
    headers['Host'] = urlObj.host;
    headers['X-Amz-Date'] = timestamp;
    
    if (this.awsCredentials.sessionToken) {
      headers['X-Amz-Security-Token'] = this.awsCredentials.sessionToken;
    }

    // Create signature
    const signature = await this.createSignature(
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
    const awsCreds = credentials as AWSCredentials;
    return !!(
      awsCreds.accessKeyId &&
      awsCreds.secretAccessKey &&
      typeof awsCreds.accessKeyId === 'string' &&
      typeof awsCreds.secretAccessKey === 'string' &&
      awsCreds.accessKeyId.length > 0 &&
      awsCreds.secretAccessKey.length > 0
    );
  }

  private async testCredentials(): Promise<void> {
    if (!this.awsCredentials) {
      throw new AuthenticationError('No AWS credentials to test', 'AWSProvider');
    }

    // We'll implement a lightweight test when we have DuckDB integration
    // For now, just validate the credentials format
    if (!this.validateCredentials(this.awsCredentials)) {
      throw new AuthenticationError('Invalid AWS credentials format', 'AWSProvider');
    }
  }

  private async createSignature(
    method: string,
    url: URL,
    headers: Record<string, string>,
    timestamp: string,
    datestamp: string
  ): Promise<string> {
    if (!this.awsCredentials) {
      throw new AuthenticationError('AWS credentials required for signature', 'AWSProvider');
    }

    const region = this.awsCredentials.region || 'us-east-1';
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
    
    const payloadHash = await this.sha256('');
    
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
      this.awsCredentials.secretAccessKey,
      datestamp,
      region,
      service
    );
    
    const signature = await this.hmacSha256(signingKey, stringToSign);
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Step 4: Create authorization header
    const authorizationHeader = `${algorithm} Credential=${this.awsCredentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
    
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
}