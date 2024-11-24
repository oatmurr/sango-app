import express, { Request, Response } from "express";
import { EnkaClient } from "enka-network-api";

const app = express();
const PORT = 3001;

// initialise EnkaClient
const enkaClient = new EnkaClient();

app.get("/fetch-user/:uid", async (req: Request, res: Response) => {
    const { uid } = req.params;

    try {
        // fetch user data from Enka API
        const userData = await enkaClient.fetchUser(uid);

        // log to console
        console.log("fetched user data", userData);

        // send response to client
        res.json(userData);
    } catch (error) {
        // log error to console
        console.error("error fetching user data", error);

        // send error response to client
        res.status(500).json("failed to fetch user data");
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
