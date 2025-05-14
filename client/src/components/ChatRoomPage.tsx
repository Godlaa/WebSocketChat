import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface ChatMessage { id: number; text: string; }
interface RoomsWsMsg {
  messages: any;
  type: "list" | "created" | "deleted" | "join" | "joinError";
  rooms?: { id: number; name: string }[];
  room?: { id: number; name: string };
  id?: number;
  wsUrl?: string;
  error?: string;
}

export function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [routerLink, setRouterLink] = useState<string>('');
  const roomsWsRef = useRef<WebSocket>(null);
  const chatWsRef  = useRef<WebSocket>(null);
  const navigate   = useNavigate();

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
    if (!roomId) return;

    // 1) Открываем WS к роутеру для работы с комнатами
    const roomsWs = new WebSocket(`ws://${routerLink}/rooms-ws`);
    roomsWsRef.current = roomsWs;

    roomsWs.onopen = () => {
      // просим URL чата для нашей комнаты
      roomsWs.send(JSON.stringify({
        type: "join",
        payload: { id: Number(roomId) }
      }));
    };

    roomsWs.onmessage = ev => {
      const msg = JSON.parse(ev.data) as RoomsWsMsg;

      if (msg.type === "joinError") {
        alert(msg.error);
        navigate("/");
        return;
      }

      if (msg.type === "join" && msg.wsUrl) {
        const chatWs = new WebSocket(msg.wsUrl.replace("0.0.0.0", window.location.hostname));
        chatWsRef.current = chatWs;

        chatWs.onopen = () => {
          console.log("Chat WS connected to", msg.wsUrl);
        };

        chatWs.onmessage = cev => {
          const cmsg = JSON.parse(cev.data) as {
            type: "history" | "message" | "roomDeleted";
            message?: { id: number; text: string };
            messages?: any []
          };

          if (cmsg.type === "history" && cmsg.messages) {
            const parsed = cmsg.messages.map((m: {id:number; text:string}) => {
              const inner = JSON.parse(m.text) as { type:string; text:string };
              return { id: m.id, text: inner.text };
            });
            setMessages(parsed);
          }

          if (cmsg.type === "message" && cmsg.message) {
            const { id, text } = cmsg.message;
            const inner = JSON.parse(text) as { type: string; text: string };
              setMessages(prev => [...prev, { id, text: inner.text }]);
          }

          if (cmsg.type === "roomDeleted") {
            alert("Комната удалена");
            navigate("/");
          }
        };

        chatWs.onerror = console.error;
      }
    };

    roomsWs.onerror = console.error;

    return () => {
      roomsWs.close();
      chatWsRef.current?.close();
    };
  }, [roomId, navigate, routerLink]);

  const sendMessage = () => {
    const chatWs = chatWsRef.current;
    if (!chatWs || !inputText.trim()) return;

    chatWs.send(JSON.stringify({ type: "message", text: inputText }));
    setInputText("");
  };

  const deleteRoom = () => {
    roomsWsRef.current?.send(
      JSON.stringify({ type: "delete", payload: { id: Number(roomId) } })
    );
    navigate("/");
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
            className="bg-secondary text-light rounded-pill py-2 px-4 mb-3"
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