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
