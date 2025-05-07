import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import { router } from "./routes";
import { pool } from "./db";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(router);

const server = http.createServer(app);

// Стартуем
const PORT = process.env.PORT ? +process.env.PORT : 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
