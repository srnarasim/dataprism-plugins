import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LangGraphIntegrationPlugin } from '../../packages/out-of-box/src/plugins/integration/langgraph-integration.js';
import type { 
  PluginContext, 
  WorkflowDefinition, 
  AnalyticsAgent,
  Dataset 
} from '../../packages/src/interfaces/index.js';

describe('LangGraphIntegrationPlugin', () => {
  let plugin: LangGraphIntegrationPlugin;
  let mockContext: PluginContext;

  beforeEach(() => {
    plugin = new LangGraphIntegrationPlugin();
    
    // Create mock context
    mockContext = {
      pluginName: 'langgraph-integration',
      coreVersion: '1.0.0',
      services: {
        call: vi.fn(),
        hasPermission: vi.fn().mockReturnValue(true),
      },
      eventBus: {
        publish: vi.fn(),
        subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
        unsubscribe: vi.fn(),
        once: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      },
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      config: {
        defaultLLMProvider: 'openai',
        maxConcurrentWorkflows: 10,
        workflowTimeout: 300000,
        enableDebugMode: false,
      },
      resources: {
        maxMemoryMB: 512,
        maxCpuPercent: 80,
        maxExecutionTime: 300000,
        maxNetworkRequests: 1000,
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Plugin Identity', () => {
    it('should return correct plugin name', () => {
      expect(plugin.getName()).toBe('langgraph-integration');
    });

    it('should return correct version', () => {
      expect(plugin.getVersion()).toBe('1.0.0');
    });

    it('should return correct description', () => {
      const description = plugin.getDescription();
      expect(description).toContain('Graph-based agentic analytics workflows');
      expect(description).toContain('LangGraph');
    });

    it('should return correct author', () => {
      expect(plugin.getAuthor()).toBe('DataPrism Team');
    });

    it('should return required dependencies', () => {
      const deps = plugin.getDependencies();
      expect(deps).toEqual([
        { name: '@langchain/core', version: '^0.1.0', optional: false },
        { name: '@langchain/langgraph', version: '^0.1.0', optional: false },
      ]);
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should initialize successfully', async () => {
      await expect(plugin.initialize(mockContext)).resolves.not.toThrow();
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Initializing LangGraph Integration Plugin'
      );
    });

    it('should activate after initialization', async () => {
      await plugin.initialize(mockContext);
      await expect(plugin.activate()).resolves.not.toThrow();
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'LangGraph Integration Plugin activated'
      );
    });

    it('should fail to activate without initialization', async () => {
      await expect(plugin.activate()).rejects.toThrow(
        'Plugin must be initialized before activation'
      );
    });

    it('should deactivate successfully', async () => {
      await plugin.initialize(mockContext);
      await plugin.activate();
      await expect(plugin.deactivate()).resolves.not.toThrow();
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'LangGraph Integration Plugin deactivated'
      );
    });

    it('should cleanup successfully', async () => {
      await plugin.initialize(mockContext);
      
      // Clear previous log calls to focus on cleanup
      mockContext.logger.info.mockClear();
      
      await expect(plugin.cleanup()).resolves.not.toThrow();
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'LangGraph Integration Plugin cleaned up'
      );
    });
  });

  describe('Plugin Capabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = plugin.getCapabilities();
      expect(capabilities).toHaveLength(4);
      
      const capabilityNames = capabilities.map(cap => cap.name);
      expect(capabilityNames).toContain('workflow-orchestration');
      expect(capabilityNames).toContain('agent-coordination');
      expect(capabilityNames).toContain('llm-integration');
      expect(capabilityNames).toContain('state-management');
    });

    it('should be compatible with core version 1.0.0', () => {
      expect(plugin.isCompatible('1.0.0')).toBe(true);
    });

    it('should not be compatible with lower core versions', () => {
      expect(plugin.isCompatible('0.9.0')).toBe(false);
    });

    it('should return correct manifest', () => {
      const manifest = plugin.getManifest();
      expect(manifest.name).toBe('langgraph-integration');
      expect(manifest.category).toBe('integration');
      expect(manifest.permissions).toBeDefined();
      expect(manifest.configuration).toBeDefined();
    });
  });

  describe('Agent Management', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
      await plugin.activate();
    });

    it('should register an agent successfully', async () => {
      const agent: AnalyticsAgent = {
        id: 'test-agent-1',
        name: 'Test Agent',
        description: 'Test agent for unit tests',
        specialization: 'data-validation',
        capabilities: { dataTyping: true },
        llmProvider: 'openai',
        model: 'gpt-4',
        systemPrompt: 'You are a test agent.',
        tools: [],
        configuration: {},
        metadata: {
          createdAt: new Date().toISOString(),
          version: '1.0.0',
          author: 'Test',
          category: 'test',
        },
      };

      const agentId = await plugin.registerAgent(agent);
      expect(agentId).toBe('test-agent-1');
      expect(mockContext.eventBus.publish).toHaveBeenCalledWith(
        'plugin:langgraph-integration:agent:registered',
        { agentId: 'test-agent-1', agent }
      );
    });

    it('should retrieve a registered agent', async () => {
      const agent: AnalyticsAgent = {
        id: 'test-agent-2',
        name: 'Test Agent 2',
        description: 'Another test agent',
        specialization: 'data-discovery',
        capabilities: { schemaInference: true },
        llmProvider: 'openai',
        model: 'gpt-3.5-turbo',
        systemPrompt: 'You are a test agent.',
        tools: [],
        configuration: {},
        metadata: {
          createdAt: new Date().toISOString(),
          version: '1.0.0',
          author: 'Test',
          category: 'test',
        },
      };

      await plugin.registerAgent(agent);
      const retrievedAgent = await plugin.getAgent('test-agent-2');
      expect(retrievedAgent).toEqual(agent);
    });

    it('should list agents with filtering', async () => {
      const agent1: AnalyticsAgent = {
        id: 'agent-1',
        name: 'Agent 1',
        description: 'First agent',
        specialization: 'data-discovery',
        capabilities: {},
        llmProvider: 'openai',
        model: 'gpt-4',
        systemPrompt: 'Agent 1',
        tools: [],
        configuration: {},
        metadata: {
          createdAt: new Date().toISOString(),
          version: '1.0.0',
          author: 'Test',
          tags: ['test', 'discovery'],
        },
      };

      const agent2: AnalyticsAgent = {
        id: 'agent-2',
        name: 'Agent 2',
        description: 'Second agent',
        specialization: 'statistical-analysis',
        capabilities: {},
        llmProvider: 'anthropic',
        model: 'claude-3',
        systemPrompt: 'Agent 2',
        tools: [],
        configuration: {},
        metadata: {
          createdAt: new Date().toISOString(),
          version: '1.0.0',
          author: 'Test',
          tags: ['test', 'stats'],
        },
      };

      await plugin.registerAgent(agent1);
      await plugin.registerAgent(agent2);

      // Test filtering by specialization
      const discoveryAgents = await plugin.listAgents({ 
        specialization: 'data-discovery' 
      });
      expect(discoveryAgents).toHaveLength(2); // Includes built-in data-discovery-agent

      // Test filtering by provider
      const openaiAgents = await plugin.listAgents({ 
        provider: 'openai' 
      });
      expect(openaiAgents.length).toBeGreaterThanOrEqual(1);
    });

    it('should throw error when getting non-existent agent', async () => {
      await expect(plugin.getAgent('non-existent')).rejects.toThrow(
        'Agent not found: non-existent'
      );
    });
  });

  describe('Workflow Management', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
      await plugin.activate();
    });

    it('should create a workflow successfully', async () => {
      const workflowDef: WorkflowDefinition = {
        id: 'test-workflow',
        name: 'Test Workflow',
        description: 'A test workflow',
        version: '1.0.0',
        nodes: [
          {
            id: 'start',
            type: 'agent',
            name: 'Start Node',
            agentId: 'data-discovery-agent',
            configuration: {},
            inputSchema: {},
            outputSchema: {},
          },
        ],
        edges: [],
        entryPoint: 'start',
      };

      const result = await plugin.createWorkflow(workflowDef);
      expect(result.workflowId).toBe('test-workflow');
      expect(result.status).toBe('created');
      expect(mockContext.eventBus.publish).toHaveBeenCalledWith(
        'plugin:langgraph-integration:workflow:created',
        { workflowId: 'test-workflow', definition: workflowDef }
      );
    });

    it('should execute a simple workflow', async () => {
      // Mock LLM completion response
      mockContext.services.call = vi.fn().mockResolvedValue({
        text: 'Analysis complete',
        model: 'gpt-4',
        usage: { prompt: 100, completion: 50, total: 150 },
      });

      const workflowDef: WorkflowDefinition = {
        id: 'exec-test-workflow',
        name: 'Execution Test Workflow',
        description: 'A workflow for testing execution',
        version: '1.0.0',
        nodes: [
          {
            id: 'analyze',
            type: 'agent',
            name: 'Analyze Data',
            agentId: 'data-discovery-agent',
            configuration: { depth: 'basic' },
            inputSchema: {},
            outputSchema: {},
          },
        ],
        edges: [],
        entryPoint: 'analyze',
      };

      await plugin.createWorkflow(workflowDef);
      
      const input = { data: [{ id: 1, name: 'test' }] };
      const result = await plugin.executeWorkflow('exec-test-workflow', input);

      expect(result.status).toBe('completed');
      expect(result.workflowId).toBe('exec-test-workflow');
      expect(result.output).toBeDefined();
    });

    it('should validate workflow definition', async () => {
      const invalidWorkflow: WorkflowDefinition = {
        id: '',
        name: '',
        description: '',
        version: '1.0.0',
        nodes: [],
        edges: [],
        entryPoint: 'nonexistent',
      };

      await expect(plugin.createWorkflow(invalidWorkflow)).rejects.toThrow(
        'Invalid workflow definition: missing required fields'
      );
    });

    it('should get workflow status', async () => {
      const workflowDef: WorkflowDefinition = {
        id: 'status-test-workflow',
        name: 'Status Test Workflow',
        description: 'A workflow for testing status',
        version: '1.0.0',
        nodes: [
          {
            id: 'node1',
            type: 'agent',
            name: 'Node 1',
            agentId: 'data-discovery-agent',
            configuration: {},
            inputSchema: {},
            outputSchema: {},
          },
        ],
        edges: [],
        entryPoint: 'node1',
      };

      await plugin.createWorkflow(workflowDef);
      const status = await plugin.getWorkflowStatus('status-test-workflow');

      expect(status.status).toBe('created');
      expect(status.progress.totalNodes).toBe(1);
      expect(status.progress.completedNodes).toBe(0);
    });

    it('should list workflows', async () => {
      const workflow1: WorkflowDefinition = {
        id: 'workflow-1',
        name: 'First Workflow',
        description: 'First test workflow',
        version: '1.0.0',
        nodes: [{ id: 'n1', type: 'agent', name: 'Node 1', agentId: 'data-discovery-agent', configuration: {}, inputSchema: {}, outputSchema: {} }],
        edges: [],
        entryPoint: 'n1',
      };

      const workflow2: WorkflowDefinition = {
        id: 'workflow-2',
        name: 'Second Workflow',
        description: 'Second test workflow',
        version: '1.0.0',
        nodes: [{ id: 'n1', type: 'agent', name: 'Node 1', agentId: 'data-discovery-agent', configuration: {}, inputSchema: {}, outputSchema: {} }],
        edges: [],
        entryPoint: 'n1',
      };

      await plugin.createWorkflow(workflow1);
      await plugin.createWorkflow(workflow2);

      const workflows = await plugin.listWorkflows();
      expect(workflows.length).toBeGreaterThanOrEqual(2);

      const workflowNames = workflows.map(w => w.definition.name);
      expect(workflowNames).toContain('First Workflow');
      expect(workflowNames).toContain('Second Workflow');
    });
  });

  describe('LLM Integration', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
      await plugin.activate();
    });

    it('should generate completion', async () => {
      const mockCompletion = {
        text: 'Generated response',
        finishReason: 'completed',
        usage: { prompt: 50, completion: 25, total: 75 },
        model: 'gpt-4',
        timestamp: new Date().toISOString(),
      };

      mockContext.services.call = vi.fn().mockResolvedValue(mockCompletion);

      const result = await plugin.generateCompletion('Test prompt', {
        model: 'gpt-4',
        temperature: 0.7,
      });

      expect(result).toEqual(mockCompletion);
      expect(mockContext.services.call).toHaveBeenCalledWith(
        'llm-providers',
        'generateCompletion',
        'Test prompt',
        { model: 'gpt-4', temperature: 0.7 }
      );
    });

    it('should generate embedding', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, -0.1, -0.2];
      mockContext.services.call = vi.fn().mockResolvedValue(mockEmbedding);

      const result = await plugin.generateEmbedding('Test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockContext.services.call).toHaveBeenCalledWith(
        'llm-providers',
        'generateEmbedding',
        'Test text'
      );
    });

    it('should analyze data', async () => {
      // Mock workflow creation and execution
      mockContext.services.call = vi.fn().mockResolvedValue({
        text: 'Data analysis results',
        model: 'gpt-4',
        usage: { prompt: 200, completion: 100, total: 300 },
      });

      const dataset: Dataset = {
        id: 'test-dataset',
        name: 'Test Dataset',
        schema: { fields: [] },
        data: [{ id: 1, value: 'test' }],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          size: 1,
        },
      };

      const result = await plugin.analyzeData(dataset, 'Analyze this data');

      expect(result.insights).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should list models', async () => {
      const mockModels = [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          description: 'Most capable model',
          provider: 'openai',
          type: 'completion' as const,
          maxTokens: 8192,
          costPer1kTokens: 0.03,
        },
      ];

      mockContext.services.call = vi.fn().mockResolvedValue(mockModels);

      const result = await plugin.listModels();

      expect(result).toEqual(mockModels);
      expect(mockContext.services.call).toHaveBeenCalledWith(
        'llm-providers',
        'listModels'
      );
    });
  });

  describe('Integration Capabilities', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
      await plugin.activate();
    });

    it('should connect successfully', async () => {
      const connection = await plugin.connect('test-endpoint');

      expect(connection.endpoint).toBe('test-endpoint');
      expect(connection.status).toBe('connected');
      expect(connection.metadata.protocol).toBe('langgraph');
    });

    it('should test connection', async () => {
      const result = await plugin.testConnection();

      expect(result.success).toBe(true);
      expect(result.latency).toBeGreaterThan(0);
      expect(result.details.protocol).toBe('plugin');
    });

    it('should check connection status', async () => {
      expect(plugin.isConnected()).toBe(false);

      await plugin.connect('test-endpoint');
      expect(plugin.isConnected()).toBe(true);
    });

    it('should sync data', async () => {
      const dataset: Dataset = {
        id: 'sync-test',
        name: 'Sync Test Dataset',
        schema: { fields: [] },
        data: [{ id: 1 }, { id: 2 }],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          size: 2,
        },
      };

      const result = await plugin.sync(dataset);

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBeGreaterThanOrEqual(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should return integration capabilities', () => {
      const capabilities = plugin.getIntegrationCapabilities();
      expect(capabilities).toHaveLength(2);
      
      const capabilityNames = capabilities.map(cap => cap.name);
      expect(capabilityNames).toContain('workflow-orchestration');
      expect(capabilityNames).toContain('agent-coordination');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
      await plugin.activate();
    });

    it('should handle workflow execution errors', async () => {
      // Mock LLM service to throw error
      mockContext.services.call = vi.fn().mockRejectedValue(new Error('LLM service error'));

      const workflowDef: WorkflowDefinition = {
        id: 'error-workflow',
        name: 'Error Workflow',
        description: 'A workflow that will fail',
        version: '1.0.0',
        nodes: [
          {
            id: 'fail-node',
            type: 'agent',
            name: 'Failing Node',
            agentId: 'data-discovery-agent',
            configuration: {},
            inputSchema: {},
            outputSchema: {},
          },
        ],
        edges: [],
        entryPoint: 'fail-node',
      };

      await plugin.createWorkflow(workflowDef);
      
      const result = await plugin.executeWorkflow('error-workflow', {});
      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('LLM service error');
    });

    it('should handle invalid agent registration', async () => {
      const invalidAgent = {
        id: '',
        name: '',
        specialization: 'data-discovery',
      } as AnalyticsAgent;

      await expect(plugin.registerAgent(invalidAgent)).rejects.toThrow(
        'Invalid agent configuration: missing required fields'
      );
    });

    it('should handle operations on inactive plugin', async () => {
      // Create a fresh plugin instance to ensure it's inactive
      const freshPlugin = new LangGraphIntegrationPlugin();
      await expect(freshPlugin.execute('test-operation', {})).rejects.toThrow(
        'Plugin is not active'
      );
    });
  });
});