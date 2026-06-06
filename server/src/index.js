import cors from "cors";
import express from "express";
import { join } from "node:path";
import router from "./routes.js";
import { initializeQueue } from "./queue.js";
import { uploadsDir } from "./db.js";

const app = express();
const port = Number(process.env.PORT ?? 4100);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadsDir));
app.use("/api", router);

app.use((error, _request, response, _next) => {
  const message = error instanceof Error ? error.message : "服务器错误";
  response.status(500).json({ message });
});

initializeQueue();

app.listen(port, "127.0.0.1", () => {
  console.log(`AIDraw API listening at http://127.0.0.1:${port}`);
  console.log(`Uploads served from ${join(uploadsDir)}`);
});
