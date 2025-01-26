import { app } from "./index";
import { enka } from "./index";
import { EnkaClient, ArtifactSet } from "enka-network-api";
import { dbInsertUserBuild, dbInsertUserArtifact } from "./db";

export function routes() {
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

    // app.get("/u", async (req, res) => {
    //     const builds = req.body;

    //     const parsedBuilds = builds.map((b: any) => {
    //         return {
    //             u_id: uid,
    //             c_id: b.attributes.c_id,
    //             w_id: b.weapon.w_id,
    //             a_id1_flower: b.artifacts[0].a_id,
    //             a_id2_feather: b.artifacts[1].a_id,
    //             a_id3_sands: b.artifacts[2].a_id,
    //             a_id4_goblet: b.artifacts[3].a_id,
    //             a_id5_circlet: b.artifacts[4].a_id,
    //         };
    //     });

    //     for (let i = 0; i < builds.length; i++) {
    //         dbInsertBuild(builds[i]);
    //     }

    //     res.json({ message: "builds loaded successfully" });
    // });

    async function parseBuilds(uid: number, builds: any) {
        const parsedBuilds = await Promise.all(
            builds.map(async (b: any) => {
                return {
                    u_id: uid,
                    c_id: b.attributes.c_id,
                    w_id: b.weapon.w_id,
                    a1_flower: await parseArtifact(uid, b.artifacts[0]),
                    a2_feather: await parseArtifact(uid, b.artifacts[1]),
                    a3_sands: await parseArtifact(uid, b.artifacts[2]),
                    a4_goblet: await parseArtifact(uid, b.artifacts[3]),
                    a5_circlet: await parseArtifact(uid, b.artifacts[4]),
                    // a_id1_flower: b.artifacts[0].a_id,
                    // a_id2_feather: b.artifacts[1].a_id,
                    // a_id3_sands: b.artifacts[2].a_id,
                    // a_id4_goblet: b.artifacts[3].a_id,
                    // a_id5_circlet: b.artifacts[4].a_id,
                };
            })
        );

        for (let i = 0; i < parsedBuilds.length; i++) {
            await dbInsertUserBuild(parsedBuilds[i]);
        }
    }

    async function parseArtifact(uid: number, artifact: any) {
        const parsedArtifact = {
            u_id: uid,
            a_id: artifact.a_id,
            mainstat: {
                prop: artifact.mainstat.prop,
                value: artifact.mainstat.value,
            },
            substats: artifact.substats.map((substat: any) => ({
                prop: substat.prop,
                value: substat.value,
            })),
        };

        const userArtifactId = await dbInsertUserArtifact(parsedArtifact);
        return userArtifactId;
    }
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
                c_id: c.characterData.id,
                name: c.characterData.name.get(),
                level: c.level,
                maxLevel: c.maxLevel,
                friendship: c.friendship,
                statsList: c.stats.statProperties.map((stats) => {
                    return ` - ${stats.fightPropName.get()}: ${
                        stats.valueText
                    }`;
                }),
            };

            // step 2: weapon
            const weapon = {
                w_id: c.weapon.weaponData.id,
                name: c.weapon.weaponData.name.get(),
                refinementRank: c.weapon.refinementRank,
                level: c.weapon.level,
                maxLevel: c.weapon.maxLevel,
                weaponStats: c.weapon.weaponStats.map((stat) => ({
                    prop: stat.fightPropName.get(),
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
                const a_id = a.artifactData.id;
                const mainstat = {
                    prop: a.mainstat.fightPropName.get(),
                    value: a.mainstat.value,
                };
                const substats = a.substats.total.map((s) => ({
                    prop: s.fightPropName.get(),
                    value: s.value,
                }));

                return {
                    a_id,
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

        parseBuilds(Number(uid.uid), data);
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
}
