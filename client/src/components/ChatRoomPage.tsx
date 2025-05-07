import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface ChatMessage { id: number; text: string; }

export function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const socketRef = useRef<WebSocket>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomId) return;

    // 1) Запрашиваем у роутера адрес WebSocket-сервера
    fetch(`http://localhost:5000/rooms/${roomId}/join`)
      .then(res => res.json())
      .then(({ wsUrl }: { wsUrl: string }) => {
        const ws = new WebSocket(wsUrl.replace('0.0.0.0', 'localhost'));
        socketRef.current = ws;

        ws.onopen = () => {
          console.log("WS connected to", wsUrl);
        };

        ws.onmessage = ev => {
          const msg = JSON.parse(ev.data);

          if (msg.type === "history") {
            const parsed = msg.messages.map((m: {id:number; text:string}) => {
              const inner = JSON.parse(m.text) as { type:string; text:string };
              return { id: m.id, text: inner.text };
            });
            setMessages(parsed);
          }
        
          if (msg.type === "message") {
            const inner = JSON.parse(msg.text) as { type:string; text:string };
            setMessages(prev => [...prev, { id: Date.now(), text: inner.text }]);
          }
        };

        ws.onerror = console.error;
        ws.onclose = () => console.log("WS closed");
      })
      .catch(console.error);
  }, [roomId, navigate]);

  const sendMessage = () => {
    if (!socketRef.current || !inputText.trim()) return;
    socketRef.current.send(inputText);
    setMessages(prev => [
      ...prev,
      { id: Date.now(), type: 'message', text: inputText }
    ]);
    setInputText("");
  };

  const deleteRoom = () => {
    // Удаляем комнату через HTTP и возвращаемся на список
    fetch(`http://localhost:5000/rooms/${roomId}`, { method: "DELETE" })
      .then(res => {
        if (res.ok) navigate("/");
      })
      .catch(console.error);
  };

  return (
    <div className="bg-dark text-light min-vh-100 p-4 d-flex flex-column">
      {/* Кнопки */}
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