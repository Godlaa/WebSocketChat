import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface ChatMessage {
  id: number;
  text: string;
}

export function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomId) return;
    const ws = new WebSocket("ws://localhost:5000/ws");
    socketRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", roomId: Number(roomId) }));
    };

    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      switch (msg.type) {
        case "history":
          setMessages(msg.messages);
          break;
        case "message":
          setMessages(m => [...m, msg.message]);
          break;
        case "roomDeleted":
          alert("Комната удалена");
          navigate("/");
          break;
      }
    };

    return () => ws.close();
  }, [roomId, navigate]);

  const sendMessage = () => {
    if (!socketRef.current || inputText.trim() === "") return;
    socketRef.current.send(
      JSON.stringify({ type: "message", roomId: Number(roomId), text: inputText })
    );
    setInputText("");
  };

  const deleteRoom = () => {
    socketRef.current?.send(
      JSON.stringify({ type: "deleteRoom", roomId: Number(roomId) })
    );
  };

  return (
    <div className="bg-dark text-light min-vh-100 p-4 d-flex flex-column">
      {/* Верхние кнопки */}
      <div className="d-flex justify-content-end mb-4">
        <button
          className="btn btn-outline-light me-2 rounded-pill px-3"
          onClick={deleteRoom}
        >
          Удалить комнату
        </button>
        <button
          className="btn btn-outline-light rounded-pill px-3"
          onClick={() => navigate("/")}
        >
          Выйти
        </button>
      </div>

      {/* Окно сообщений */}
      <div
        className="flex-grow-1 rounded border border-secondary p-4 mb-4 d-flex flex-column"
        style={{ overflowY: "auto" }}
      >
        {messages.map(m => (
          <div
            key={m.id}
            className="bg-secondary text-light rounded-pill py-2 px-4 mb-3 align-self-start"
            style={{ maxWidth: "70%" }}
          >
            {m.text}
          </div>
        ))}
      </div>

      {/* Форма отправки */}
      <div className="rounded border border-secondary p-4">
        <label className="form-label mb-2">Написать сообщение</label>
        <div className="d-flex">
          <input
            type="text"
            className="form-control bg-secondary text-light rounded-pill flex-grow-1 me-3"
            placeholder="Введите сообщение..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
          />
          <button
            className="btn btn-light rounded-pill px-4"
            onClick={sendMessage}
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
}
