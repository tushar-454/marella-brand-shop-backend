const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 4000;
const cookieParser = require('cookie-parser');
const stripe = require('stripe')(process.env.STRIPE_SERECT_KEY);
const jwt = require('jsonwebtoken');

// middleware
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);
app.use(cookieParser());
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
    const allUsersCollection = brandShopDB.collection('users');

    const verifyUser = async (req, res, next) => {
      const token = req?.cookies?.token;
      if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const decode = jwt.verify(token, process.env.JWT_SERECT_KEY);
      const user = await allUsersCollection.findOne({ email: decode.email });
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      req.user = decode;
      next();
    };

    app.get('/users', async (req, res) => {
      const result = await allUsersCollection.find().toArray();
      res.send(result);
    });

    app.post('/users', async (req, res) => {
      const { email } = req.body;
      console.log(email);
      const result = await allUsersCollection.insertOne({ email });
      res.send({ message: 'success' });
    });

    // jwt token related api
    app.post('/jwt-token', async (req, res) => {
      const userInfo = req.body;
      const token = jwt.sign(userInfo, process.env.JWT_SERECT_KEY, {
        expiresIn: '1h',
      });
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      });
      res.send({ success: true });
    });

    // remove token
    app.get('/remove-token', async (req, res) => {
      res.clearCookie('token', {
        maxAge: 0,
        secure: true,
        sameSite: 'none',
      });
      res.send({ success: true });
    });

    // get cart data from cart collection
    app.get('/carts', verifyUser, async (req, res) => {
      const cursor = await addToCartCollection.find().toArray();
      res.send(cursor);
    });

    app.get('/payment-history', verifyUser, async (req, res) => {
      const { uid } = req.query;
      const query = {};
      if (uid) {
        query.uid = uid;
      }
      const result = await allPaymentCollection.find(query).toArray();
      res.send(result);
    });

    // delete cart item from database
    app.delete('/carts/:uid/:productId', verifyUser, async (req, res) => {
      try {
        const { uid, productId } = req.params;
        const filter = { _id: new ObjectId(productId), uid: uid };
        const result = await addToCartCollection.deleteOne(filter);
        res.send(result);
      } catch (error) {
        res.send({ message: 'error' });
      }
    });

    // add a product in database
    app.post('/product', verifyUser, async (req, res) => {
      const productObj = req.body;
      const result = await productsCollection.insertOne(productObj);
      res.send(result);
    });

    // all products get api end point
    app.get('/products', verifyUser, async (req, res) => {
      const cursor = await productsCollection.find().toArray();
      res.send(cursor);
    });

    // get product based on brand
    app.get('/brand/:brand', verifyUser, async (req, res) => {
      const { brand } = req.params;
      const query = { brand: brand.charAt(0).toUpperCase() + brand.slice(1) };
      const products = await productsCollection.find(query).toArray();
      // const brandProduct = products.filter(
      //   (product) => product.brand.toLowerCase() === brand
      // );
      res.send(products);
    });

    // get signle product based on product id
    app.get('/:productId', verifyUser, async (req, res) => {
      const { productId } = req.params;
      const query = { _id: new ObjectId(productId) };
      const product = await productsCollection.find(query).toArray();
      res.send(product);
    });

    // update signle product based on product id
    app.put('/update-product/:productId', verifyUser, async (req, res) => {
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
    app.post('/carts', verifyUser, async (req, res) => {
      const cartProduct = req.body;
      const result = await addToCartCollection.insertOne(cartProduct);
      res.send(result);
    });

    // payment intent
    app.post('/create-payment-intent', verifyUser, async (req, res) => {
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

    app.post('/payments', verifyUser, async (req, res) => {
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
