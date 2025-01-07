import express from "express";
import { EnkaClient, ArtifactSet } from "enka-network-api";
import fs from "fs";
import { dbInit } from "./db";
import sqlite3 from "sqlite3";

export const enka = new EnkaClient({ showFetchCacheLog: true }); // showFetchCacheLog is true by default

enka.cachedAssetsManager.fetchAllContents(); // returns promise
enka.cachedAssetsManager.refreshAllData();

const app = express();
const port = 3000;

dbInit();

// https://enka-network-api.vercel.app/docs
// enka.cachedAssetsManager.activateAutoCacheUpdater({
//     instant: true, // Run the first update check immediately
//     timeout: 60 * 60 * 1000, // 1 hour interval
//     onUpdateStart: async () => {
//         console.log("Updating Genshin Data...");
//     },
//     onUpdateEnd: async () => {
//         enka.cachedAssetsManager.refreshAllData(); // Refresh memory
//         console.log("Updating Completed!");
//     },
// });

app.get("/fetch-characters", (req, res) => {
    const characters = enka.getAllCharacters();

    const data = characters.map((c) => ({
        name: c.name.get(),
        id: c.id,
        element: c.element ? c.element.name.get() : null,
        weaponType: c.weaponType,
    }));

    res.send(data);
});

app.get("/fetch-weapons", (req, res) => {
    const weapons = enka.getAllWeapons();

    const data = weapons.map((w) => ({
        name: w.name.get(),
        id: w.id,
        type: w.weaponType,
    }));

    res.send(data);
});

app.get("/fetch-artifacts", (req, res) => {
    const artifacts = enka.getAllArtifacts();

    const data = artifacts.map((a) => ({
        name: a.name.get(),
        type: a.equipType,
        id: a.id,
        set: a.set.name.get(),
    }));

    res.send(data);
});

app.get("/u/:uid", async (req, res) => {
    // step -1: fetch user data
    const uid = req.params;
    const user = await enka.fetchUser(uid.uid);

    // step 0: get characters
    const characters = user.characters;

    // testing
    // const c = characters[9];

    if (characters.length === 0) {
        res.json({ message: "no characters found" });
        return;
    }

    // yuko1101 artifactStatsAndSetBonuses.js

    const data = characters.map((c) => {
        // step 1: attributes
        const attributes = {
            name: c.characterData.name.get(),
            level: c.level,
            maxLevel: c.maxLevel,
            friendship: c.friendship,
            statsList: c.stats.statProperties.map((stats) => {
                return ` - ${stats.fightPropName.get()}: ${stats.valueText}`;
            }),
        };

        // step 2: weapon
        const weapon = {
            name: c.weapon.weaponData.name.get(),
            refinementRank: c.weapon.refinementRank,
            level: c.weapon.level,
            maxLevel: c.weapon.maxLevel,
            weaponStats: c.weapon.weaponStats.map((stat) => ({
                prop: stat.fightProp,
                value: stat.value,
            })),
        };

        // step 3: artifacts

        // get active set bonuses for the entire set of artifacts
        const setBonuses = ArtifactSet.getActiveSetBonus(c.artifacts);
        const activeBonuses = setBonuses
            .filter((set) => set.activeBonus.length > 0)
            .flatMap((set) => set.activeBonus)
            .map((bonus) => ({
                description: bonus.description.get(),
            }));

        const artifacts = c.artifacts.map((a) => {
            const mainstat = {
                prop: a.mainstat.fightProp,
                value: a.mainstat.value,
            };
            const substats = a.substats.total.map((s) => ({
                prop: s.fightProp,
                value: s.value,
            }));

            return {
                mainstat,
                substats,
                activeBonuses,
            };
        });

        // step 4: constellation
        const constellation = c.unlockedConstellations.length;

        // step 5: talents - not working
        const skillLevels = c.skillLevels.map((t) => ({
            name: t.skill.name.get(),
            level: t.level,
        }));

        // extract unlocked passive talents
        const unlockedPassiveTalents = c.unlockedPassiveTalents
            .filter((t) => !t.isHidden)
            .map((t) => ({
                name: t.name.get(),
            }));

        // combine skill levels and unlocked passive talents
        const talents = {
            skillLevels,
            unlockedPassiveTalents,
        };

        // step 6: calculate crit value (for sorting) - copied from yuko
        const critMultipliers: { [key: string]: number } = {
            // crit rate
            FIGHT_PROP_CRITICAL: 2,
            // crit dmg
            FIGHT_PROP_CRITICAL_HURT: 1,
        };

        // mainstats and substats of all artifacts for this character for crit value calcs
        const mainstatsCV = c.artifacts.map((a) => a.mainstat);
        const substatsCV = c.artifacts.flatMap((a) => a.substats.total);

        let critValue = 0;

        // if there are artifacts equipped, calculate crit value
        if (mainstatsCV.length + substatsCV.length > 0) {
            critValue = [...mainstatsCV, ...substatsCV]
                .filter((stat) =>
                    Object.keys(critMultipliers).includes(stat.fightProp)
                )
                .map(
                    (stat) =>
                        stat.getMultipliedValue() *
                        (critMultipliers[stat.fightProp] || 0)
                )
                .reduce((a, b) => a + b);
        }

        // round crit value to 3 decimal places, the reason i am storing this separately is because this is how i eventually want to sort builds by.
        // const roundedCritValue = parseFloat(critValue.toFixed(3));

        return {
            attributes,
            weapon,
            constellation,
            artifacts,
            talents,
            critValue,
        };
    });

    // const data = {
    //     level: user.level,
    //     nickname: user.nickname,
    //     worldLevel: user.worldLevel,
    // };

    res.json(data);

    // write to json file
    // fs.writeFile(
    //     `user_${uid.uid}.json`,
    //     JSON.stringify(data, null, 2),
    //     (err) => {
    //         if (err) {
    //             console.error("error writing file:", err);
    //             return;
    //         }
    //         console.log("file written successfully");
    //         res.send(`User data saved to user_${uid.uid}.json`);
    //     }
    // );
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
