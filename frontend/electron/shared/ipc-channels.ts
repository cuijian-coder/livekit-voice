/**
 * IPC channel constants for main <-> renderer communication.
 *
 * Currently unused (config is injected synchronously via preload),
 * but reserved for future IPC-based APIs (e.g., config:write, system:restart).
 */
export enum IPC_CHANNELS {
  CONFIG_GET = 'config:get',
  CONFIG_SET = 'config:set',
}
