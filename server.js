import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import { GridFsStorage } from "multer-gridfs-storage";
import Grid from "gridfs-stream";
import bodyParser from "body-parser";
import path from "path";
import Pusher from "pusher";
import Posts from "./postModel.js";

//app config
Grid.mongo = mongoose.mongo;
const app = express();
const port = process.env.PORT || 9000;
const connection_url =
    "mongodb+srv://brianho501:ib26wb3a42m4wBcl@cluster0.u8dl1bg.mongodb.net/?retryWrites=true&w=majority";

    /*
const pusher = new Pusher({
    appId: "1679582",
    key: "f83488526a6fabbdc69b",
    secret: "f8422ab7923717c12581",
    cluster: "us3",
    useTLS: true,
});
*/
const pusher = new Pusher({
    appId: "1675083",
    key: "b05a2aebe41bbe9b58dc",
    secret: "9d0610d491417f849b8a",
    cluster: "us2",
    useTLS: true,
});

//middleware
app.use(bodyParser.json());
app.use(cors());

//DB Config
const connection = mongoose.createConnection(connection_url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

let gfs;
let gridfsBucket;

// create a collection of images
connection.once("open", () => {
    console.log("DB Connected");
    gfs = Grid(connection.db, mongoose.mongo);
    gridfsBucket = new mongoose.mongo.GridFSBucket(connection.db, {
        bucketName: "images",
    });
    gfs.collection("images");
});

const storage = new GridFsStorage({
    url: connection_url,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            const filename = `image-${Date.now()}${path.extname(file.originalname)}`;
            const fileInfo = {
                filename: filename,
                bucketName: "images",
            };
            resolve(fileInfo);
        });
    },
});

const upload = multer({ storage });

mongoose.connect(connection_url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

mongoose.connection.once("open", () => {
    console.log("DB Connected for pusher");
    const changeStream = mongoose.connection.collection("posts").watch();
    changeStream.on("change", (change) => {
        console.log(change);
        if (change.operationType === "insert") {
            console.log("Trigerring Pusher");
            pusher.trigger("posts", "inserted", {
                change: change,
            });
        } else {
            console.log("Error trigerring Pusher");
        }
    });
});

//api routes
app.get("/", (req, res) => res.status(200).send("Hello TheWebDev"));

app.post("/upload/image", upload.single("file"), (req, res) => {
    res.status(201).send(req.file);
});

// https://www.mongodb.com/community/forums/t/unable-to-fetch-data-from-gridfs-when-the-api-is-getting-called-no-response-or-error-shown-working-on-this-for-last-few-weeks-have-tried-everything-that-is-possible-but-the-result-is-same/228172/4
app.get("/images/single", async (req, res) => {
    try {
        const file = await gfs.files.findOne({ filename: req.query.name });
        if (!file || file.length === 0) {
            res.status(404).json({ err: "file not found" });
        } else {
            const readstream = gridfsBucket.openDownloadStream(file._id);
            readstream.pipe(res);
        }
    } catch (e) {
        res.status(500).send(err);
    }
});

app.post("/upload/post", async (req, res) => {
    const post = new Posts(req.body);
    try {
        await post.save();
        res.status(201).send(post);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

app.get("/posts", async (req, res) => {
    try {
        const data = await Posts.find({});
        data.sort((b, a) => a.timestamp - b.timestamp);
        res.status(200).send(data);
    } catch (err) {
        res.status(500).send(err);
    }
});

//listen
app.listen(port, () => console.log(`Listening on localhost: ${port}`));
