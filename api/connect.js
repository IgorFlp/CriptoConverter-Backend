import { MongoClient } from "mongodb";
import "./loadEnv.js";
const MONGO_USER = process.env.MONGO_USER;
const MONGO_PASSWORD = process.env.MONGO_PASSWORD;
const URI = `mongodb+srv://${MONGO_USER}:${MONGO_PASSWORD}@cluster0.shq1m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(URI);
export const db = client.db("CryptoConverter");
