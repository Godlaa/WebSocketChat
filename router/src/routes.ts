import { Router } from "express";
import { pool } from "./db";

export interface Room {
  id: number;
  name?: string;
}

export const router = Router();

// GET /rooms
router.get("/rooms", async (req, res) => {
  const result = await pool.query<Room>(`SELECT id, name FROM "Room"`);
  res.json(result.rows);
});

// POST /rooms
router.post("/rooms", async (req, res) => {
  const { name } = req.body as { name?: string };
  const result = await pool.query<Room>(
    `INSERT INTO "Room"(name, deployed_id) VALUES ($1, NULL) RETURNING id, name`,
    [name || null]
  );
  res.status(201).json(result.rows[0]);
});

// DELETE /rooms/:id
router.delete("/rooms/:id", async (req, res) => {
  const id = +req.params.id;
  await pool.query(`DELETE FROM "Room" WHERE id = $1`, [id]);
  res.sendStatus(204);
});
