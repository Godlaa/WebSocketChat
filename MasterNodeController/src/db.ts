import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
    host:     process.env.PGHOST,
    port:     +process.env.PGPORT!,
    database: process.env.PGDATABASE,
    user:     process.env.PGUSER,
    password: process.env.PGPASSWORD,
});


// Чтобы запускать без контейнера
// import { Pool } from "pg";
//
// export const pool = new Pool({
//     host:     '172.17.0.1',
//     port:     5433,
//     database: "chatdb",
//     user:     "postgres",
//     password: "12345",
// });