import express from "express";
import { EnkaClient } from "enka-network-api";

const enka = new EnkaClient({ showFetchCacheLog: true }); // showFetchCacheLog is true by default

const app = express();
const port = 3000;

app.get("/fetch-characters", (req, res) => {
    const characters = enka.getAllCharacters();

    const data = characters.map((c) => ({
        name: c.name.get(),
        element: c.element ? c.element.name.get() : null,
    }));

    res.send(data);
});

app.get("/fetch-weapons", (req, res) => {
    const weapons = enka.getAllWeapons();

    const data = weapons.map((w) => ({
        name: w.name.get(),
        type: w.weaponType,
    }));

    res.send(data);
});

app.get("/u/:uid", async (req, res) => {
    const uid = req.params;

    const userData = await enka.fetchUser(uid.uid);

    const data = {
        level: userData.level,
        nickname: userData.nickname,
        worldLevel: userData.worldLevel,
    };

    res.json(data);
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
