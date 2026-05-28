/**
 * AppConfig - Electron 运行时配置类型
 */
export interface AppConfig {
  backend: {
    wsUrl: string
    apiUrl: string
  }
  agent: {
    wsUrl: string
    enabled: boolean
  }
}

export interface ElectronAPI {
  config: AppConfig
  platform: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
