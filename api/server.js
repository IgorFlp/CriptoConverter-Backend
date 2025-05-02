import express from "express";
import { db } from "./connect.js";
import { ObjectId } from "mongodb";
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
app.get("/currency", async (req, res) => {
  const { id, currency } = req.query;
  if (id && currency) {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&ids=${id}`;
    const params = {
      accept: "application/json",
      "x-cg-pro-api-key": GECKO_API_KEY,
    };
    const response = await axios.get(url, params);
    res.send(response.data);
  } else {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd`;
    const params = {
      accept: "application/json",
      "x-cg-pro-api-key": GECKO_API_KEY,
    };
    const response = await axios.get(url, params);
    const currencies = response.data.slice(0, 30);
    res.send(response.data);
  }

  // Fetch currencies from coingecko API
  //if currencies favorite in user collection, add favorite tag
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
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await db.collection("User").findOne({ email, password });
  const userId = user._id;
  const userName = user.username;
  const userFavorites = user.favoriteCoins;
  if (user) {
    res
      .status(200)
      .json({ message: "Login successful", userId, userName, userFavorites });
  } else {
    res.status(401).send("Invalid credentials");
  }
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
