import express from "express";
import { db } from "./connect.js";
import { ObjectId } from "mongodb";
import cors from "cors";
import axios from "axios";
import "./loadEnv.js";
import rateLimit from "express-rate-limit";
import PQueue from "p-queue";
import jwt from "jsonwebtoken";
import CookieParser from "cookieparser";

const PORT = 5000;
const SECRET = process.env.SECRET;
const app = express();
const GECKO_API_KEY = process.env.GECKO_API_KEY;

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: "Muitas requisições feitas. Tente novamente em breve.",
});

const geckoQueue = new PQueue({
  concurrency: 1,
  interval: 1500,
  intervalCap: 1,
  carryoverConcurrencyCount: true,
});

app.use(limiter);
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
app.get("/currency", async (req, res) => {
  const { id, currency } = req.query;
  if (id && currency) {
    const coins = await geckoQueue.add(async () => {
      console.log("Enfileirado currency:id" + currency + " " + id);
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&ids=${id}`;
      const response = await axios.get(url, {
        headers: {
          accept: "application/json",
          "x-cg-pro-api-key": GECKO_API_KEY,
        },
      });
      console.log("Executado currency:id" + currency + " " + id);
      return response.data;
    });
    res.send(coins);
  } else {
    const coins = await geckoQueue.add(async () => {
      console.log("Enfileirado currency all");
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd`;
      const response = await axios.get(url, {
        headers: {
          accept: "application/json",
          "x-cg-pro-api-key": GECKO_API_KEY,
        },
      });
      console.log("Executado currency all");
      return response.data.slice(0, 30);
    });
    res.send(coins);
  }
});
app.get("/conversionHistory", async (req, res) => {
  try {
    const { userID } = req.query;
    const user = await db
      .collection("User")
      .findOne({ _id: new ObjectId(`${userID}`) });
    if (user) {
      res.status(200).json(user.conversionHistory);
    }
    res.status(404).json({ message: "Erro na busca de usuario", user: user });
  } catch (error) {
    console.log("Erro na requisição: " + error);
  }
});

app.get("/historyTable", async (req, res) => {
  try {
    const { userID } = req.query;
    let conversionHistory;
    const user = await db
      .collection("User")
      .findOne({ _id: new ObjectId(`${userID}`) });
    if (user) {
      conversionHistory = user.conversionHistory;
    }

    if (conversionHistory) {
      let historyTable = [];
      conversionHistory.map((cH, index) => {
        const date = new Date(cH.timestamp);

        const pad = (n) => n.toString().padStart(2, "0");

        const day = pad(date.getDate());
        const month = pad(date.getMonth() + 1); // Mês começa do zero
        const year = date.getFullYear();

        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());

        let formated = `${day}/${month}/${year} - ${hours}:${minutes}:${seconds}`;
        cH.timestamp = formated;

        historyTable.push(cH);
      });
      res.send(historyTable);
    }
  } catch (error) {
    console.log("Erro na requisição: " + error);
  }
});
app.post("/register", async (req, res) => {
  const { user, password } = req.body;
  //console.log("user: " + user);
  const find = await db.collection("User").findOne({ username: user });
  //console.log(find);
  if (find != null) {
    res
      .status(409)
      .json({ message: "Nome de usuario existente, favor escolher outro." });
  } else {
    const newUser = {
      username: user,
      password: password,
      favoriteCoins: [],
      conversionHistory: [],
    };
    const response = await db.collection("User").insertOne(newUser);
    console.log("response: " + response.insertedId);
    const userId = response.insertedId;

    if (response) {
      res.status(200).json({ message: "Usuario criado", userId });
    } else {
      res.status(401).send("Invalid credentials");
    }
  }
});
app.post("/login", async (req, res) => {
  const { user, password } = req.body;
  //console.log("User: " + user);
  const response = await db
    .collection("User")
    .findOne({ username: user, password: password });
  //console.log("Response: " + response);
  const userId = response._id;
  const userName = response.username;
  const userFavorites = response.favoriteCoins;
  if (response) {
    res
      .status(200)
      .json({ message: "Login successful", userId, userName, userFavorites });
  } else {
    res.status(401).send("Invalid credentials");
  }
});
app.post("/conversionHistory", async (req, res) => {
  try {
    const { userID, newConversion } = req.body;
    const user = await db
      .collection("User")
      .findOne({ _id: new ObjectId(`${userID}`) });

    if (user) {
      const conversionHistory = user.conversionHistory;
      conversionHistory.push(newConversion);
      var myquery = { _id: new ObjectId(`${userID}`) };
      var newvalues = { $set: { conversionHistory } };
      const response = await db
        .collection("User")
        .updateOne(myquery, newvalues);

      if (response.modifiedCount === 0) {
        res
          .status(404)
          .json({ message: "User not found or no update performed" });
      }
      res.status(200).json({ message: "Conversion history updated" });
    } else {
      console.log("Erro no get de user");
    }
  } catch (error) {
    if (error.req) {
      console.log("Error requisição: " + error.req.status + error.req.data);
    } else if (error.res) {
      console.log("Error resposta: " + error.res.status + error.res.data);
    } else {
      console.log("Erro desconhecido: " + error);
    }
  }
});
app.get("/favoriteCoinsPage", async (req, res) => {
  try {
    const { userID } = req.query;
    let favoriteCoins, currencies;
    const user = await db
      .collection("User")
      .findOne({ _id: new ObjectId(`${userID}`) });
    if (user) {
      favoriteCoins = user.favoriteCoins;
    }

    if (favoriteCoins) {
      res.status(200).send(favoriteCoins);
    }
  } catch (error) {
    console.log("Erro na requisição: " + error);
  }
});
app.put("/favoriteCoins", async (req, res) => {
  try {
    const { userID, favoriteCoins } = req.body;
    var myquery = { _id: new ObjectId(`${userID}`) };
    var newvalues = { $set: { favoriteCoins } };
    const result = await db.collection("User").updateOne(myquery, newvalues);
    console.log("Update result:", result);
    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json({ message: "User not found or no update performed" });
    }

    res.status(200).json({ message: "Favorite coins updated successfully" });
  } catch (error) {
    console.error("Error updating favoriteCoins:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
