import { contextBridge } from 'electron'
import { loadConfig } from './config-manager'

const config = loadConfig()

contextBridge.exposeInMainWorld('electronAPI', {
  config,
  platform: process.platform,
})
