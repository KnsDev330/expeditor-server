require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');

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
        const accessToken = req?.body?.accessToken;
        if (accessToken) {
            jwt.sign(
                { accessToken },
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
        const email = req?.body?.accessToken;
        let query;
        if (email)
            query = { $or: [{ user: '*' }, { user: email }] }
        else
            query = { user: '*' }
        // console.log(query)
        const page = req.body.page || 0;
        const limit = req.body.limit || 10;
        const skip = page * limit;
        const collection = client.db("expeditor").collection("items");
        const cursor = collection.find(query).skip(skip).limit(limit);
        const items = await cursor.toArray();
        console.log(req.body);
        res.send(items);
    });


    // start server
    app.listen(PORT, () => {
        console.log(`SERVER IS RUNNING ON PORT: ${PORT}`);
    });

});

