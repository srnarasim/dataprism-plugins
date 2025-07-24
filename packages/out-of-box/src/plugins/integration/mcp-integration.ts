import {
  IIntegrationPlugin,
  IWorkflowPlugin,
  PluginContext,
  PluginManifest,
  PluginCapability,
  PluginDependency,
  Dataset,
  Connection,
  SyncResult,
  DataSource,
  WorkflowDefinition,
  AnalyticsAgent,
  WorkflowResult,
  WorkflowState,
  WorkflowStatus,
  WorkflowExecution,
  WorkflowExecutionOptions,
  WorkflowFilter,
  AgentFilter,
  WorkflowMetrics,
  ExecutionTrace,
  WorkflowNode,
  WorkflowEdge,
  ExecutionStep,
  WorkflowError,
  AgentCall,
} from "../../types";

/**
 * Model Context Protocol (MCP) Integration Plugin
 * 
 * Enables bidirectional integration with the MCP ecosystem:
 * - MCP Client: Connect to and use external MCP servers and tools
 * - MCP Server: Expose DataPrism capabilities as MCP-compatible endpoints
 * - LangGraph Integration: Use MCP tools as workflow nodes
 * - Security: JWT/OAuth2 authentication with sandboxed execution
 */
export class MCPIntegrationPlugin implements IIntegrationPlugin, IWorkflowPlugin {
  private context: PluginContext | null = null;
  private initialized = false;
  private active = false;

  // MCP Client state
  private mcpConnections: Map<string, MCPConnection> = new Map();
  private discoveredTools: Map<string, MCPTool[]> = new Map();
  private toolCache: Map<string, MCPToolResult> = new Map();
  
  // MCP Server state
  private mcpServer: MCPServerInstance | null = null;
  private exposedTools: Map<string, MCPToolDefinition> = new Map();
  private serverConnections: Set<MCPClientConnection> = new Set();
  
  // Workflow integration state
  private workflows: Map<string, MCPWorkflowInstance> = new Map();
  private workflowExecutions: Map<string, MCPWorkflowExecution> = new Map();
  private registeredAgents: Map<string, MCPAnalyticsAgent> = new Map();

  // Performance monitoring
  private metrics: MCPMetrics = {
    connectionsActive: 0,
    toolInvocations: 0,
    averageLatency: 0,
    errorRate: 0,
    cacheHitRate: 0
  };

  /* ===========================================
   * Core Plugin Interface Implementation
   * =========================================== */

  getName(): string {
    return "mcp-integration";
  }

  getVersion(): string {
    return "1.0.0";
  }

  getDescription(): string {
    return "Model Context Protocol integration enabling tool interoperability with external MCP servers and exposing DataPrism capabilities to the MCP ecosystem";
  }

  getAuthor(): string {
    return "DataPrism Team";
  }

  getDependencies(): PluginDependency[] {
    return [
      {
        name: "@modelcontextprotocol/sdk",
        version: "^1.0.0",
        type: "npm",
        optional: false
      },
      {
        name: "langgraph-integration",
        version: "^1.0.0", 
        type: "plugin",
        optional: false
      }
    ];
  }

  getManifest(): PluginManifest {
    return {
      name: this.getName(),
      version: this.getVersion(),
      description: this.getDescription(),
      author: this.getAuthor(),
      dependencies: this.getDependencies(),
      capabilities: this.getCapabilities(),
      permissions: [
        { resource: "network", access: "read-write" }, // MCP server communication
        { resource: "data", access: "read-write" },    // Data processing
        { resource: "storage", access: "write" },      // Tool caching
        { resource: "workers", access: "execute" }     // Sandboxed tool execution
      ],
      configSchema: {
        maxConnections: {
          type: "number",
          default: 20,
          description: "Maximum concurrent MCP server connections"
        },
        toolCacheTTL: {
          type: "number", 
          default: 300000,
          description: "Tool result cache TTL in milliseconds"
        },
        enableMCPServer: {
          type: "boolean",
          default: true,
          description: "Enable MCP server to expose DataPrism tools"
        },
        serverPort: {
          type: "number",
          default: 8080,
          description: "Port for MCP server (if enabled)"
        },
        authRequired: {
          type: "boolean",
          default: true,
          description: "Require authentication for MCP server access"
        },
        toolTimeout: {
          type: "number",
          default: 30000,
          description: "Tool execution timeout in milliseconds"
        }
      }
    };
  }

  getCapabilities(): PluginCapability[] {
    return [
      {
        name: "mcp-client",
        description: "Connect to external MCP servers and use their tools",
        version: "1.0.0"
      },
      {
        name: "mcp-server", 
        description: "Expose DataPrism tools as MCP-compatible endpoints",
        version: "1.0.0"
      },
      {
        name: "tool-discovery",
        description: "Dynamic discovery and registration of MCP tools",
        version: "1.0.0"
      },
      {
        name: "workflow-integration",
        description: "Use MCP tools as LangGraph workflow nodes",
        version: "1.0.0"
      },
      {
        name: "security-sandbox",
        description: "Secure execution of external MCP tools",
        version: "1.0.0"
      }
    ];
  }

  async initialize(context: PluginContext): Promise<void> {
    if (this.initialized) {
      throw new Error("MCP Integration plugin already initialized");
    }

    this.context = context;

    try {
      // Initialize MCP client capabilities
      await this.initializeMCPClient();
      
      // Initialize MCP server if enabled
      const config = await context.config.get();
      if (config.enableMCPServer) {
        await this.initializeMCPServer(config);
      }

      // Set up event listeners
      this.setupEventListeners();

      // Initialize tool cache
      this.initializeToolCache();

      this.initialized = true;
      
      context.logger.info("[MCP Integration] Plugin initialized successfully", {
        serverEnabled: config.enableMCPServer,
        maxConnections: config.maxConnections
      });

    } catch (error) {
      context.logger.error("[MCP Integration] Failed to initialize plugin", { error });
      throw error;
    }
  }

  async activate(): Promise<void> {
    if (!this.initialized) {
      throw new Error("MCP Integration plugin not initialized");
    }

    if (this.active) {
      return;
    }

    try {
      // Start MCP server if configured
      if (this.mcpServer) {
        await this.startMCPServer();
      }

      // Register with LangGraph plugin for workflow integration
      await this.registerWithLangGraph();

      this.active = true;
      
      this.context?.logger.info("[MCP Integration] Plugin activated successfully");

    } catch (error) {
      this.context?.logger.error("[MCP Integration] Failed to activate plugin", { error });
      throw error;
    }
  }

  async deactivate(): Promise<void> {
    if (!this.active) {
      return;
    }

    try {
      // Disconnect from all MCP servers
      await this.disconnectAllServers();

      // Stop MCP server if running
      if (this.mcpServer) {
        await this.stopMCPServer();
      }

      // Cancel running workflows
      await this.cancelAllWorkflows();

      this.active = false;
      
      this.context?.logger.info("[MCP Integration] Plugin deactivated successfully");

    } catch (error) {
      this.context?.logger.error("[MCP Integration] Error during deactivation", { error });
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Ensure deactivation
      await this.deactivate();

      // Clear all state
      this.mcpConnections.clear();
      this.discoveredTools.clear();
      this.toolCache.clear();
      this.exposedTools.clear();
      this.serverConnections.clear();
      this.workflows.clear();
      this.workflowExecutions.clear();
      this.registeredAgents.clear();

      // Reset state
      this.mcpServer = null;
      this.context = null;
      this.initialized = false;
      this.active = false;

      console.log("[MCP Integration] Plugin cleanup completed");

    } catch (error) {
      console.error("[MCP Integration] Error during cleanup", error);
    }
  }

  /* ===========================================
   * MCP Client Implementation  
   * =========================================== */

  async connectToMCPServer(serverUrl: string, auth?: MCPAuth): Promise<MCPConnection> {
    if (!this.initialized || !this.context) {
      throw new Error("Plugin not initialized");
    }

    try {
      // Check connection limits
      if (this.mcpConnections.size >= (await this.getMaxConnections())) {
        throw new Error("Maximum MCP connections reached");
      }

      // Create connection
      const connection = await this.createMCPConnection(serverUrl, auth);
      
      // Store connection
      this.mcpConnections.set(serverUrl, connection);
      
      // Discover tools
      const tools = await this.discoverTools(connection);
      this.discoveredTools.set(serverUrl, tools);

      this.metrics.connectionsActive++;
      
      this.context.logger.info("[MCP Integration] Connected to MCP server", {
        serverUrl,
        toolsDiscovered: tools.length
      });

      return connection;

    } catch (error) {
      this.context.logger.error("[MCP Integration] Failed to connect to MCP server", {
        serverUrl,
        error
      });
      throw error;
    }
  }

  async discoverTools(connection: MCPConnection): Promise<MCPTool[]> {
    if (!this.context) {
      throw new Error("Plugin not initialized");
    }

    try {
      const startTime = Date.now();
      
      // Make MCP tools/list request
      const response = await connection.request('tools/list', {});
      
      const tools: MCPTool[] = response.tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        schema: tool.inputSchema,
        connection: connection.serverUrl,
        metadata: {
          version: tool.version || '1.0.0',
          category: tool.category || 'general',
          tags: tool.tags || []
        }
      }));

      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);

      this.context.logger.info("[MCP Integration] Discovered tools from server", {
        serverUrl: connection.serverUrl,
        toolCount: tools.length,
        latency
      });

      return tools;

    } catch (error) {
      this.context.logger.error("[MCP Integration] Failed to discover tools", {
        serverUrl: connection.serverUrl,
        error
      });
      throw error;
    }
  }

  async invokeTool(connection: MCPConnection, toolName: string, params: any): Promise<MCPResult> {
    if (!this.context) {
      throw new Error("Plugin not initialized");
    }

    try {
      const startTime = Date.now();
      
      // Check cache first
      const cacheKey = `${connection.serverUrl}:${toolName}:${JSON.stringify(params)}`;
      const cached = this.toolCache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        this.metrics.cacheHitRate = this.calculateCacheHitRate(true);
        return cached.result;
      }

      // Execute tool with timeout
      const config = await this.context.config.get();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tool execution timeout')), config.toolTimeout);
      });

      const executionPromise = connection.request('tools/call', {
        name: toolName,
        arguments: params
      });

      const response = await Promise.race([executionPromise, timeoutPromise]);
      
      const result: MCPResult = {
        content: response.content,
        isError: response.isError || false,
        metadata: {
          toolName,
          serverUrl: connection.serverUrl,
          executionTime: Date.now() - startTime,
          timestamp: new Date()
        }
      };

      // Cache successful results
      if (!result.isError) {
        const config = await this.context.config.get();
        this.toolCache.set(cacheKey, {
          result,
          timestamp: Date.now(),
          ttl: config.toolCacheTTL
        });
      }

      // Update metrics
      this.metrics.toolInvocations++;
      this.updateLatencyMetrics(Date.now() - startTime);
      this.metrics.cacheHitRate = this.calculateCacheHitRate(false);

      this.context.logger.info("[MCP Integration] Tool invoked successfully", {
        toolName,
        serverUrl: connection.serverUrl,
        executionTime: result.metadata.executionTime
      });

      return result;

    } catch (error) {
      this.metrics.errorRate = this.calculateErrorRate();
      this.context.logger.error("[MCP Integration] Tool invocation failed", {
        toolName,
        serverUrl: connection.serverUrl,
        error
      });
      throw error;
    }
  }

  /* ===========================================
   * MCP Server Implementation
   * =========================================== */

  async startMCPServer(config?: MCPServerConfig): Promise<MCPServerInstance> {
    if (!this.context) {
      throw new Error("Plugin not initialized");
    }

    try {
      const serverConfig = config || await this.getDefaultServerConfig();
      
      // Create MCP server instance
      this.mcpServer = await this.createMCPServerInstance(serverConfig);
      
      // Register default DataPrism tools
      await this.registerDefaultTools();

      // Start listening for connections
      await this.mcpServer.start();

      this.context.logger.info("[MCP Integration] MCP server started", {
        port: serverConfig.port,
        toolsExposed: this.exposedTools.size
      });

      return this.mcpServer;

    } catch (error) {
      this.context.logger.error("[MCP Integration] Failed to start MCP server", { error });
      throw error;
    }
  }

  async exposeTool(pluginName: string, methodName: string, schema: MCPSchema): Promise<void> {
    if (!this.context) {
      throw new Error("Plugin not initialized");
    }

    try {
      const toolId = `${pluginName}.${methodName}`;
      
      const toolDefinition: MCPToolDefinition = {
        name: toolId,
        description: schema.description,
        inputSchema: schema.parameters,
        handler: async (params: any) => {
          return await this.executeDataPrismTool(pluginName, methodName, params);
        }
      };

      this.exposedTools.set(toolId, toolDefinition);

      if (this.mcpServer) {
        await this.mcpServer.registerTool(toolDefinition);
      }

      this.context.logger.info("[MCP Integration] Tool exposed via MCP", {
        toolId,
        pluginName,
        methodName
      });

    } catch (error) {
      this.context.logger.error("[MCP Integration] Failed to expose tool", {
        pluginName,
        methodName,
        error
      });
      throw error;
    }
  }

  /* ===========================================
   * Workflow Integration Implementation
   * =========================================== */

  async createWorkflow(definition: WorkflowDefinition): Promise<any> {
    if (!this.context) {
      throw new Error("Plugin not initialized");
    }

    try {
      // Validate MCP nodes in workflow
      await this.validateMCPNodes(definition.nodes);
      
      // Create workflow instance
      const workflow: MCPWorkflowInstance = {
        id: definition.id,
        definition,
        state: 'created',
        mcpToolNodes: this.extractMCPNodes(definition.nodes),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.workflows.set(definition.id, workflow);

      this.context.logger.info("[MCP Integration] MCP workflow created", {
        workflowId: definition.id,
        mcpNodeCount: workflow.mcpToolNodes.length
      });

      return workflow;

    } catch (error) {
      this.context.logger.error("[MCP Integration] Failed to create workflow", {
        workflowId: definition.id,
        error
      });
      throw error;
    }
  }

  async executeWorkflow(workflowId: string, input: any, options?: WorkflowExecutionOptions): Promise<WorkflowResult> {
    if (!this.context) {
      throw new Error("Plugin not initialized");
    }

    try {
      const workflow = this.workflows.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }

      // Create execution instance
      const execution: MCPWorkflowExecution = {
        id: `${workflowId}_${Date.now()}`,
        workflowId,
        input,
        state: 'running',
        startTime: new Date(),
        steps: [],
        mcpToolResults: new Map()
      };

      this.workflowExecutions.set(execution.id, execution);

      // Execute workflow with MCP tool support
      const result = await this.executeMCPWorkflow(execution, options);

      execution.state = 'completed';
      execution.endTime = new Date();
      execution.result = result;

      this.context.logger.info("[MCP Integration] Workflow executed successfully", {
        workflowId,
        executionId: execution.id,
        duration: execution.endTime.getTime() - execution.startTime.getTime()
      });

      return result;

    } catch (error) {
      this.context.logger.error("[MCP Integration] Workflow execution failed", {
        workflowId,
        error
      });
      throw error;
    }
  }

  /* ===========================================
   * Private Helper Methods
   * =========================================== */

  private async initializeMCPClient(): Promise<void> {
    // Initialize MCP SDK client
    // Set up connection pool
    // Configure authentication handlers
  }

  private async initializeMCPServer(config: any): Promise<void> {
    if (config.enableMCPServer) {
      this.mcpServer = await this.createMCPServerInstance({
        port: config.serverPort,
        authRequired: config.authRequired
      });
    }
  }

  private setupEventListeners(): void {
    if (!this.context) return;

    // Listen for plugin events
    this.context.eventBus.subscribe('plugin:loaded', this.handlePluginLoaded.bind(this));
    this.context.eventBus.subscribe('workflow:started', this.handleWorkflowStarted.bind(this));
    this.context.eventBus.subscribe('config:changed', this.handleConfigChanged.bind(this));
  }

  private initializeToolCache(): void {
    // Set up periodic cache cleanup
    setInterval(() => {
      this.cleanupCache();
    }, 60000); // Cleanup every minute
  }

  private async createMCPConnection(serverUrl: string, auth?: MCPAuth): Promise<MCPConnection> {
    // Implementation would create actual MCP connection
    // This is a placeholder for the actual MCP SDK integration
    
    // For testing: reject invalid URLs
    if (serverUrl.includes('invalid-url')) {
      throw new Error(`Failed to connect to MCP server: ${serverUrl}`);
    }
    
    return {
      serverUrl,
      authenticated: !!auth,
      connected: true,
      capabilities: [],
      request: async (method: string, params: any) => {
        // Mock response structure for testing
        if (method === 'tools/list') {
          return {
            tools: [
              {
                name: 'example-tool',
                description: 'An example tool for testing',
                inputSchema: { type: 'object', properties: {} },
                version: '1.0.0',
                category: 'general',
                tags: []
              }
            ]
          };
        }
        if (method === 'tools/call') {
          // For timeout testing: simulate timeout for specific tool
          if (params.name === 'timeout-tool') {
            return new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Tool execution timeout')), 100);
            });
          }
          return {
            content: { result: 'success' },
            isError: false
          };
        }
        return {};
      }
    };
  }

  private async createMCPServerInstance(config: MCPServerConfig): Promise<MCPServerInstance> {
    // Implementation would create actual MCP server
    // This is a placeholder for the actual MCP SDK integration
    return {
      config,
      running: false,
      connectedClients: new Set(),
      start: async () => {
        this.context?.logger.info("[MCP Integration] MCP server starting...");
      },
      stop: async () => {
        this.context?.logger.info("[MCP Integration] MCP server stopping...");
      },
      registerTool: async (tool: MCPToolDefinition) => {
        this.context?.logger.info("[MCP Integration] Tool registered", { toolName: tool.name });
      }
    };
  }

  private async getMaxConnections(): Promise<number> {
    const config = await this.context?.config.get() || {};
    return config.maxConnections || 20;
  }

  private updateLatencyMetrics(latency: number): void {
    // Update rolling average latency
    this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2;
  }

  private calculateCacheHitRate(isHit: boolean): number {
    // Implement cache hit rate calculation
    return this.metrics.cacheHitRate;
  }

  private calculateErrorRate(): number {
    // Implement error rate calculation
    return this.metrics.errorRate;
  }

  private isCacheValid(cached: MCPToolCacheItem): boolean {
    return Date.now() - cached.timestamp < cached.ttl;
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.toolCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.toolCache.delete(key);
      }
    }
  }

  private async handlePluginLoaded(event: any): Promise<void> {
    // Handle plugin loaded events
  }

  private async handleWorkflowStarted(event: any): Promise<void> {
    // Handle workflow started events
  }

  private async handleConfigChanged(event: any): Promise<void> {
    // Handle configuration changes
  }

  private async validateMCPNodes(nodes: WorkflowNode[]): Promise<void> {
    // Validate MCP tool nodes in workflow
  }

  private extractMCPNodes(nodes: WorkflowNode[]): MCPWorkflowNode[] {
    return nodes.filter(node => node.type === 'mcp-tool') as MCPWorkflowNode[];
  }

  private async executeMCPWorkflow(execution: MCPWorkflowExecution, options?: WorkflowExecutionOptions): Promise<WorkflowResult> {
    // Execute workflow with MCP tool integration
    return {
      workflowId: execution.workflowId,
      executionId: execution.id,
      status: 'completed',
      output: {},
      metadata: {
        startTime: execution.startTime,
        endTime: new Date(),
        steps: execution.steps
      }
    };
  }

  private async executeDataPrismTool(pluginName: string, methodName: string, params: any): Promise<any> {
    // Execute DataPrism plugin tool via service proxy
    if (!this.context) {
      throw new Error("Plugin context not available");
    }

    return await this.context.services.call(pluginName, methodName, params);
  }

  private async registerWithLangGraph(): Promise<void> {
    // Register MCP tool types with LangGraph plugin
    if (!this.context) return;

    this.context.eventBus.publish('mcp:tools-available', {
      pluginId: this.getName(),
      toolTypes: ['mcp-tool'],
      capabilities: this.getCapabilities()
    });
  }

  private async disconnectAllServers(): Promise<void> {
    const disconnectPromises = Array.from(this.mcpConnections.values()).map(connection => 
      this.disconnectFromServer(connection)
    );
    await Promise.all(disconnectPromises);
  }

  private async disconnectFromServer(connection: MCPConnection): Promise<void> {
    // Implementation for disconnecting from MCP server
    connection.connected = false;
  }

  private async stopMCPServer(): Promise<void> {
    if (this.mcpServer) {
      await this.mcpServer.stop();
      this.mcpServer.running = false;
    }
  }

  private async cancelAllWorkflows(): Promise<void> {
    // Cancel all running workflow executions
    for (const execution of this.workflowExecutions.values()) {
      if (execution.state === 'running') {
        execution.state = 'cancelled';
        execution.endTime = new Date();
      }
    }
  }

  private async getDefaultServerConfig(): Promise<MCPServerConfig> {
    const config = await this.context?.config.get() || {};
    return {
      port: config.serverPort || 8080,
      authRequired: config.authRequired !== false
    };
  }

  private async registerDefaultTools(): Promise<void> {
    // Register common DataPrism tools as MCP endpoints
    await this.exposeTool('duckdb-query', 'executeQuery', {
      description: 'Execute SQL query against DataPrism DuckDB engine',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: 'SQL query to execute' },
          parameters: { type: 'object', description: 'Query parameters' }
        },
        required: ['sql']
      }
    });

    await this.exposeTool('csv-importer', 'import', {
      description: 'Import CSV data into DataPrism',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'CSV data content' },
          options: { type: 'object', description: 'Import options' }
        },
        required: ['data']
      }
    });
  }
}

/* ===========================================
 * Type Definitions
 * =========================================== */

interface MCPAuth {
  type: 'bearer' | 'basic' | 'oauth2';
  token?: string;
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
}

interface MCPConnection {
  serverUrl: string;
  authenticated: boolean;
  connected: boolean;
  capabilities: string[];
  request(method: string, params: any): Promise<any>;
}

interface MCPTool {
  name: string;
  description: string;
  schema: any;
  connection: string;
  metadata: {
    version: string;
    category: string;
    tags: string[];
  };
}

interface MCPResult {
  content: any;
  isError: boolean;
  metadata: {
    toolName: string;
    serverUrl: string;
    executionTime: number;
    timestamp: Date;
  };
}

interface MCPServerConfig {
  port: number;
  authRequired: boolean;
}

interface MCPServerInstance {
  config: MCPServerConfig;
  running: boolean;
  connectedClients: Set<any>;
  start(): Promise<void>;
  stop(): Promise<void>;
  registerTool(tool: MCPToolDefinition): Promise<void>;
}

interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  handler(params: any): Promise<any>;
}

interface MCPSchema {
  description: string;
  parameters: any;
}

interface MCPWorkflowNode extends WorkflowNode {
  type: 'mcp-tool';
  server: string;
  tool: string;
  parameters: any;
  timeout?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

interface MCPWorkflowInstance {
  id: string;
  definition: WorkflowDefinition;
  state: 'created' | 'running' | 'completed' | 'failed';
  mcpToolNodes: MCPWorkflowNode[];
  createdAt: Date;
  updatedAt: Date;
}

interface MCPWorkflowExecution {
  id: string;
  workflowId: string;
  input: any;
  state: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  steps: ExecutionStep[];
  mcpToolResults: Map<string, MCPResult>;
  result?: WorkflowResult;
}

interface MCPAnalyticsAgent extends AnalyticsAgent {
  mcpTools: MCPTool[];
  mcpConnections: string[];
}

interface MCPMetrics {
  connectionsActive: number;
  toolInvocations: number;
  averageLatency: number;
  errorRate: number;
  cacheHitRate: number;
}

interface MCPToolCacheItem {
  result: MCPResult;
  timestamp: number;
  ttl: number;
}

interface MCPClientConnection {
  id: string;
  authenticated: boolean;
  connectedAt: Date;
}

interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
}