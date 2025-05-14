import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Room { id: number; name: string; }

export function RoomsListPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newName, setNewName] = useState("");
  const [routerLink, setRouterLink] = useState<string>('');
  const wsRef = useRef<WebSocket>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/config/routerConfig.json')  // file placed in public/data.json
        .then(response => response.json())
        .then(json => {
          setRouterLink(`${json.routerIp}:${json.routerPort}`)
        })
        .catch(console.error);
  }, []);

  useEffect(() => {
    if(routerLink === ''){
      return
    }
    const ws = new WebSocket(`ws://${routerLink}/rooms-ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "list" }));
    };
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data) as any;
      switch (msg.type) {
        case "list":
          setRooms(msg.rooms);
          break;
        case "created":
          setRooms(r => [...r, msg.room]);
          break;
        case "deleted":
          setRooms(r => r.filter(x => x.id !== msg.id));
          break;
      }
    };
    ws.onerror = console.error;
    return () => { ws.close(); };
  }, [routerLink]);

  const createRoom = () => {
    if (!newName.trim()) return;
    wsRef.current?.send(JSON.stringify({ type: "create", payload: { name: newName } }));
    setNewName("");
  };

  const deleteRoom = (id: number) => {
    wsRef.current?.send(JSON.stringify({ type: "delete", payload: { id } }));
  };

  return (
    <div className="bg-dark text-light min-vh-100 p-4">
      {/* Список комнат */}
      <div className="rounded border border-secondary p-4 mb-4">
        {rooms.map(room => (
          <div key={room.id} className="d-flex align-items-center mb-3">
            <div className="flex-grow-1 bg-secondary text-light rounded-pill py-2 px-4">
              Комната {room.name}
            </div>
            <button
              className="btn btn-outline-light ms-3 me-2 rounded-pill"
              onClick={() => navigate(`/rooms/${room.id}`)}
            >
              Войти
            </button>
            <button
              className="btn btn-outline-danger rounded-pill"
              onClick={() => deleteRoom(room.id)}
            >
              Удалить
            </button>
          </div>
        ))}
      </div>

      {/* Создание новой комнаты */}
      <div className="rounded border border-secondary p-4">
        <label className="form-label mb-2">Название комнаты</label>
        <div className="d-flex">
          <input
            type="text"
            className="form-control bg-secondary text-light rounded-pill flex-grow-1 me-3"
            placeholder="Введите название"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createRoom()}
          />
          <button
            className="btn btn-light rounded-pill px-4"
            onClick={createRoom}
          >
            Создать комнату
          </button>
        </div>
      </div>
    </div>
  );
}