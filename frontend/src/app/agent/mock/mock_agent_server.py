"""
Agent Mock Server

A simple WebSocket mock server for testing the Agent module.
Runs on ws://127.0.0.1:7765/ws

Capabilities:
- arm.home: Returns success after 500ms delay
- arm.move: Returns success with busy=true, then sends robot.state updates

Usage:
    python mock_agent_server.py
"""

import asyncio
import json
import websockets
import random
from datetime import datetime

PORT = 7765

# Simulated robot state
robot_state = {
    "busy": False,
    "position": {"x": 0, "y": 0, "z": 0},
}


async def handle_client(websocket, path):
    print(f"[{datetime.now()}] Client connected: {websocket.remote_address}")

    try:
        async for message in websocket:
            try:
                msg = json.loads(message)
                msg_type = msg.get("type")

                if msg_type == "execute":
                    request_id = msg.get("request_id")
                    capability = msg.get("capability")
                    payload = msg.get("payload", {})

                    print(f"[{datetime.now()}] Execute: {capability} (req: {request_id})")

                    if capability == "arm.home":
                        await handle_arm_home(websocket, request_id)
                    elif capability == "arm.move":
                        await handle_arm_move(websocket, request_id, payload)
                    else:
                        await send_error(websocket, request_id, f"Unknown capability: {capability}")

                elif msg_type == "heartbeat.ack":
                    # Respond with heartbeat
                    await websocket.send(json.dumps({
                        "type": "heartbeat",
                        "timestamp": int(datetime.now().timestamp() * 1000),
                    }))

                else:
                    print(f"[{datetime.now()}] Unknown message type: {msg_type}")

            except json.JSONDecodeError:
                print(f"[{datetime.now()}] Invalid JSON received")
            except Exception as e:
                print(f"[{datetime.now()}] Error handling message: {e}")

    except websockets.exceptions.ConnectionClosed:
        print(f"[{datetime.now()}] Client disconnected")


async def handle_arm_home(websocket, request_id):
    """Simulate arm home command"""
    global robot_state

    # Send log
    await websocket.send(json.dumps({
        "type": "robot.log",
        "level": "info",
        "message": "开始归位...",
        "timestamp": int(datetime.now().timestamp() * 1000),
    }))

    # Simulate delay
    await asyncio.sleep(0.5)

    robot_state["busy"] = False
    robot_state["position"] = {"x": 0, "y": 0, "z": 0}

    # Send result
    await websocket.send(json.dumps({
        "type": "execute.result",
        "request_id": request_id,
        "success": True,
        "capability": "arm.home",
        "result": {
            "message": "归位完成",
            "position": robot_state["position"],
        },
    }))

    # Send state update
    await websocket.send(json.dumps({
        "type": "robot.state",
        "busy": False,
        "position": robot_state["position"],
    }))


async def handle_arm_move(websocket, request_id, payload):
    """Simulate arm move command with busy state"""
    global robot_state

    x, y, z = payload.get("x", 0), payload.get("y", 0), payload.get("z", 0)

    # Send log
    await websocket.send(json.dumps({
        "type": "robot.log",
        "level": "info",
        "message": f"开始移动到 ({x}, {y}, {z})...",
        "timestamp": int(datetime.now().timestamp() * 1000),
    }))

    # Set busy
    robot_state["busy"] = True

    # Send result (busy = true means robot is physically moving)
    await websocket.send(json.dumps({
        "type": "execute.result",
        "request_id": request_id,
        "success": True,
        "capability": "arm.move",
        "result": {
            "message": "移动指令已发送",
            "busy": True,
        },
    }))

    # Simulate movement with state updates
    steps = 5
    for i in range(steps):
        await asyncio.sleep(0.3)
        progress = (i + 1) / steps
        robot_state["position"] = {
            "x": round(x * progress, 1),
            "y": round(y * progress, 1),
            "z": round(z * progress, 1),
        }

        await websocket.send(json.dumps({
            "type": "robot.state",
            "busy": True,
            "position": robot_state["position"],
        }))

        await websocket.send(json.dumps({
            "type": "robot.log",
            "level": "info",
            "message": f"移动中... 进度 {int(progress * 100)}%",
            "timestamp": int(datetime.now().timestamp() * 1000),
        }))

    # Movement complete
    robot_state["busy"] = False
    robot_state["position"] = {"x": x, "y": y, "z": z}

    await websocket.send(json.dumps({
        "type": "robot.state",
        "busy": False,
        "position": robot_state["position"],
    }))

    await websocket.send(json.dumps({
        "type": "robot.log",
        "level": "info",
        "message": f"移动完成，当前位置: ({x}, {y}, {z})",
        "timestamp": int(datetime.now().timestamp() * 1000),
    }))


async def send_error(websocket, request_id, message):
    await websocket.send(json.dumps({
        "type": "execute.result",
        "request_id": request_id,
        "success": False,
        "capability": "unknown",
        "error": message,
    }))


async def main():
    print(f"🤖 Agent Mock Server starting on ws://127.0.0.1:{PORT}/ws")
    print(f"Capabilities: arm.home, arm.move")
    print("Press Ctrl+C to stop\n")

    async with websockets.serve(handle_client, "127.0.0.1", PORT):
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Mock server stopped")
