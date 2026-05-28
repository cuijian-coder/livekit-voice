/**
 * Agent Auto-Init - 反向注册入口
 *
 * 被 App.ts 通过动态 import 加载。被调用即执行，内部不判断开关。
 * 通过 componentRegistry 反向发现 InputBar 和 Footer，完成自注册。
 */

import { AGENT_WS_URL } from '../runtime/config';
import { componentRegistry } from '../runtime/component-registry';
import { AgentClient } from './agent-client';
import type { RobotStateMessage } from './agent-protocol';
import { CAPABILITY_REGISTRY, validateCapabilityPayload } from './capability-registry';
import type { CommandHandler } from '../components/InputBar';
import { getLogger } from '@livekit-voice/shared/logger';

const logger = getLogger();

let initialized = false;

const tryInit = () => {
  if (initialized) return;

  const inputBar = componentRegistry.get<any>('inputBar');
  const footer = componentRegistry.get<any>('footer');
  if (!inputBar || !footer) return;

  initialized = true;

  // 1. 创建 AgentClient
  const agentClient = new AgentClient(AGENT_WS_URL);

  // 2. 注册 slash 命令
  const armHandler: CommandHandler = {
    getDisplayText: (args: string[]) => {
      const subCommand = args[0];
      if (subCommand === 'home') return '🤖 机械臂归位';
      if (subCommand === 'move') {
        const coords = args.slice(1).join(' ');
        return `🤖 移动机械臂到 (${coords})`;
      }
      return `🤖 arm ${args.join(' ')}`;
    },
    execute: async (args: string[]) => {
      const subCommand = args[0];
      if (subCommand === 'home') {
        const res = await agentClient.execute('arm.home', {});
        return {
          success: res.success,
          message: (res.result?.message as string) || '执行完成',
          error: res.error,
        };
      }
      if (subCommand === 'move') {
        const coords = args.slice(1).map(Number);
        if (coords.length < 3 || coords.some(isNaN)) {
          return { success: false, message: '', error: '格式错误: /arm move <x> <y> <z>' };
        }
        const [x, y, z] = coords;
        const payload = { x, y, z };
        const validation = validateCapabilityPayload('arm.move', payload);
        if (!validation.valid) {
          return { success: false, message: '', error: `参数错误: ${validation.errors.join(', ')}` };
        }
        const res = await agentClient.execute('arm.move', { x, y, z });
        return {
          success: res.success,
          message: (res.result?.message as string) || '执行完成',
          error: res.error,
        };
      }
      return { success: false, message: '', error: `未知命令: ${subCommand}` };
    },
  };

  inputBar.registerCommand('arm', armHandler);

  // 3. 注册 Footer 状态
  const statusEl = footer.showAgentStatus();
  const updateStatus = (state: string) => {
    const config = getStatusConfig(state);
    statusEl.innerHTML = `
      <span style="color: ${config.color}; font-size: 10px;">${config.icon}</span>
      <span>${config.label}</span>
    `;
  };

  agentClient.onStateChange((state: string) => {
    updateStatus(state);
  });

  agentClient.onMessage((msg: any) => {
    if (msg.type === 'robot.state') {
      const state = msg as RobotStateMessage;
      updateStatus(state.busy ? 'busy' : 'connected');
    }
  });

  // 4. 连接
  agentClient.connect().catch((err: any) => {
    logger.warn('agent.connect.failed', { err });
  });

  logger.info('agent.auto-init.completed');
};

// 如果组件已就绪，立即初始化
tryInit();

// 否则等待任一组件注册时重试
componentRegistry.subscribe('inputBar', tryInit);
componentRegistry.subscribe('footer', tryInit);

function getStatusConfig(state: string): { icon: string; label: string; color: string } {
  switch (state) {
    case 'disconnected':
      return { icon: '⚫', label: 'Agent 离线', color: '#888' };
    case 'connecting':
      return { icon: '🟡', label: 'Agent 连接中...', color: '#f59e0b' };
    case 'connected':
    case 'idle':
      return { icon: '🟢', label: 'Agent 就绪', color: '#22c55e' };
    case 'busy':
      return { icon: '🔵', label: 'Agent 运行中...', color: '#3b82f6' };
    case 'error':
      return { icon: '🔴', label: 'Agent 错误', color: '#ef4444' };
    default:
      return { icon: '⚫', label: 'Agent 未知', color: '#888' };
  }
}
