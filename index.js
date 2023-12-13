const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 4000;
const stripe = require('stripe')(process.env.STRIPE_SERECT_KEY);

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
    const addToCartCollection = brandShopDB.collection('carts');
    const allPaymentCollection = brandShopDB.collection('payments');

    // get cart data from cart collection
    app.get('/carts', async (req, res) => {
      const cursor = await addToCartCollection.find().toArray();
      res.send(cursor);
    });

    app.get('/payment-history', async (req, res) => {
      const { uid } = req.query;
      const query = {};
      if (uid) {
        query.uid = uid;
      }
      const result = await allPaymentCollection.find(query).toArray();
      res.send(result);
    });

    // delete cart item from database
    app.delete('/carts/:uid/:productId', async (req, res) => {
      const { uid, productId } = req.params;
      const filter = { _id: new ObjectId(productId), uid: uid };
      const result = await addToCartCollection.deleteOne(filter);
      res.send(result);
    });

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
      const query = { brand: brand.charAt(0).toUpperCase() + brand.slice(1) };
      const products = await productsCollection.find(query).toArray();
      // const brandProduct = products.filter(
      //   (product) => product.brand.toLowerCase() === brand
      // );
      res.send(products);
    });

    // get signle product based on product id
    app.get('/:productId', async (req, res) => {
      const { productId } = req.params;
      const query = { _id: new ObjectId(productId) };
      const product = await productsCollection.find(query).toArray();
      res.send(product);
    });

    // update signle product based on product id
    app.put('/update-product/:productId', async (req, res) => {
      const { productId } = req.params;
      const updateProduct = req.body;
      const query = { _id: new ObjectId(productId) };
      const options = { upsert: true };
      const productWithUpdataData = {
        $set: {
          proName: updateProduct.proName,
          brand: updateProduct.brand,
          category: updateProduct.category,
          price: updateProduct.price,
          rating: updateProduct.rating,
          photoUrl: updateProduct.photoUrl,
          desc: updateProduct.desc,
        },
      };
      const product = await productsCollection.updateOne(
        query,
        productWithUpdataData,
        options
      );
      res.send(product);
    });

    // post cart product in database
    app.post('/carts', async (req, res) => {
      const cartProduct = req.body;
      const result = await addToCartCollection.insertOne(cartProduct);
      res.send(result);
    });

    // payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post('/payments', async (req, res) => {
      const { payment } = req.body;
      const paymentResult = await allPaymentCollection.insertOne(payment);

      // delete each item from cart
      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };
      const deleteResult = await addToCartCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
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
