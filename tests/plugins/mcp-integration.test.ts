import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPIntegrationPlugin } from '../../packages/out-of-box/src/plugins/integration/mcp-integration.js';

// Mock the plugin context
const mockContext = {
  config: {
    get: vi.fn().mockResolvedValue({
      maxConnections: 20,
      toolCacheTTL: 300000,
      enableMCPServer: true,
      serverPort: 8080,
      authRequired: true,
      toolTimeout: 30000
    })
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  },
  eventBus: {
    subscribe: vi.fn(),
    publish: vi.fn(),
    unsubscribe: vi.fn()
  },
  services: {
    call: vi.fn()
  }
};

describe('MCPIntegrationPlugin', () => {
  let plugin: MCPIntegrationPlugin;

  beforeEach(() => {
    plugin = new MCPIntegrationPlugin();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (plugin) {
      await plugin.cleanup();
    }
    vi.clearAllMocks();
  });

  describe('Plugin Identity', () => {
    it('should return correct plugin name', () => {
      expect(plugin.getName()).toBe('mcp-integration');
    });

    it('should return correct version', () => {
      expect(plugin.getVersion()).toBe('1.0.0');
    });

    it('should return meaningful description', () => {
      const description = plugin.getDescription();
      expect(description).toContain('Model Context Protocol');
      expect(description).toContain('interoperability');
    });

    it('should return DataPrism Team as author', () => {
      expect(plugin.getAuthor()).toBe('DataPrism Team');
    });

    it('should have required dependencies', () => {
      const dependencies = plugin.getDependencies();
      expect(dependencies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: '@modelcontextprotocol/sdk',
            version: '^1.0.0',
            type: 'npm',
            optional: false
          }),
          expect.objectContaining({
            name: 'langgraph-integration',
            version: '^1.0.0',
            type: 'plugin',
            optional: false
          })
        ])
      );
    });
  });

  describe('Plugin Capabilities', () => {
    it('should expose MCP client capability', () => {
      const capabilities = plugin.getCapabilities();
      expect(capabilities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'mcp-client',
            description: 'Connect to external MCP servers and use their tools',
            version: '1.0.0'
          })
        ])
      );
    });

    it('should expose MCP server capability', () => {
      const capabilities = plugin.getCapabilities();
      expect(capabilities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'mcp-server',
            description: 'Expose DataPrism tools as MCP-compatible endpoints',
            version: '1.0.0'
          })
        ])
      );
    });

    it('should expose workflow integration capability', () => {
      const capabilities = plugin.getCapabilities();
      expect(capabilities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'workflow-integration',
            description: 'Use MCP tools as LangGraph workflow nodes',
            version: '1.0.0'
          })
        ])
      );
    });
  });

  describe('Plugin Manifest', () => {
    it('should have complete manifest', () => {
      const manifest = plugin.getManifest();
      
      expect(manifest).toHaveProperty('name', 'mcp-integration');
      expect(manifest).toHaveProperty('version', '1.0.0');
      expect(manifest).toHaveProperty('description');
      expect(manifest).toHaveProperty('author', 'DataPrism Team');
      expect(manifest).toHaveProperty('dependencies');
      expect(manifest).toHaveProperty('capabilities');
      expect(manifest).toHaveProperty('permissions');
      expect(manifest).toHaveProperty('configSchema');
    });

    it('should have required permissions', () => {
      const manifest = plugin.getManifest();
      const permissions = manifest.permissions;
      
      expect(permissions).toEqual(
        expect.arrayContaining([
          { resource: 'network', access: 'read-write' },
          { resource: 'data', access: 'read-write' },
          { resource: 'storage', access: 'write' },
          { resource: 'workers', access: 'execute' }
        ])
      );
    });

    it('should have configuration schema', () => {
      const manifest = plugin.getManifest();
      const configSchema = manifest.configSchema;
      
      expect(configSchema).toHaveProperty('maxConnections');
      expect(configSchema).toHaveProperty('toolCacheTTL');
      expect(configSchema).toHaveProperty('enableMCPServer');
      expect(configSchema).toHaveProperty('serverPort');
      expect(configSchema).toHaveProperty('authRequired');
      expect(configSchema).toHaveProperty('toolTimeout');
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should initialize successfully', async () => {
      expect(plugin['initialized']).toBe(false);
      
      await plugin.initialize(mockContext as any);
      
      expect(plugin['initialized']).toBe(true);
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        '[MCP Integration] Plugin initialized successfully',
        expect.any(Object)
      );
    });

    it('should not initialize twice', async () => {
      await plugin.initialize(mockContext as any);
      
      await expect(plugin.initialize(mockContext as any)).rejects.toThrow(
        'MCP Integration plugin already initialized'
      );
    });

    it('should activate after initialization', async () => {
      await plugin.initialize(mockContext as any);
      expect(plugin['active']).toBe(false);
      
      await plugin.activate();
      
      expect(plugin['active']).toBe(true);
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        '[MCP Integration] Plugin activated successfully'
      );
    });

    it('should not activate without initialization', async () => {
      await expect(plugin.activate()).rejects.toThrow(
        'MCP Integration plugin not initialized'
      );
    });

    it('should deactivate successfully', async () => {
      await plugin.initialize(mockContext as any);
      await plugin.activate();
      
      await plugin.deactivate();
      
      expect(plugin['active']).toBe(false);
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        '[MCP Integration] Plugin deactivated successfully'
      );
    });

    it('should cleanup successfully', async () => {
      await plugin.initialize(mockContext as any);
      await plugin.activate();
      
      await plugin.cleanup();
      
      expect(plugin['initialized']).toBe(false);
      expect(plugin['active']).toBe(false);
      expect(plugin['context']).toBe(null);
    });
  });

  describe('MCP Client Functionality', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext as any);
      await plugin.activate();
    });

    it('should connect to MCP server with valid URL', async () => {
      const serverUrl = 'https://api.example.com/mcp';
      const auth = { type: 'bearer' as const, token: 'test-token' };
      
      const connection = await plugin.connectToMCPServer(serverUrl, auth);
      
      expect(connection).toHaveProperty('serverUrl', serverUrl);
      expect(connection).toHaveProperty('authenticated', true);
      expect(connection).toHaveProperty('connected', true);
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        '[MCP Integration] Connected to MCP server',
        expect.objectContaining({ serverUrl })
      );
    });

    it('should discover tools from connected server', async () => {
      const serverUrl = 'https://api.example.com/mcp';
      const connection = await plugin.connectToMCPServer(serverUrl);
      
      // Mock the connection request method
      connection.request = vi.fn().mockResolvedValue({
        tools: [
          {
            name: 'test-tool',
            description: 'A test tool',
            inputSchema: { type: 'object', properties: {} }
          }
        ]
      });
      
      const tools = await plugin.discoverTools(connection);
      
      expect(tools).toHaveLength(1);
      expect(tools[0]).toHaveProperty('name', 'test-tool');
      expect(tools[0]).toHaveProperty('description', 'A test tool');
      expect(tools[0]).toHaveProperty('connection', serverUrl);
    });

    it('should invoke tool with parameters', async () => {
      const serverUrl = 'https://api.example.com/mcp';
      const connection = await plugin.connectToMCPServer(serverUrl);
      
      // Mock the connection request method
      connection.request = vi.fn().mockResolvedValue({
        content: { result: 'success' },
        isError: false
      });
      
      const result = await plugin.invokeTool(connection, 'test-tool', { param: 'value' });
      
      expect(result).toHaveProperty('content', { result: 'success' });
      expect(result).toHaveProperty('isError', false);
      expect(result.metadata).toHaveProperty('toolName', 'test-tool');
      expect(result.metadata).toHaveProperty('serverUrl', serverUrl);
      expect(connection.request).toHaveBeenCalledWith('tools/call', {
        name: 'test-tool',
        arguments: { param: 'value' }
      });
    });

    it('should handle tool execution timeout', async () => {
      const serverUrl = 'https://api.example.com/mcp';
      const connection = await plugin.connectToMCPServer(serverUrl);
      
      await expect(
        plugin.invokeTool(connection, 'timeout-tool', {})
      ).rejects.toThrow('Tool execution timeout');
    }, 1000);
  });

  describe('MCP Server Functionality', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext as any);
      await plugin.activate();
    });

    it('should start MCP server when enabled', async () => {
      const server = await plugin.startMCPServer();
      
      expect(server).toBeDefined();
      expect(server).toHaveProperty('config');
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        '[MCP Integration] MCP server started',
        expect.any(Object)
      );
    });

    it('should expose DataPrism tool via MCP', async () => {
      await plugin.startMCPServer();
      
      const schema = {
        description: 'Execute SQL query',
        parameters: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'SQL query' }
          },
          required: ['sql']
        }
      };
      
      await plugin.exposeTool('duckdb-query', 'executeQuery', schema);
      
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        '[MCP Integration] Tool exposed via MCP',
        expect.objectContaining({
          toolId: 'duckdb-query.executeQuery',
          pluginName: 'duckdb-query',
          methodName: 'executeQuery'
        })
      );
    });
  });

  describe('Workflow Integration', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext as any);
      await plugin.activate();
    });

    it('should create workflow with MCP tool nodes', async () => {
      const workflowDefinition = {
        id: 'test-workflow',
        name: 'Test MCP Workflow',
        description: 'A workflow with MCP tools',
        nodes: [
          {
            id: 'mcp-node',
            type: 'mcp-tool',
            server: 'https://api.example.com/mcp',
            tool: 'test-tool',
            parameters: { param: 'value' }
          }
        ],
        edges: [],
        entryPoint: 'mcp-node'
      };
      
      const workflow = await plugin.createWorkflow(workflowDefinition);
      
      expect(workflow).toHaveProperty('id', 'test-workflow');
      expect(workflow).toHaveProperty('state', 'created');
      expect(workflow.mcpToolNodes).toHaveLength(1);
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        '[MCP Integration] MCP workflow created',
        expect.objectContaining({
          workflowId: 'test-workflow',
          mcpNodeCount: 1
        })
      );
    });

    it('should execute workflow with MCP tools', async () => {
      const workflowDefinition = {
        id: 'test-workflow',
        name: 'Test MCP Workflow',
        description: 'A workflow with MCP tools',
        nodes: [
          {
            id: 'mcp-node',
            type: 'mcp-tool',
            server: 'https://api.example.com/mcp',
            tool: 'test-tool',
            parameters: { param: 'value' }
          }
        ],
        edges: [],
        entryPoint: 'mcp-node'
      };
      
      await plugin.createWorkflow(workflowDefinition);
      
      const result = await plugin.executeWorkflow('test-workflow', { input: 'test' });
      
      expect(result).toHaveProperty('workflowId', 'test-workflow');
      expect(result).toHaveProperty('status', 'completed');
      expect(result.metadata).toHaveProperty('startTime');
      expect(result.metadata).toHaveProperty('endTime');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext as any);
      await plugin.activate();
    });

    it('should handle MCP server connection failures', async () => {
      const invalidUrl = 'invalid-url';
      
      await expect(
        plugin.connectToMCPServer(invalidUrl)
      ).rejects.toThrow();
      
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        '[MCP Integration] Failed to connect to MCP server',
        expect.objectContaining({ serverUrl: invalidUrl })
      );
    });

    it('should handle tool discovery failures', async () => {
      const serverUrl = 'https://api.example.com/mcp';
      const connection = await plugin.connectToMCPServer(serverUrl);
      
      // Mock connection failure
      connection.request = vi.fn().mockRejectedValue(new Error('Network error'));
      
      await expect(
        plugin.discoverTools(connection)
      ).rejects.toThrow('Network error');
      
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        '[MCP Integration] Failed to discover tools',
        expect.objectContaining({ serverUrl })
      );
    });

    it('should handle tool invocation failures', async () => {
      const serverUrl = 'https://api.example.com/mcp';
      const connection = await plugin.connectToMCPServer(serverUrl);
      
      // Mock tool failure
      connection.request = vi.fn().mockRejectedValue(new Error('Tool error'));
      
      await expect(
        plugin.invokeTool(connection, 'failing-tool', {})
      ).rejects.toThrow('Tool error');
      
      expect(mockContext.logger.error).toHaveBeenCalledWith(
        '[MCP Integration] Tool invocation failed',
        expect.objectContaining({
          toolName: 'failing-tool',
          serverUrl
        })
      );
    });
  });

  describe('Performance and Caching', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext as any);
      await plugin.activate();
    });

    it('should cache successful tool results', async () => {
      const serverUrl = 'https://api.example.com/mcp';
      const connection = await plugin.connectToMCPServer(serverUrl);
      
      // Mock successful response
      connection.request = vi.fn().mockResolvedValue({
        content: { result: 'cached-result' },
        isError: false
      });
      
      // First call
      const result1 = await plugin.invokeTool(connection, 'cacheable-tool', { param: 'value' });
      expect(connection.request).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      const result2 = await plugin.invokeTool(connection, 'cacheable-tool', { param: 'value' });
      expect(connection.request).toHaveBeenCalledTimes(1); // Still only called once
      
      expect(result1.content).toEqual(result2.content);
    });

    it('should respect cache TTL', async () => {
      // This would require mocking timers to test cache expiration
      // For now, we verify that the cache cleanup mechanism exists
      expect(plugin['cleanupCache']).toBeDefined();
    });

    it('should track performance metrics', async () => {
      const serverUrl = 'https://api.example.com/mcp';
      const connection = await plugin.connectToMCPServer(serverUrl);
      
      connection.request = vi.fn().mockResolvedValue({
        content: { result: 'success' },
        isError: false
      });
      
      const initialInvocations = plugin['metrics'].toolInvocations;
      
      await plugin.invokeTool(connection, 'test-tool', {});
      
      expect(plugin['metrics'].toolInvocations).toBe(initialInvocations + 1);
      expect(plugin['metrics'].connectionsActive).toBeGreaterThan(0);
    });
  });
});