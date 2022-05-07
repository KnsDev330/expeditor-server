require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ExplainVerbosity, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.ijwja.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

// express middleware
app.use(cors());
app.use(express.json());

const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
client.connect(async err => {

    // throw error if can't connect to database
    if (err) throw new Error('Cannot connect to Database');


    // default response
    app.get('/', (req, res) => {
        res.send({ ok: true, data: 'Ok' });
    });


    // give a new jwt token
    app.post('/get-token', (req, res) => {
        const uid = req.body?.uid;
        if (uid) {
            jwt.sign(
                { uid },
                process.env.JWT_SECRET, // secret for JWT
                (err, token) => {
                    if (err) res.send({ ok: false, data: err.message });
                    res.send({ ok: true, data: { token } });
                }
            )
        } else {
            res.send({ ok: false, data: `Access token invalid / not set` });
        }
    });


    // get items
    app.post('/get-items', async (req, res) => {
        const uid = req.body?.uid;
        let query;
        if (uid)
            query = { $or: [{ user: '*' }, { user: uid }] }
        else
            query = { user: '*' }
        const page = req.body?.page || 0;
        const limit = req.body?.limit || 10;
        const collection = client.db("expeditor").collection("items");
        const cursor = collection.find(query).skip(page * limit).limit(limit);
        const items = await cursor.toArray();
        res.send(items);
    });


    // get single item details
    app.post('/get-item', async (req, res) => {
        const uid = req.body?.uid;
        const jwt = req.body?.jwt;
        const id = req.body?.id;
        if (!id || !jwt || !uid) res.send({ ok: false, text: `Invalid userId / jwt / id` });
        const collection = client.db("expeditor").collection("items");
        const cursor = collection.findOne({ _id: ObjectId(id) });
        const item = await cursor;
        res.send(item);
    });


    // update item details
    app.post('/update-item', async (req, res) => {
        const uid = req.body?.uid;
        const jwt = req.body?.jwt;
        const id = req.body?.id;
        const restock = req.body?.restock;
        if (!id || !jwt || !uid) return res.send({ ok: false, text: `Invalid userId / jwt / id` });
        const collection = client.db("expeditor").collection("items");
        const updateQuery = restock ? { $inc: { quantity: Number(restock) } } : { $inc: { sold: 1, quantity: -1 } };
        const cursor = collection.findOneAndUpdate({ _id: ObjectId(id) }, updateQuery, { upsert: false });
        const item = await cursor;
        res.send(item);
    });


    // add new item
    app.post('/add-item', async (req, res) => {
        const uid = req.body?.uid;
        const jwt = req.body?.jwt;
        const item = req.body?.item;
        if (!item || !jwt || !uid) return res.send({ ok: false, text: `Invalid userId / jwt / item` });
        item.user = uid;
        const collection = client.db("expeditor").collection("items");
        const cursor = collection.insertOne(item);
        const result = await cursor;
        result.ok = true;
        result.text = "Item added successfully";
        res.send(result);
    });


    // get items count
    app.post('/get-items-count', async (req, res) => {
        const uid = req.body?.uid;
        let query;
        if (uid)
            query = { $or: [{ user: '*' }, { user: uid }] }
        else
            query = { user: '*' }
        const collection = client.db("expeditor").collection("items");
        const count = await collection.countDocuments(query);
        res.send({ ok: true, count });
    });


    // start server
    app.listen(PORT, () => {
        console.log(`SERVER IS RUNNING ON PORT: ${PORT}`);
    });

});

