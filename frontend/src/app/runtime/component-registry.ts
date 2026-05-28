/**
 * Component Registry - 轻量级全局组件注册表
 *
 * 支持反向注册模式：组件构造时自注册，外部模块通过 subscribe 等待发现。
 */

class ComponentRegistry {
  private components = new Map<string, any>();
  private pending = new Map<string, Set<(instance: any) => void>>();

  register<T>(key: string, instance: T): void {
    this.components.set(key, instance);
    this.pending.get(key)?.forEach((cb) => cb(instance));
    this.pending.delete(key);
  }

  get<T>(key: string): T | undefined {
    return this.components.get(key);
  }

  subscribe<T>(key: string, cb: (instance: T) => void): void {
    const existing = this.components.get(key);
    if (existing) {
      cb(existing);
      return;
    }
    if (!this.pending.has(key)) this.pending.set(key, new Set());
    this.pending.get(key)!.add(cb);
  }
}

export const componentRegistry = new ComponentRegistry();
