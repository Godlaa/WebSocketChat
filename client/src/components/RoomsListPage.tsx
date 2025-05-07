import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Room {
  id: number;
  name?: string;
}

export function RoomsListPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newName, setNewName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:5000/rooms")
      .then(res => res.json())
      .then(setRooms)
      .catch(console.error);
  }, []);

  const createRoom = () => {
    if (!newName.trim()) return;
    fetch("http://localhost:5000/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName })
    })
      .then(res => res.json())
      .then((room: Room) => {
        setRooms(r => [...r, room]);
        setNewName("");
      })
      .catch(console.error);
  };

  const deleteRoom = (id: number) => {
    fetch(`http://localhost:5000/rooms/${id}`, { method: "DELETE" })
      .then(res => {
        if (res.ok) setRooms(r => r.filter(x => x.id !== id));
      })
      .catch(console.error);
  };

  return (
    <div className="bg-dark text-light min-vh-100 p-4">
      <div className="rounded border border-secondary p-4 mb-4">
        {rooms.map(room => (
          <div
            key={room.id}
            className="d-flex align-items-center mb-3"
          >
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