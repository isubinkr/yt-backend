import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

// config for data coming from json (form)
app.use(express.json({ limit: "16kb" }));
// config for data coming from url
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
// config for accessing local files (public assset)
app.use(express.static("public"));
// config for accesing user's browser cookies (perform CRUD operation on it)
app.use(cookieParser());

export { app };
