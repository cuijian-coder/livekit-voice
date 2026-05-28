import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AgentClient } from './agent-client'
import type { ExecuteResultMessage, RobotStateMessage } from './agent-protocol'

describe('AgentClient', () => {
  let client: AgentClient;
  let mockWs: any;
  let OriginalWebSocket: any;

  beforeEach(() => {
    // Save original
    OriginalWebSocket = global.WebSocket;

    // Create mock WebSocket class
    mockWs = {
      readyState: 1, // OPEN
      send: vi.fn(),
      close: vi.fn(),
    };

    const MockWebSocket = vi.fn(function() {
      return mockWs;
    }) as any;
    MockWebSocket.OPEN = 1;
    MockWebSocket.CONNECTING = 0;
    MockWebSocket.CLOSING = 2;
    MockWebSocket.CLOSED = 3;

    global.WebSocket = MockWebSocket;
    client = new AgentClient('ws://localhost:7765/ws');
  });

  afterEach(() => {
    global.WebSocket = OriginalWebSocket;
    vi.restoreAllMocks();
  });

  it('should connect successfully', async () => {
    const connectPromise = client.connect();

    // Simulate WebSocket open
    mockWs.readyState = 1;
    if (mockWs.onopen) mockWs.onopen();

    await connectPromise;
    expect(client.getState()).toBe('connected');
  });

  it('should execute capability and resolve on result', async () => {
    // Connect first
    const connectPromise = client.connect();
    mockWs.readyState = 1;
    if (mockWs.onopen) mockWs.onopen();
    await connectPromise;

    // Execute
    const executePromise = client.execute('arm.home');

    // Get the request_id from the sent message
    const sentMsg = JSON.parse(mockWs.send.mock.calls[0][0]);
    const requestId = sentMsg.request_id;

    // Simulate result
    const result: ExecuteResultMessage = {
      type: 'execute.result',
      request_id: requestId,
      success: true,
      capability: 'arm.home',
      result: { message: '归位完成' },
    };

    if (mockWs.onmessage) {
      mockWs.onmessage({ data: JSON.stringify(result) });
    }

    const response = await executePromise;
    expect(response.success).toBe(true);
    expect(response.result?.message).toBe('归位完成');
  });

  it('should timeout on execute if no response', async () => {
    vi.useFakeTimers();

    // Connect
    const connectPromise = client.connect();
    mockWs.readyState = 1;
    if (mockWs.onopen) mockWs.onopen();
    await connectPromise;

    // Execute without response
    const executePromise = client.execute('arm.move', { x: 100, y: 50, z: 20 });

    vi.advanceTimersByTime(31000);

    await expect(executePromise).rejects.toThrow('Execute timeout');
    vi.useRealTimers();
  });

  it('should handle robot state messages', () => {
    const stateHandler = vi.fn();
    client.onMessage(stateHandler);

    const robotState: RobotStateMessage = {
      type: 'robot.state',
      busy: true,
      position: { x: 100, y: 50, z: 20 },
    };

    // Connect and trigger message
    client.connect().then(() => {
      if (mockWs.onmessage) {
        mockWs.onmessage({ data: JSON.stringify(robotState) });
      }
    });
    mockWs.readyState = 1;
    if (mockWs.onopen) mockWs.onopen();

    // Use setTimeout to allow promise resolution
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(stateHandler).toHaveBeenCalledWith(expect.objectContaining({
          type: 'robot.state',
          busy: true,
        }));
        resolve();
      }, 10);
    });
  });
});
