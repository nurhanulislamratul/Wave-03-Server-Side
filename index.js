const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 3000;

const app = express();

// collections

// middlewares
app.use(cors());
app.use(express.json());

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "authorization prohibited" });
    }
    req.decoded = decoded;
    next();
  });
};

const verifySeller = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollections.findOne(query);
  if (user?.role !== "seller") {
    return res.status(403).send({ message: "Forbidden access" });
  }
  next();
};

const verifyBuyer = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollections.findOne(query);
  if (user.role !== "buyer") {
    return res.status(403).send({ message: "Unauthorized access" });
  }
  next();
};
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollections.findOne(query);
  if (user.role !== "admin") {
    return res.status(403).send({ message: "Unauthorized access" });
  }
  next();
};

app.get("/", (req, res) => {
  res.send("Server is running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.knlt5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const userCollections = client.db("coolWave").collection("users");
const productsCollections = client.db("coolWave").collection("products");

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // COLLECTIONS

    // APIS

    // AUTHORIZATION
    app.post("/jwt", async (req, res) => {
      const email = req.body.email;
      const token = jwt.sign({ email }, process.env.TOKEN_SECRET, {
        expiresIn: "10h",
      });
      res.send(token);
    });
    // GET SINGLE USER
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollections.findOne({ email });
      res.send(result);
    });
    // GET SPECIFIC SELLER ADDED PRODUCTS
    app.get("/products/:email", async (req, res) => {
      const email = req.params.email;
      const query = { sellerEmail: email };
      const result = await productsCollections.find(query).toArray();
      res.send(result);
    });
    // GET PRODUCT BASED ON ID
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollections.findOne(query);
      res.send(result);
    });
    // GET ALL PRODUCTS FOR PRODUCT PAGE
    app.get("/products", verifyToken, async (req, res) => {
      const { search, brand, category, sorting } = req.query;
      const query = {};
      // return console.log({ search, brand, category, sorting });
      if (search) {
        query.title = { $regex: search, $options: "i" };
      }
      if (category) {
        query.category = { $regex: category, $options: "i" };
      }
      if (brand) {
        query.brand = { $regex: brand, $options: "i" };
      }
      const sortingOptions = sorting === "asc" ? 1 : -1;

      const result = await productsCollections
        .find(query)
        .sort({ priceInt: sortingOptions })
        .toArray();
      res.send(result);
    });
    // GET USERS WISHLIST ITEMS
    app.get(
      "/wishlist-items/:id",
      verifyToken,
      verifyBuyer,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const user = await userCollections.findOne(query);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        const wishlistIds = user.wishList || [];
        if (wishlistIds.length === 0) {
          return res.status(200).send({ message: "No Items In wishlists" });
        }
        const products = await productsCollections
          .find({
            _id: { $in: wishlistIds },
          })
          .toArray();

        res.send(products);
      }
    );
    // GET USERS CART ITEMS
    app.get("/cart-items/:id", verifyToken, verifyBuyer, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const user = await userCollections.findOne(query);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const cartIds = user.cart || [];
      if (cartIds.length === 0) {
        return res.status(200).send({ message: "No Items In Cart" });
      }
      const products = await productsCollections
        .find({
          _id: { $in: cartIds },
        })
        .toArray();

      res.send(products);
    });

    // UPDATE A SPECIFIC PRODUCT
    app.patch(
      "/update-product/:id",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const id = req.params.id;
        const productData = req.body;
        const query = { _id: new ObjectId(id) };
        const options = { upsert: true };
        const updatedDoc = {
          $set: {
            sellerEmail: productData.sellerEmail,
            brand: productData.brand,
            category: productData.category,
            title: productData.title,
            stockInt: productData.stockInt,
            priceInt: productData.priceInt,
            photo: productData.photo,
            description: productData.description,
          },
        };
        const result = await productsCollections.updateOne(
          query,
          updatedDoc,
          options
        );
        res.send(result);
      }
    );

    // ADD TO BUYERS WISHLIST
    app.patch("/wishlist/add", verifyToken, verifyBuyer, async (req, res) => {
      const { email, productId } = req.body;
      if (!email || !productId) {
        return res
          .status(400)
          .send({ error: "Email and Product ID are required" });
      }
      const query = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $addToSet: { wishList: new ObjectId(String(productId)) },
      };

      const result = await userCollections.updateOne(
        query,
        updatedDoc,
        options
      );
      res.send(result);
    });
    app.patch("/cart/add", verifyToken, verifyBuyer, async (req, res) => {
      const { email, productId } = req.body;
      if (!email || !productId) {
        return res
          .status(400)
          .send({ error: "Email and Product ID are required" });
      }
      const query = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $addToSet: { cart: new ObjectId(String(productId)) },
      };

      const result = await userCollections.updateOne(
        query,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // GET ALL THE USERS FOR ADMIN
    app.get("/users", verifyToken, async (req, res) => {
      const result = await userCollections.find().toArray();
      res.send(result);
    });

    // INSERT USER INFO
    app.post("/users", async (req, res) => {
      const userData = req.body;
      const query = { email: userData.email };
      const isRemaining = await userCollections.findOne(query);
      if (isRemaining) {
        return res.send({ message: "user already exists" });
      }
      const result = await userCollections.insertOne(userData);
      res.send(result);
    });
    // INSERT PRODUCT INTO DATABASE
    app.post("/add-product", verifyToken, async (req, res) => {
      const product = req.body;
      const result = await productsCollections.insertOne(product);
      res.send(result);
    });

    // APPROVE A SELLER
    app.patch("/approveSeller/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await userCollections.updateOne(query, updatedDoc);
      res.send(result);
    });

    // DELETE PRODUCT FROM SELLER DASHBOARD
    app.delete("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollections.deleteOne(query);
      res.send(result);
    });
    // DELETE A SINGLE USER
    app.delete("/user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollections.deleteOne(query);
      res.send(result);
    });

    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});