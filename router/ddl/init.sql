-- Стартовая конфигурация узлов и сервисов
CREATE TABLE "startNodes" (
    id      SERIAL PRIMARY KEY,
    ip      VARCHAR(50) NOT NULL,
    "WebSocketServerCreationPriority" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE "startConfiguration" (
    id      SERIAL PRIMARY KEY,
    "nodeId" INTEGER NOT NULL REFERENCES "startNodes"(id) ON DELETE CASCADE,
    port    INTEGER NOT NULL,
    type    VARCHAR(20) NOT NULL CHECK (type IN ('Router', 'WebSocketServer'))
    -- Можно добавить UNIQUE(nodeId, type) при необходимости, и др. ограничения
);

CREATE TABLE "startGeneralConfig" (
    id    SERIAL PRIMARY KEY,
    key   VARCHAR(50) NOT NULL,
    value VARCHAR(50)
);

-- Текущая ( runtime ) конфигурация узлов и сервисов
CREATE TABLE "currentNodes" (
    id      SERIAL PRIMARY KEY,
    ip      VARCHAR(50) NOT NULL UNIQUE,
    "WebSocketServerCreationPriority" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE "currentConfiguration" (
    id      SERIAL PRIMARY KEY,
    "nodeId" INTEGER NOT NULL REFERENCES "currentNodes"(id) ON DELETE CASCADE,
    port    INTEGER NOT NULL,
    type    VARCHAR(20) NOT NULL CHECK (type IN ('Router', 'WebSocketServer')),
    UNIQUE ("nodeId", port, type)
);

CREATE TABLE "currentGeneralConfig" (
    id    SERIAL PRIMARY KEY,
    key   VARCHAR(50) NOT NULL,
    value VARCHAR(50)
);

-- Таблица комнат чата
CREATE TABLE "room" (
    id           SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE,
    "deployed_id" INTEGER REFERENCES "currentConfiguration"(id)  -- комната привязана к WebSocketServer (может быть NULL, если не запущена)
    -- Можно добавить здесь имя комнаты, если нужно: name TEXT
);

-- Таблица сообщений
CREATE TABLE "message" (
    id       SERIAL PRIMARY KEY,
    room_id  INTEGER NOT NULL REFERENCES "room"(id) ON DELETE CASCADE,
    text     TEXT NOT NULL
    -- Можно добавить timestamp (например, created_at TIMESTAMP DEFAULT NOW())
);

INSERT INTO "currentNodes"(ip, "WebSocketServerCreationPriority")
VALUES ('0.0.0.0', 1)
ON CONFLICT (ip) DO NOTHING;

INSERT INTO "currentConfiguration"("nodeId", port, type)
VALUES (
  (SELECT id FROM "currentNodes" WHERE ip='0.0.0.0'),
  8080,
  'WebSocketServer'
)
ON CONFLICT ("nodeId", port, type) DO NOTHING;
