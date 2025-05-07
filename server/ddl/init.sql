-- Стартовая конфигурация узлов и сервисов
CREATE TABLE "StartNodes" (
    id      SERIAL PRIMARY KEY,
    ip      VARCHAR(50) NOT NULL,
    "WebSocketServerCreationPriority" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE "StartConfiguration" (
    id      SERIAL PRIMARY KEY,
    "nodeId" INTEGER NOT NULL REFERENCES "StartNodes"(id) ON DELETE CASCADE,
    port    INTEGER NOT NULL,
    type    VARCHAR(20) NOT NULL CHECK (type IN ('Router', 'WebSocketServer'))
    -- Можно добавить UNIQUE(nodeId, type) при необходимости, и др. ограничения
);

CREATE TABLE "StartGeneralConfig" (
    id    SERIAL PRIMARY KEY,
    key   VARCHAR(50) NOT NULL,
    value VARCHAR(50)
);

-- Текущая ( runtime ) конфигурация узлов и сервисов
CREATE TABLE "CurrentNodes" (
    id      SERIAL PRIMARY KEY,
    ip      VARCHAR(50) NOT NULL,
    "WebSocketServerCreationPriority" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE "CurrentConfiguration" (
    id      SERIAL PRIMARY KEY,
    "nodeId" INTEGER NOT NULL REFERENCES "CurrentNodes"(id) ON DELETE CASCADE,
    port    INTEGER NOT NULL,
    type    VARCHAR(20) NOT NULL CHECK (type IN ('Router', 'WebSocketServer'))
);

CREATE TABLE "CurrentGeneralConfig" (
    id    SERIAL PRIMARY KEY,
    key   VARCHAR(50) NOT NULL,
    value VARCHAR(50)
);

-- Таблица комнат чата
CREATE TABLE "Room" (
    id           SERIAL PRIMARY KEY,
    name VARCHAR(50),
    "deployed_id" INTEGER REFERENCES "CurrentConfiguration"(id)  -- комната привязана к WebSocketServer (может быть NULL, если не запущена)
    -- Можно добавить здесь имя комнаты, если нужно: name TEXT
);

-- Таблица сообщений
CREATE TABLE "Message" (
    id       SERIAL PRIMARY KEY,
    room_id  INTEGER NOT NULL REFERENCES "Room"(id) ON DELETE CASCADE,
    text     TEXT NOT NULL
    -- Можно добавить timestamp (например, created_at TIMESTAMP DEFAULT NOW())
);
