import express from "express";
import { db } from "./connect.js";
import cors from "cors";
import axios from "axios";
import "./loadEnv.js";

const PORT = 5000;
const app = express();
const GECKO_API_KEY = process.env.GECKO_API_KEY;
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});
app.get("/users", async (req, res) => {
  //console.log("Fetching users from MongoDB");
  const response = await db.collection("User").find({}).toArray();
  //console.log("ToArray result: ", response);
  if (response.length <= 0) {
    //console.error(err);
    res.status(500).send("No users found in MongoDB");
  } else {
    //console.log(response);
    res.json(response);
  }
});
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await db.collection("User").findOne({ email, password });
  const userId = user._id;
  const userName = user.username;
  if (user) {
    res.status(200).json({ message: "Login successful", userId, userName });
  } else {
    res.status(401).send("Invalid credentials");
  }
});
app.get("/listCurrencies", async (req, res) => {
  const url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd";
  const params = {
    accept: "application/json",
    "x-cg-pro-api-key": GECKO_API_KEY,
  };

  const response = await axios.get(url, params);
  //console.log("Response: ", response.data);
  res.send(response.data);
  // Fetch currencies from coingecko API
  //if currencies favorite in user collection, add favorite tag
});
app.post("/convertCurrency", async (req, res) => {
  //const value = req.body.value;
  const url = "https://api.coingecko.com/api/v3/simple/price";
  const params = {
    accept: "application/json",
    "x-cg-pro-api-key": GECKO_API_KEY,
  };

  const response = await axios.get(url, params);
  //console.log("Response: ", response.data);
  res.send(response.data);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
