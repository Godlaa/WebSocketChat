create table "startNodes"
(
    id                                serial
        primary key,
    ip                                varchar(50)          not null,
    "WebSocketServerCreationPriority" integer              not null,
    "isActive"                        boolean default true not null
);

alter table "startNodes"
    owner to postgres;

create table "startConfiguration"
(
    id       serial
        primary key,
    "nodeId" integer     not null
        references "startNodes"
            on delete cascade,
    port     integer     not null,
    type     varchar(20) not null
        constraint "startConfiguration_type_check"
            check ((type)::text = ANY
                   (ARRAY [('Router'::character varying)::text, ('WebSocketServer'::character varying)::text, ('Client'::character varying)::text]))
);

alter table "startConfiguration"
    owner to postgres;

create table "startGeneralConfig"
(
    id    serial
        primary key,
    key   varchar(50) not null,
    value varchar(50)
);

alter table "startGeneralConfig"
    owner to postgres;

create table "currentNodes"
(
    id                                serial
        primary key,
    ip                                varchar(50)          not null
        unique,
    "WebSocketServerCreationPriority" integer              not null,
    "isActive"                        boolean default true not null
);

alter table "currentNodes"
    owner to postgres;

create table "currentConfiguration"
(
    id            serial
        primary key,
    "nodeId"      integer     not null
        references "currentNodes"
            on delete cascade,
    port          integer     not null,
    type          varchar(20) not null
        constraint "currentConfiguration_type_check"
            check ((type)::text = ANY
                   (ARRAY [('Router'::character varying)::text, ('WebSocketServer'::character varying)::text, ('Client'::character varying)::text])),
    "containerId" varchar,
    unique ("nodeId", port, type)
);

alter table "currentConfiguration"
    owner to postgres;

create table "currentGeneralConfig"
(
    id    serial
        primary key,
    key   varchar(50) not null,
    value varchar(50)
);

alter table "currentGeneralConfig"
    owner to postgres;

create table room
(
    id          serial
        primary key,
    name        varchar(50)
        unique,
    deployed_id integer
        references "currentConfiguration"
            on update set null on delete set null
);

alter table room
    owner to postgres;

create table message
(
    id      serial
        primary key,
    room_id integer not null
        references room
            on delete cascade,
    text    text    not null
);

alter table message
    owner to postgres;

insert into public."startGeneralConfig" (id, key, value)
values  (2, 'PrivateKeyPath', '/common/id_ed25519'),
        (1, 'DesiredWebSocketServerAmount', '2'),
        (3, 'RouterConfigPath', '/common/public');