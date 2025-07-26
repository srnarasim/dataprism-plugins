import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ParquetHttpfsPlugin } from "../../../src/plugins/integration/parquet-httpfs/ParquetHttpfsPlugin.js";
import type { PluginContext } from "../../../src/types/index.js";
import type { 
  AWSCredentials, 
  CloudflareCredentials, 
  LoadOptions 
} from "../../../src/plugins/integration/parquet-httpfs/types/interfaces.js";

// Mock data
const mockContext: PluginContext = {
  pluginName: "ParquetHttpfsPlugin",
  coreVersion: "1.0.0",
  services: {
    call: vi.fn(),
    hasPermission: vi.fn().mockReturnValue(true),
  },
  eventBus: {
    publish: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    once: vi.fn(),
  },
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  config: {},
  resources: {
    maxMemoryMB: 2000,
    maxCpuPercent: 80,
    maxExecutionTime: 30000,
  },
};

const mockAWSCredentials: AWSCredentials = {
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
  region: "us-east-1",
};

const mockCloudflareCredentials: CloudflareCredentials = {
  accountId: "test-account-id",
  accessKeyId: "test-r2-key",
  secretAccessKey: "test-r2-secret",
  jurisdiction: "auto",
};

// Mock DuckDB connection
const mockDuckDBConnection = {
  query: vi.fn().mockResolvedValue({
    data: [["test-data"]],
    columns: ["test_column"],
  }),
};

describe("ParquetHttpfsPlugin", () => {
  let plugin: ParquetHttpfsPlugin;

  beforeEach(() => {
    plugin = new ParquetHttpfsPlugin();
    vi.clearAllMocks();
    
    // Mock the DuckDB service call
    (mockContext.services.call as any).mockImplementation((service: string, method: string, ...args: any[]) => {
      if (service === "duckdb" && method === "getConnection") {
        return Promise.resolve(mockDuckDBConnection);
      }
      if (service === "duckdb" && method === "query") {
        return Promise.resolve({
          data: [["test-data"]],
          columns: ["test_column"],
        });
      }
      return Promise.resolve(null);
    });
  });

  afterEach(async () => {
    await plugin.cleanup();
  });

  describe("Plugin Identity", () => {
    it("should return correct plugin name", () => {
      expect(plugin.getName()).toBe("ParquetHttpfsPlugin");
    });

    it("should return correct version", () => {
      expect(plugin.getVersion()).toBe("1.0.0");
    });

    it("should return description", () => {
      const description = plugin.getDescription();
      expect(description).toContain("Parquet");
      expect(description).toContain("S3");
      expect(description).toContain("CloudFlare R2");
    });

    it("should return author", () => {
      expect(plugin.getAuthor()).toBe("DataPrism Team");
    });

    it("should return dependencies", () => {
      const deps = plugin.getDependencies();
      expect(deps).toHaveLength(1);
      expect(deps[0].name).toBe("duckdb-wasm");
    });
  });

  describe("Plugin Lifecycle", () => {
    it("should initialize successfully", async () => {
      await plugin.initialize(mockContext);
      expect(mockContext.services.call).toHaveBeenCalledWith("duckdb", "getConnection");
      expect(mockContext.logger.info).toHaveBeenCalledWith("ParquetHttpfsPlugin initialized successfully");
    });

    it("should activate successfully", async () => {
      await plugin.initialize(mockContext);
      await plugin.activate();
      expect(mockContext.logger.info).toHaveBeenCalledWith("ParquetHttpfsPlugin activated");
    });

    it("should deactivate successfully", async () => {
      await plugin.initialize(mockContext);
      await plugin.deactivate();
      expect(mockContext.logger.info).toHaveBeenCalledWith("ParquetHttpfsPlugin deactivated");
    });

    it("should cleanup successfully", async () => {
      await plugin.initialize(mockContext);
      await plugin.cleanup();
      expect(mockContext.logger.info).toHaveBeenCalledWith("ParquetHttpfsPlugin cleaned up");
    });
  });

  describe("Plugin Manifest and Capabilities", () => {
    it("should return valid manifest", () => {
      const manifest = plugin.getManifest();
      expect(manifest.name).toBe("ParquetHttpfsPlugin");
      expect(manifest.version).toBe("1.0.0");
      expect(manifest.category).toBe("integration");
      expect(manifest.keywords).toContain("parquet");
      expect(manifest.keywords).toContain("s3");
      expect(manifest.keywords).toContain("cloudflare");
    });

    it("should return capabilities", () => {
      const capabilities = plugin.getCapabilities();
      expect(capabilities).toHaveLength(2);
      expect(capabilities[0].name).toBe("parquet-import");
      expect(capabilities[1].name).toBe("schema-introspection");
    });

    it("should check compatibility", () => {
      expect(plugin.isCompatible("1.0.0")).toBe(true);
      expect(plugin.isCompatible("0.9.0")).toBe(false);
    });
  });

  describe("Configuration", () => {
    it("should configure successfully", async () => {
      await plugin.initialize(mockContext);
      await plugin.configure({
        defaultTimeout: 45000,
        maxConcurrentConnections: 8,
      });
      expect(mockContext.logger.info).toHaveBeenCalledWith("ParquetHttpfsPlugin configuration updated");
    });
  });

  describe("Integration Plugin Interface", () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    it("should connect successfully", async () => {
      const connection = await plugin.connect("https://test-bucket.s3.amazonaws.com");
      expect(connection.endpoint).toBe("https://test-bucket.s3.amazonaws.com");
      expect(connection.status).toBe("connected");
    });

    it("should test connection", async () => {
      const result = await plugin.testConnection();
      expect(result.success).toBe(true);
      expect(result.latency).toBeGreaterThan(0);
    });

    it("should get integration capabilities", () => {
      const capabilities = plugin.getIntegrationCapabilities();
      expect(capabilities).toHaveLength(1);
      expect(capabilities[0].name).toBe("parquet-streaming");
      expect(capabilities[0].formats).toContain("parquet");
    });

    it("should get supported protocols", () => {
      const protocols = plugin.getSupportedProtocols();
      expect(protocols).toHaveLength(1);
      expect(protocols[0].name).toBe("https");
    });

    it("should get supported formats", () => {
      const formats = plugin.getSupportedFormats();
      expect(formats).toEqual(["parquet"]);
    });
  });

  describe("Parquet Operations", () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    it("should validate file successfully", async () => {
      // Mock successful HEAD request
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([
          ["content-length", "1024000"],
          ["content-type", "application/octet-stream"],
        ]),
      } as any);

      const result = await plugin.validateFile("https://test-bucket.s3.amazonaws.com/test.parquet");
      expect(result.isValid).toBe(true);
      expect(result.metadata.fileSize).toBe(1024000);
    });

    it("should handle invalid file URL", async () => {
      await expect(plugin.validateFile("invalid-url")).rejects.toThrow();
    });

    it("should handle non-parquet file", async () => {
      await expect(plugin.validateFile("https://test.com/file.csv")).rejects.toThrow();
    });

    it("should load file with AWS credentials", async () => {
      // Mock successful responses
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([
          ["content-length", "1024000"],
          ["content-type", "application/octet-stream"],
        ]),
      } as any);

      const loadOptions: LoadOptions = {
        authentication: {
          provider: "aws",
          credentials: mockAWSCredentials,
        },
        alias: "test_table",
      };

      const tableRef = await plugin.loadFile("https://test-bucket.s3.amazonaws.com/test.parquet", loadOptions);
      
      expect(tableRef.alias).toBe("test_table");
      expect(tableRef.url).toBe("https://test-bucket.s3.amazonaws.com/test.parquet");
      expect(tableRef.provider).toBe("aws");
    });

    it("should load file with CloudFlare R2 credentials", async () => {
      // Mock successful responses
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([
          ["content-length", "2048000"],
          ["content-type", "application/octet-stream"],
        ]),
      } as any);

      const loadOptions: LoadOptions = {
        authentication: {
          provider: "cloudflare",
          credentials: mockCloudflareCredentials,
        },
        alias: "r2_table",
      };

      const tableRef = await plugin.loadFile("https://account.r2.cloudflarestorage.com/bucket/test.parquet", loadOptions);
      
      expect(tableRef.alias).toBe("r2_table");
      expect(tableRef.provider).toBe("cloudflare");
    });

    it("should load multiple files", async () => {
      // Mock successful responses
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([
          ["content-length", "1024000"],
          ["content-type", "application/octet-stream"],
        ]),
      } as any);

      const urls = [
        "https://test-bucket.s3.amazonaws.com/file1.parquet",
        "https://test-bucket.s3.amazonaws.com/file2.parquet",
      ];

      const loadOptions: LoadOptions = {
        authentication: {
          provider: "aws",
          credentials: mockAWSCredentials,
        },
        alias: "multi_table",
      };

      const tableRefs = await plugin.loadMultipleFiles(urls, loadOptions);
      
      expect(tableRefs).toHaveLength(2);
      expect(tableRefs[0].alias).toBe("multi_table_0");
      expect(tableRefs[1].alias).toBe("multi_table_1");
    });

    it("should execute query", async () => {
      // Load a file first
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([
          ["content-length", "1024000"],
        ]),
      } as any);

      const tableRef = await plugin.loadFile("https://test-bucket.s3.amazonaws.com/test.parquet", {
        alias: "test_table",
      });

      const result = await plugin.query("SELECT * FROM test_table LIMIT 10", [tableRef]);
      
      expect(result.data).toEqual([["test-data"]]);
      expect(result.columns).toEqual(["test_column"]);
      expect(result.rowCount).toBe(1);
    });

    it("should explain query", async () => {
      const queryPlan = await plugin.explainQuery("SELECT * FROM test_table");
      
      expect(queryPlan.sql).toBe("SELECT * FROM test_table");
      expect(queryPlan.estimated_cost).toBeGreaterThan(0);
      expect(queryPlan.operations).toBeDefined();
    });
  });

  describe("Authentication", () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    it("should set AWS credentials", () => {
      expect(() => plugin.setCredentials("aws", mockAWSCredentials)).not.toThrow();
    });

    it("should set CloudFlare R2 credentials", () => {
      expect(() => plugin.setCredentials("cloudflare", mockCloudflareCredentials)).not.toThrow();
    });

    it("should refresh credentials", async () => {
      plugin.setCredentials("aws", mockAWSCredentials);
      await expect(plugin.refreshCredentials("aws")).resolves.not.toThrow();
    });
  });

  describe("Progress Reporting", () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    it("should report progress during file loading", async () => {
      const progressCallback = vi.fn();
      plugin.onProgress(progressCallback);

      // Mock successful responses
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([
          ["content-length", "1024000"],
        ]),
      } as any);

      await plugin.loadFile("https://test-bucket.s3.amazonaws.com/test.parquet", {
        alias: "progress_test",
      });

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          alias: "progress_test",
          phase: "connecting",
          percentComplete: 0,
        })
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          alias: "progress_test",
          phase: "complete",
          percentComplete: 100,
        })
      );
    });

    it("should track loading status", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([
          ["content-length", "1024000"],
        ]),
      } as any);

      await plugin.loadFile("https://test-bucket.s3.amazonaws.com/test.parquet", {
        alias: "status_test",
      });

      const statuses = plugin.getLoadingStatus();
      expect(statuses).toHaveLength(1);
      expect(statuses[0].alias).toBe("status_test");
      expect(statuses[0].status).toBe("completed");
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    it("should handle network errors gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(
        plugin.loadFile("https://test-bucket.s3.amazonaws.com/test.parquet")
      ).rejects.toThrow("Failed to load file");
    });

    it("should handle authentication errors", async () => {
      const invalidCredentials = {
        accessKeyId: "",
        secretAccessKey: "",
      } as AWSCredentials;

      await expect(
        plugin.loadFile("https://test-bucket.s3.amazonaws.com/test.parquet", {
          authentication: {
            provider: "aws",
            credentials: invalidCredentials,
          },
        })
      ).rejects.toThrow();
    });

    it("should handle DuckDB errors", async () => {
      // Mock DuckDB error
      (mockContext.services.call as any).mockRejectedValue(new Error("DuckDB error"));

      await expect(
        plugin.query("INVALID SQL", [])
      ).rejects.toThrow("Query execution failed");
    });
  });

  describe("Execute Method", () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });

    it("should execute loadFile operation", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([["content-length", "1024000"]]),
      } as any);

      const result = await plugin.execute("loadFile", {
        url: "https://test-bucket.s3.amazonaws.com/test.parquet",
        options: { alias: "exec_test" },
      });

      expect(result.alias).toBe("exec_test");
    });

    it("should execute validateFile operation", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([["content-length", "1024000"]]),
      } as any);

      const result = await plugin.execute("validateFile", {
        url: "https://test-bucket.s3.amazonaws.com/test.parquet",
      });

      expect(result.isValid).toBe(true);
    });

    it("should throw error for unknown operation", async () => {
      await expect(
        plugin.execute("unknownOperation", {})
      ).rejects.toThrow("Unknown operation: unknownOperation");
    });
  });
});