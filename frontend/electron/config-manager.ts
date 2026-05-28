import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { AppConfig } from './config'

const defaultConfig: AppConfig = {
  backend: {
    wsUrl: 'ws://localhost:3000/ws',
    apiUrl: 'http://localhost:3000',
  },
  agent: {
    wsUrl: 'ws://127.0.0.1:7765/ws',
    enabled: false,
  },
}

function getConfigPath(): string {
  const userData = app.getPath('userData')
  return join(userData, 'config.json')
}

export function loadConfig(): AppConfig {
  const configPath = getConfigPath()

  if (!existsSync(configPath)) {
    // 首次启动：自动创建默认配置
    const dir = join(configPath, '..')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8')
    return { ...defaultConfig }
  }

  try {
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as AppConfig
    // 简单校验：确保必需字段存在
    if (!parsed.backend?.wsUrl || !parsed.backend?.apiUrl) {
      return { ...defaultConfig }
    }
    return parsed
  } catch {
    return { ...defaultConfig }
  }
}
