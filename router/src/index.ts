import express from "express";
import http from "http";
import cors from "cors";
import { initRoomsWSS } from "./wsRooms";
import { pool } from "./db";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
initRoomsWSS(server);

const PORT = process.env.PORT ?? 5000;
server.listen(PORT, () => console.log(`Router listening on ${PORT}`));
