import { contextBridge } from 'electron'
import { loadConfig } from '../../main/services/config.service'
import type { ElectronAPI } from '../../shared/electron-api'

export function exposeConfigApi(): void {
  const api: ElectronAPI = {
    config: loadConfig(),
    platform: process.platform,
  }

  contextBridge.exposeInMainWorld('electronAPI', api)
}
