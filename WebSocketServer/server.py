import os
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from db import db
from master_client import MasterClient

# читаем HOST/PORT из окружения до объявления endpoint-ов
HOST = os.getenv("HOST", "localhost")
PORT = int(os.getenv("PORT", "8080"))

app = FastAPI()
clients: dict[str, set[WebSocket]] = {}

@app.on_event("startup")
async def startup():
    await db.connect()
    # запускаем фоновый клиент MasterNode
    asyncio.create_task(start_master_client())

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: int):
    await websocket.accept()
    clients.setdefault(room_id, set()).add(websocket)

    # Зарегистрировать комнату (привязать к этому WS-серверу)
    await db.register_room(room_id, HOST, PORT)

    # 1) При подключении сразу высылаем историю
    history = await db.get_history(int(room_id))
    await websocket.send_json({
        "type": "history",
        "messages": [{"id": r["id"], "text": r["text"]} for r in history]
    })

    try:
        while True:
            # Получаем текст от клиента
            data = await websocket.receive_text()
            # Сохраняем и получаем id новой записи
            new_id = await db.save_message(room_id, data)
            # Готовим полезлоад
            new_msg = {
                "type": "message",
                "message": {
                    "id": new_id,
                    "text": data
                }
            }
            # Рассылаем всем в комнате
            for ws in clients[room_id]:
                await ws.send_json(new_msg)
    except WebSocketDisconnect:
        clients[room_id].remove(websocket)
    
async def start_master_client():
    master_url = os.getenv("MASTER_URL", "")
    client = MasterClient(master_url, "0.0.0.0:8080")
    await client.connect()

# —————— точка входа ——————

if __name__ == "__main__":
    # Запускаем Uvicorn
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8080)
