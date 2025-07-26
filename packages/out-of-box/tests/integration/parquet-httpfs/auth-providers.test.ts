import { describe, it, expect, beforeEach, vi } from "vitest";
import { AWSProvider } from "../../../src/plugins/integration/parquet-httpfs/providers/AWSProvider.js";
import { CloudflareProvider } from "../../../src/plugins/integration/parquet-httpfs/providers/CloudflareProvider.js";
import { AuthenticationManager } from "../../../src/plugins/integration/parquet-httpfs/managers/AuthenticationManager.js";
import type { AWSCredentials, CloudflareCredentials } from "../../../src/plugins/integration/parquet-httpfs/types/interfaces.js";

// Mock credentials
const mockAWSCredentials: AWSCredentials = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
};

const mockCloudflareCredentials: CloudflareCredentials = {
  accountId: "test-account-id",
  accessKeyId: "test-r2-access-key",
  secretAccessKey: "test-r2-secret-key",
  jurisdiction: "auto",
};

describe("Authentication Providers", () => {
  describe("AWSProvider", () => {
    let provider: AWSProvider;

    beforeEach(() => {
      provider = new AWSProvider();
    });

    it("should validate correct AWS credentials", () => {
      expect(provider.validateCredentials(mockAWSCredentials)).toBe(true);
    });

    it("should reject invalid AWS credentials", () => {
      const invalidCreds = {
        accessKeyId: "",
        secretAccessKey: "",
      } as AWSCredentials;

      expect(provider.validateCredentials(invalidCreds)).toBe(false);
    });

    it("should authenticate with valid credentials", async () => {
      const result = await provider.authenticate(mockAWSCredentials);
      expect(result).toBe(true);
    });

    it("should generate proper AWS headers", async () => {
      await provider.authenticate(mockAWSCredentials);
      
      const headers = await provider.getHeaders(
        "https://test-bucket.s3.amazonaws.com/test.parquet",
        "GET"
      );

      expect(headers).toHaveProperty("Host");
      expect(headers).toHaveProperty("X-Amz-Date");
      expect(headers).toHaveProperty("Authorization");
      expect(headers["Authorization"]).toContain("AWS4-HMAC-SHA256");
    });

    it("should include session token in headers when provided", async () => {
      const credsWithToken = {
        ...mockAWSCredentials,
        sessionToken: "test-session-token",
      };

      await provider.authenticate(credsWithToken);
      
      const headers = await provider.getHeaders(
        "https://test-bucket.s3.amazonaws.com/test.parquet",
        "GET"
      );

      expect(headers).toHaveProperty("X-Amz-Security-Token", "test-session-token");
    });

    it("should create proper AWS signature", async () => {
      await provider.authenticate(mockAWSCredentials);
      
      const headers = await provider.getHeaders(
        "https://test-bucket.s3.amazonaws.com/test.parquet",
        "GET"
      );

      const authHeader = headers["Authorization"];
      expect(authHeader).toMatch(/AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/\d{8}\/us-east-1\/s3\/aws4_request/);
      expect(authHeader).toContain("SignedHeaders=");
      expect(authHeader).toContain("Signature=");
    });
  });

  describe("CloudflareProvider", () => {
    let provider: CloudflareProvider;

    beforeEach(() => {
      provider = new CloudflareProvider();
    });

    it("should validate correct CloudFlare R2 credentials", () => {
      expect(provider.validateCredentials(mockCloudflareCredentials)).toBe(true);
    });

    it("should reject invalid CloudFlare R2 credentials", () => {
      const invalidCreds = {
        accountId: "",
        accessKeyId: "",
        secretAccessKey: "",
      } as CloudflareCredentials;

      expect(provider.validateCredentials(invalidCreds)).toBe(false);
    });

    it("should authenticate with valid credentials", async () => {
      const result = await provider.authenticate(mockCloudflareCredentials);
      expect(result).toBe(true);
    });

    it("should generate correct R2 endpoint", () => {
      const provider = new CloudflareProvider(mockCloudflareCredentials);
      const endpoint = provider.getEndpoint();
      expect(endpoint).toBe("https://test-account-id.r2.cloudflarestorage.com");
    });

    it("should generate EU jurisdiction endpoint", () => {
      const euCredentials = {
        ...mockCloudflareCredentials,
        jurisdiction: "eu" as const,
      };

      const provider = new CloudflareProvider(euCredentials);
      const endpoint = provider.getEndpoint();
      expect(endpoint).toBe("https://test-account-id.r2-eu.cloudflarestorage.com");
    });

    it("should generate FedRAMP jurisdiction endpoint", () => {
      const fedrampCredentials = {
        ...mockCloudflareCredentials,
        jurisdiction: "fedramp-moderate" as const,
      };

      const provider = new CloudflareProvider(fedrampCredentials);
      const endpoint = provider.getEndpoint();
      expect(endpoint).toBe("https://test-account-id.r2-fedramp.cloudflarestorage.com");
    });

    it("should use custom domain when provided", () => {
      const customDomainCredentials = {
        ...mockCloudflareCredentials,
        customDomain: "data.example.com",
      };

      const provider = new CloudflareProvider(customDomainCredentials);
      const endpoint = provider.getEndpoint();
      expect(endpoint).toBe("https://data.example.com");
    });

    it("should generate proper R2 headers", async () => {
      await provider.authenticate(mockCloudflareCredentials);
      
      const headers = await provider.getHeaders(
        "https://test-account-id.r2.cloudflarestorage.com/bucket/test.parquet",
        "GET"
      );

      expect(headers).toHaveProperty("Host");
      expect(headers).toHaveProperty("X-Amz-Date");
      expect(headers).toHaveProperty("X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD");
      expect(headers).toHaveProperty("Authorization");
      expect(headers["Authorization"]).toContain("AWS4-HMAC-SHA256");
    });

    it("should handle worker proxy headers", async () => {
      const workerCredentials = {
        ...mockCloudflareCredentials,
        workerEndpoint: "https://data-proxy.example.workers.dev",
      };

      const provider = new CloudflareProvider(workerCredentials);
      await provider.authenticate(workerCredentials);
      
      const headers = await provider.getHeaders(
        "https://original-url.example.com/test.parquet",
        "GET"
      );

      expect(headers).toHaveProperty("Authorization", "Bearer test-r2-access-key");
      expect(headers).toHaveProperty("X-Original-URL", "https://original-url.example.com/test.parquet");
      expect(headers).toHaveProperty("X-Original-Method", "GET");
    });

    it("should select optimal endpoint based on location", async () => {
      const provider = new CloudflareProvider(mockCloudflareCredentials);
      
      // Mock European location
      const europeanLocation = {
        coords: {
          latitude: 48.8566,
          longitude: 2.3522,
          accuracy: 100,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition;

      const endpoint = await provider.selectOptimalEndpoint(europeanLocation);
      expect(endpoint).toBe("https://test-account-id.r2-eu.cloudflarestorage.com");
    });
  });

  describe("AuthenticationManager", () => {
    let authManager: AuthenticationManager;

    beforeEach(() => {
      authManager = new AuthenticationManager();
    });

    it("should register and retrieve providers", () => {
      const providers = authManager.listProviders();
      expect(providers).toContain("aws");
      expect(providers).toContain("cloudflare");
    });

    it("should set AWS credentials", async () => {
      await authManager.setCredentials("aws", mockAWSCredentials);
      expect(authManager.hasCredentials("aws")).toBe(true);
    });

    it("should set CloudFlare R2 credentials", async () => {
      await authManager.setCredentials("cloudflare", mockCloudflareCredentials);
      expect(authManager.hasCredentials("cloudflare")).toBe(true);
    });

    it("should detect provider from S3 URL", () => {
      const s3Urls = [
        "https://bucket.s3.amazonaws.com/file.parquet",
        "https://s3.amazonaws.com/bucket/file.parquet",
        "https://bucket.s3.us-west-2.amazonaws.com/file.parquet",
      ];

      s3Urls.forEach(url => {
        const provider = authManager.getProviderForUrl(url);
        expect(provider).toBe("aws");
      });
    });

    it("should detect provider from R2 URL", () => {
      const r2Urls = [
        "https://account.r2.cloudflarestorage.com/bucket/file.parquet",
        "https://account.r2-eu.cloudflarestorage.com/bucket/file.parquet",
        "https://data-proxy.example.workers.dev/file.parquet",
      ];

      r2Urls.forEach(url => {
        const provider = authManager.getProviderForUrl(url);
        expect(provider).toBe("cloudflare");
      });
    });

    it("should auto-authenticate based on URL", async () => {
      const provider = await authManager.autoAuthenticate(
        "https://bucket.s3.amazonaws.com/file.parquet",
        mockAWSCredentials
      );

      expect(provider).toBe("aws");
      expect(authManager.hasCredentials("aws")).toBe(true);
    });

    it("should get authentication headers", async () => {
      await authManager.setCredentials("aws", mockAWSCredentials);
      
      const headers = await authManager.getHeaders(
        "aws",
        "https://bucket.s3.amazonaws.com/file.parquet"
      );

      expect(headers).toHaveProperty("Authorization");
      expect(headers).toHaveProperty("X-Amz-Date");
    });

    it("should refresh credentials", async () => {
      await authManager.setCredentials("aws", mockAWSCredentials);
      const result = await authManager.refreshCredentials("aws");
      expect(result).toBe(true);
    });

    it("should test connection", async () => {
      // Mock successful fetch response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await authManager.setCredentials("aws", mockAWSCredentials);
      const result = await authManager.testConnection(
        "aws",
        "https://bucket.s3.amazonaws.com/file.parquet"
      );

      expect(result).toBe(true);
    });

    it("should handle connection test failure", async () => {
      // Mock failed fetch response
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await authManager.setCredentials("aws", mockAWSCredentials);
      const result = await authManager.testConnection(
        "aws",
        "https://bucket.s3.amazonaws.com/file.parquet"
      );

      expect(result).toBe(false);
    });

    it("should remove credentials", async () => {
      await authManager.setCredentials("aws", mockAWSCredentials);
      expect(authManager.hasCredentials("aws")).toBe(true);
      
      authManager.removeCredentials("aws");
      expect(authManager.hasCredentials("aws")).toBe(false);
    });

    it("should cleanup all credentials", () => {
      authManager.setCredentials("aws", mockAWSCredentials);
      authManager.setCredentials("cloudflare", mockCloudflareCredentials);
      
      authManager.cleanup();
      expect(authManager.hasCredentials("aws")).toBe(false);
      expect(authManager.hasCredentials("cloudflare")).toBe(false);
    });

    it("should throw error for unknown provider", async () => {
      await expect(
        authManager.setCredentials("unknown", mockAWSCredentials)
      ).rejects.toThrow("Unknown provider: unknown");
    });

    it("should throw error for invalid credentials", async () => {
      const invalidCreds = {
        accessKeyId: "",
        secretAccessKey: "",
      } as AWSCredentials;

      await expect(
        authManager.setCredentials("aws", invalidCreds)
      ).rejects.toThrow("Invalid credentials for provider: aws");
    });
  });
});