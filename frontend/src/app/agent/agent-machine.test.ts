import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { agentMachine } from './agent-machine'
import { createInitialAgentContext } from './agent-context'

describe('AgentMachine', () => {
  it('should start in disconnected state', () => {
    const actor = createActor(agentMachine, { input: createInitialAgentContext() });
    actor.start();
    expect(actor.getSnapshot().value).toBe('disconnected');
  });

  it('should transition from disconnected to connecting on connect', () => {
    const actor = createActor(agentMachine, { input: createInitialAgentContext() });
    actor.start();
    actor.send({ type: 'agent.connect' });
    expect(actor.getSnapshot().value).toBe('connecting');
  });

  it('should transition from connecting to idle on connect success', () => {
    const actor = createActor(agentMachine, { input: createInitialAgentContext() });
    actor.start();
    actor.send({ type: 'agent.connect' });
    actor.send({ type: 'agent.connect' }); // Second connect = success
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('should transition from idle to executing on execute', () => {
    const actor = createActor(agentMachine, { input: createInitialAgentContext() });
    actor.start();
    actor.send({ type: 'agent.connect' });
    actor.send({ type: 'agent.connect' });
    actor.send({ type: 'agent.execute', requestId: 'req-1' });
    expect(actor.getSnapshot().value).toBe('executing');
  });

  it('should transition from executing to idle on success result (not busy)', () => {
    const actor = createActor(agentMachine, { input: createInitialAgentContext() });
    actor.start();
    actor.send({ type: 'agent.connect' });
    actor.send({ type: 'agent.connect' });
    actor.send({ type: 'agent.execute', requestId: 'req-1' });
    actor.send({
      type: 'agent.result',
      result: {
        type: 'execute.result',
        request_id: 'req-1',
        success: true,
        capability: 'arm.home',
      },
    });
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('should transition from executing to busy on success result with busy=true', () => {
    const actor = createActor(agentMachine, { input: createInitialAgentContext() });
    actor.start();
    actor.send({ type: 'agent.connect' });
    actor.send({ type: 'agent.connect' });
    actor.send({ type: 'agent.execute', requestId: 'req-1' });
    actor.send({
      type: 'agent.result',
      result: {
        type: 'execute.result',
        request_id: 'req-1',
        success: true,
        capability: 'arm.move',
        result: { busy: true },
      },
    });
    expect(actor.getSnapshot().value).toBe('busy');
  });

  it('should transition from busy to idle when robot state reports not busy', () => {
    const actor = createActor(agentMachine, { input: createInitialAgentContext() });
    actor.start();
    actor.send({ type: 'agent.connect' });
    actor.send({ type: 'agent.connect' });
    actor.send({ type: 'agent.execute', requestId: 'req-1' });
    actor.send({
      type: 'agent.result',
      result: {
        type: 'execute.result',
        request_id: 'req-1',
        success: true,
        result: { busy: true },
      },
    });
    expect(actor.getSnapshot().value).toBe('busy');

    actor.send({
      type: 'agent.state.update',
      state: {
        type: 'robot.state',
        busy: false,
        position: { x: 100, y: 50, z: 20 },
      },
    });
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('should transition to error on connection failure', () => {
    const actor = createActor(agentMachine, { input: createInitialAgentContext() });
    actor.start();
    actor.send({ type: 'agent.connect' });
    actor.send({ type: 'agent.error', message: 'Connection refused' });
    expect(actor.getSnapshot().value).toBe('error');
  });

  it('should store robot logs with max buffer', () => {
    const actor = createActor(agentMachine, { input: createInitialAgentContext() });
    actor.start();
    actor.send({ type: 'agent.connect' });
    actor.send({ type: 'agent.connect' });

    // Send 101 logs
    for (let i = 0; i < 101; i++) {
      actor.send({
        type: 'agent.log',
        log: {
          type: 'robot.log',
          level: 'info',
          message: `log-${i}`,
          timestamp: Date.now(),
        },
      });
    }

    const logs = actor.getSnapshot().context.logs;
    expect(logs.length).toBe(100); // Max buffer size
    expect(logs[0].message).toBe('log-1'); // First log was evicted
    expect(logs[99].message).toBe('log-100');
  });
});
