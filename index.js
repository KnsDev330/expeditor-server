require('dotenv').config();
const express = require('express');
const cors = require('cors');
const JsonWebToken = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ExplainVerbosity, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.ijwja.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

// express middleware
app.use(cors());
app.use(express.json());

const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
client.connect(async err => {

    if (err) throw new Error('Cannot connect to Database'); // throw error if can't connect to database

    // collections
    const itemsCollection = client.db("expeditor").collection("items");
    const blogsCollection = client.db("expeditor").collection("blogs");

    // default response
    app.get('/', (req, res) => {
        res.send({ ok: true, data: 'Ok' });
    });

    // give a new jwt token
    app.post('/get-token', (req, res) => {
        const uid = req.body?.uid;
        if (!uid) return res.status(400).send({ ok: false, data: `userId invalid / not set` }); // end request if uid not set
        JsonWebToken.sign(
            { uid },
            process.env.JWT_SECRET, // secret for JWT
            (err, token) => {
                if (err) res.send({ ok: false, text: err.message });
                res.send({ ok: true, text: 'ok', token });
            }
        )
    });

    // get items
    app.post('/get-items', async (req, res) => {
        const uid = req.body?.uid;
        const jwt = req.body?.jwt;
        const myItems = req.body?.myItems;
        let query;
        if (uid) {
            // validate jwt
            try {
                if (!JsonWebToken.verify(jwt, process.env.JWT_SECRET)) return res.status(400).send({ ok: false, text: `Invalid jwt token` });
            } catch (error) {
                return res.status(500).send({ ok: false, text: error.message });
            }
            if (myItems) query = { user: uid }; // if requested from my items
            else query = { $or: [{ user: '*' }, { user: uid }] } // if requested from manage inventories
        } else {
            query = { user: '*' } // default
        }
        const page = req.body?.page || 0;
        const limit = req.body?.limit || 10;
        const items = await itemsCollection.find(query).skip(page * limit).limit(limit).toArray();
        const result = { ok: true, text: 'success', items }
        res.send(result);
    });


    // get blogs
    app.post('/get-blogs', async (req, res) => {
        const blogs = await blogsCollection.find({}).toArray();
        const response = { ok: true, text: `success`, blogs }
        res.send(response);
    });

    // get single item details
    app.post('/get-item', async (req, res) => {
        const uid = req.body?.uid;
        const jwt = req.body?.jwt;
        const id = req.body?.id;
        if (!id || !jwt || !uid) res.status(400).send({ ok: false, text: `invalid userId / jwt / id` });

        // validate jwt
        try {
            if (!JsonWebToken.verify(jwt, process.env.JWT_SECRET)) return res.status(401).send({ ok: false, text: `invalid jwt token` });
        } catch (error) {
            return res.status(500).send({ ok: false, text: error.message });
        }

        const item = await itemsCollection.findOne({ _id: ObjectId(id) });
        if (item.user !== '*' && item.user !== uid) return res.status(401).send({ ok: false, text: `unauthorized` });
        const response = { ok: true, text: `success`, item }
        res.send(response);
    });


    // update item details
    app.post('/update-item', async (req, res) => {
        const uid = req.body?.uid;
        const jwt = req.body?.jwt;
        const id = req.body?.id;
        const restock = req.body?.restock;
        if (restock) if (Number(restock) < 0) return res.status(400).send({ ok: false, text: `no negative amount please` });
        if (!id || !jwt || !uid) return res.status(400).send({ ok: false, text: `invalid userId / jwt / id` });

        // validate jwt
        try {
            if (!JsonWebToken.verify(jwt, process.env.JWT_SECRET)) return res.status(400).send({ ok: false, text: `invalid jwt token` });
        } catch (error) {
            return res.status(500).send({ ok: false, text: error.message });
        }

        // validate
        const checkItem = await itemsCollection.findOne({ _id: ObjectId(id) });
        if (checkItem.user !== '*' && checkItem.user !== uid) return res.status(401).send({ ok: false, text: `unauthorized` }); // error if quatity not enough
        if (!restock) if (checkItem.quantity <= 0) return res.status(400).send({ ok: false, text: `item quantity too short` }); // error if quatity not enough

        const updateQuery = restock ? { $inc: { quantity: Number(restock) } } : { $inc: { sold: 1, quantity: -1 } };
        await itemsCollection.findOneAndUpdate({ _id: ObjectId(id) }, updateQuery, { upsert: false });
        res.send({ ok: true, text: 'ok' });
    });


    // add new item
    app.post('/add-item', async (req, res) => {
        const uid = req.body?.uid;
        const jwt = req.body?.jwt;
        const item = req.body?.item;
        if (!item || !jwt || !uid) return res.send({ ok: false, text: `invalid userId / jwt / item` });
        // validate jwt
        try {
            if (!JsonWebToken.verify(jwt, process.env.JWT_SECRET)) return res.status(400).send({ ok: false, text: `invalid jwt token` });
        } catch (error) {
            return res.status(500).send({ ok: false, text: error.message });
        }
        item.user = uid;
        const cursor = itemsCollection.insertOne(item);
        const result = await cursor;
        result.ok = true;
        result.text = "item added";
        res.send(result);
    });

    // delete item
    app.post('/delete-item', async (req, res) => {
        const uid = req.body?.uid;
        const jwt = req.body?.jwt;
        const id = req.body?.id;
        if (!id || !jwt || !uid) return res.send({ ok: false, text: `invalid userId / jwt / itemId` });

        // validate jwt
        try {
            if (!JsonWebToken.verify(jwt, process.env.JWT_SECRET)) return res.status(400).send({ ok: false, text: `invalid jwt token` });
        } catch (error) {
            return res.status(500).send({ ok: false, text: error.message });
        }

        // check if user has permission to delete
        const item = await itemsCollection.findOne({ _id: ObjectId(id) });
        if (item.user === "*" || item.user === uid) {
            const result = await itemsCollection.deleteOne({ _id: ObjectId(id) });
            result.ok = true;
            result.text = "deleted successfully";
            res.send(result);
        } else {
            res.status(401).send({ ok: false, text: `unauthorized request` });
        }
    });


    // get items count
    app.post('/get-items-count', async (req, res) => {
        const uid = req.body?.uid;
        let query;
        if (uid) query = { $or: [{ user: '*' }, { user: uid }] }
        else query = { user: '*' }
        const count = await itemsCollection.countDocuments(query);
        res.send({ ok: true, count });
    });


    // start server
    app.listen(PORT, () => {
        console.log(`SERVER IS RUNNING ON PORT: ${PORT}`);
    });

});

