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

    const user = await enka.fetchUser(uid.uid);

    const characters = user.characters;

    if (characters.length === 0) {
        res.json({ message: "no characters found" });
        return;
    }

    // yuko1101 artifactStatsAndSetBonuses.js

    // crit multipliers
    const critMultipliers: { [key: string]: number } = {
        // crit rate
        FIGHT_PROP_CRITICAL: 2,
        // crit dmg
        FIGHT_PROP_CRITICAL_HURT: 1,
    };

    const data = characters.map((c) => {
        const name = c.characterData.name.get();
        const artifacts = c.artifacts;

        // get mainstats and substats of all five artifacts for this character
        const mainstats = artifacts.map((a) => a.mainstat);
        const substats = artifacts.flatMap((a) => a.substats.total);

        // calculate crit value
        const critValue = [...mainstats, ...substats]
            .filter((stat) =>
                Object.keys(critMultipliers).includes(stat.fightProp)
            )
            .map(
                (stat) =>
                    stat.getMultipliedValue() *
                    (critMultipliers[stat.fightProp] || 0)
            )
            .reduce((a, b) => a + b);

        // round crit value to 3 decimal places
        const roundedCritValue = parseFloat(critValue.toFixed(3));

        return {
            name,
            roundedCritValue,
        };
    });

    // const data = {
    //     level: user.level,
    //     nickname: user.nickname,
    //     worldLevel: user.worldLevel,
    // };

    res.json(data);
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
