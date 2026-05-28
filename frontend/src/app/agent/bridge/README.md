# Agent Bridge (Translation Layer)

## Overview

This directory is reserved for the **Voice-to-Agent Translation Layer**.

## Purpose

Bridge the gap between natural language (ASR/LLM output) and structured capability commands.

## Planned Architecture

```
LLM Output (text)
    ↓
Intent Parser
    ↓
Capability Intent
    ↓
Parameter Extractor
    ↓
agent.execute(capability, payload)
```

## Example Flow

1. User says: "机械臂回到初始位置"
2. ASR: "机械臂回到初始位置"
3. LLM: `tool_call: arm.home`
4. Bridge: Parse intent → `agent.execute('arm.home')`
5. Agent: Send to robot

## Future Work

- [ ] Intent classification model
- [ ] Parameter extraction from natural language
- [ ] Fallback to human confirmation for safety-critical operations
- [ ] Multi-turn capability composition

## Safety Considerations

All physical actions (arm.move, gripper.close) MUST require:
- Explicit user confirmation OR
- Pre-authorized intent pattern OR
- Emergency stop capability at all times
