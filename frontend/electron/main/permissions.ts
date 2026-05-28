import { session } from 'electron'

/**
 * Register global permission handlers for the Electron app.
 *
 * Must be called before any BrowserWindow is created,
 * typically inside app.whenReady().
 */
export function registerPermissionHandlers(): void {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true)
      } else {
        callback(false)
      }
    }
  )
}
