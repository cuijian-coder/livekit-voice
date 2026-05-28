# Agent Mock Server

## Overview

A Python WebSocket mock server for testing the Agent module without real robot hardware.

## Start Server

```bash
cd frontend/src/app/agent/mock
python mock_agent_server.py
```

## Endpoint

```
ws://127.0.0.1:7765/ws
```

## Capabilities

| Capability | Behavior |
|-----------|----------|
| `arm.home` | 500ms delay, returns success, position resets to (0,0,0) |
| `arm.move` | Simulates 1.5s physical movement with progress updates |

## Features

- Returns `execute.result` with `request_id` correlation
- Sends `robot.state` updates during movement
- Sends `robot.log` progress messages
- Responds to `heartbeat.ack`

## Example Session

```
Client → {type: "execute", request_id: "1", capability: "arm.move", payload: {x: 100, y: 50, z: 20}}
Server → {type: "execute.result", request_id: "1", success: true, result: {busy: true}}
Server → {type: "robot.state", busy: true, position: {x: 20, y: 10, z: 4}}
Server → {type: "robot.log", level: "info", message: "移动中... 进度 20%"}
...
Server → {type: "robot.state", busy: false, position: {x: 100, y: 50, z: 20}}
Server → {type: "robot.log", level: "info", message: "移动完成"}
```
