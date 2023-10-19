const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 4000;

// middleware
const corsConfig = {
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@karim.mjbii6i.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const brandShopDB = client.db('brandShopDB');
    const productsCollection = brandShopDB.collection('products');

    // add a product in database
    app.post('/product', async (req, res) => {
      const productObj = req.body;
      const result = await productsCollection.insertOne(productObj);
      res.send(result);
    });

    // all products get api end point
    app.get('/products', async (req, res) => {
      const cursor = await productsCollection.find().toArray();
      res.send(cursor);
    });

    // get product based on brand
    app.get('/brand/:brand', async (req, res) => {
      const { brand } = req.params;
      const products = await productsCollection.find().toArray();
      const brandProduct = products.filter(
        (product) => product.brand.toLowerCase() === brand
      );
      res.send(brandProduct);
    });

    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('<h1>Api is working fine</h1>');
});

app.listen(port, () => {
  console.log(`Server is running http://localhost:${port}`);
});
