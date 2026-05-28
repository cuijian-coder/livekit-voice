/**
 * Capability Registry
 *
 * Hard-coded capability definitions for the robot arm system.
 * Each capability defines its parameters for validation and UI rendering.
 */

export interface CapabilityParam {
  type: 'number' | 'string' | 'boolean'
  required: boolean
  default?: unknown
  description?: string
}

export interface CapabilityDef {
  id: string
  name: string
  description: string
  params: Record<string, CapabilityParam>
}

export const CAPABILITY_REGISTRY: Record<string, CapabilityDef> = {
  'arm.move': {
    id: 'arm.move',
    name: '移动机械臂',
    description: '移动机械臂到指定坐标位置',
    params: {
      x: {
        type: 'number',
        required: true,
        description: 'X 坐标 (mm)',
      },
      y: {
        type: 'number',
        required: true,
        description: 'Y 坐标 (mm)',
      },
      z: {
        type: 'number',
        required: true,
        description: 'Z 坐标 (mm)',
      },
    },
  },
  'arm.home': {
    id: 'arm.home',
    name: '机械臂归位',
    description: '将机械臂移动到初始位置',
    params: {},
  },
}

/**
 * Validate capability payload against registry definition
 */
export function validateCapabilityPayload(
  capabilityId: string,
  payload: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const def = CAPABILITY_REGISTRY[capabilityId]
  if (!def) {
    return { valid: false, errors: [`Unknown capability: ${capabilityId}`] }
  }

  const errors: string[] = []

  for (const [key, paramDef] of Object.entries(def.params)) {
    if (paramDef.required && !(key in payload)) {
      errors.push(`Missing required parameter: ${key}`)
      continue
    }

    if (key in payload) {
      const value = payload[key]
      const expectedType = paramDef.type
      const actualType = typeof value

      if (expectedType === 'number' && actualType !== 'number') {
        errors.push(`Parameter ${key} must be a number, got ${actualType}`)
      }
      // Add more type checks as needed
    }
  }

  return { valid: errors.length === 0, errors }
}
