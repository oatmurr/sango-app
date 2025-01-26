import sqlite3 from "sqlite3";
import { enka } from "./index";
import { Build, Artifact } from "./types";

const db = new sqlite3.Database("cinder.db");

const placeholder_url =
    "https://static.wikia.nocookie.net/gensin-impact/images/8/84/Unknown_Icon.png/revision/latest?cb=20220509204455";

/**
 * Initializes the database by creating necessary tables if they don't exist
 * and populating the characters table with data from the Enka API.
 * Tables created:
 * - characters: Stores character information (id, name, rarity, element, class)
 * - weapons: Stores weapon information (id, name, rarity, class)
 * - artifacts: Stores artifact information (id, name, rarity, type, set)
 * - users: Stores user information (id, nickname)
 * - builds: Stores character builds with relationships to other tables
 */
export function dbInit() {
    db.serialize(() => {
        db.run(
            "CREATE TABLE IF NOT EXISTS characters (id INTEGER PRIMARY KEY AUTOINCREMENT, c_id INTEGER, name TEXT, icon_url TEXT, rarity INTEGER, element TEXT, c_class TEXT)"
        );

        db.run(
            "CREATE TABLE IF NOT EXISTS weapons (id INTEGER PRIMARY KEY AUTOINCREMENT, w_id INTEGER, name TEXT, icon_url TEXT, rarity INTEGER, w_class TEXT)"
        );

        db.run(
            "CREATE TABLE IF NOT EXISTS artifacts (id INTEGER PRIMARY KEY AUTOINCREMENT, a_id INTEGER, name TEXT, icon_url TEXT, rarity INTEGER, a_type TEXT, a_set TEXT)"
        );

        db.run(
            "CREATE TABLE IF NOT EXISTS users (u_id INTEGER PRIMARY KEY, nickname TEXT)"
        );

        db.run(
            `CREATE TABLE IF NOT EXISTS user_artifacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                u_id INTEGER,
                a_id INTEGER,
                mainstat_prop TEXT,
                mainstat_value REAL,
                substat1_prop TEXT,
                substat1_value REAL,
                substat2_prop TEXT,
                substat2_value REAL,
                substat3_prop TEXT,
                substat3_value REAL,
                substat4_prop TEXT,
                substat4_value REAL,
                FOREIGN KEY (u_id) REFERENCES users(u_id),
                FOREIGN KEY (a_id) REFERENCES artifacts(a_id)
            )`
        );

        db.run(
            `CREATE TABLE IF NOT EXISTS user_builds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                u_id INTEGER,
                c_id INTEGER,
                w_id INTEGER,
                a1_flower INTEGER,
                a2_feather INTEGER,
                a3_sands INTEGER,
                a4_goblet INTEGER,
                a5_circlet INTEGER,
                FOREIGN KEY (u_id) REFERENCES users(u_id),
                FOREIGN KEY (c_id) REFERENCES characters(c_id),
                FOREIGN KEY (w_id) REFERENCES weapons(w_id),
                FOREIGN KEY (a1_flower) REFERENCES user_artifacts(id),
                FOREIGN KEY (a2_feather) REFERENCES user_artifacts(id),
                FOREIGN KEY (a3_sands) REFERENCES user_artifacts(id),
                FOREIGN KEY (a4_goblet) REFERENCES user_artifacts(id),
                FOREIGN KEY (a5_circlet) REFERENCES user_artifacts(id)
            )`
        );

        const character = enka.getAllCharacters();
        character.forEach((c) => {
            db.get(
                "SELECT name FROM characters WHERE name = (?)",
                [c.name.get()],
                (err, row) => {
                    if (err) {
                        console.error(err.message);
                        return;
                    }
                    if (!row) {
                        if (c.element && c.weaponType) {
                            dbInsertCharacter(
                                c.id,
                                c.name.get(),
                                c.icon.url || placeholder_url,
                                c.stars,
                                c.element.toString(),
                                c.weaponType
                            );
                        }
                    }
                }
            );
        });

        const weapon = enka.getAllWeapons();
        weapon.forEach((w) => {
            db.get(
                "SELECT name FROM weapons WHERE name = (?)",
                [w.name.get()],
                (err, row) => {
                    if (err) {
                        console.error(err.message);
                        return;
                    }
                    if (!row) {
                        dbInsertWeapon(
                            w.id,
                            w.name.get(),
                            w.icon.url || placeholder_url,
                            w.stars,
                            w.weaponType
                        );
                    }
                }
            );
        });

        const artifact = enka.getAllArtifacts();
        artifact.forEach((a) => {
            db.get(
                "SELECT name FROM artifacts WHERE name = (?)",
                [a.name.get()],
                (err, row) => {
                    if (err) {
                        console.error(err.message);
                        return;
                    }
                    if (!row) {
                        dbInsertArtifact(
                            a.id,
                            a.name.get(),
                            a.icon.url || placeholder_url,
                            a.stars,
                            a.equipType,
                            a.set.name.get()
                        );
                    }
                }
            );
        });
    });
}

export function dbInsertCharacter(
    c_id: number,
    name: string,
    icon_url: string,
    rarity: number,
    element: string,
    c_class: string
) {
    console.log(name, icon_url);
    db.serialize(() => {
        db.run(
            "INSERT INTO characters (c_id, name, icon_url, rarity, element, c_class) VALUES (?, ?, ?, ?, ?, ?)",
            c_id,
            name,
            icon_url,
            rarity,
            element,
            c_class
        );
    });
}

export function dbInsertWeapon(
    w_id: number,
    name: string,
    icon_url: string,
    rarity: number,
    w_class: string
) {
    db.serialize(() => {
        db.run(
            "INSERT INTO weapons (w_id, name, icon_url, rarity, w_class) VALUES (?, ?, ?, ?, ?)",
            w_id,
            name,
            icon_url,
            rarity,
            w_class
        );
    });
}

export function dbInsertArtifact(
    a_id: number,
    name: string,
    icon_url: string,
    rarity: number,
    a_type: string,
    a_set: string
) {
    db.serialize(() => {
        db.run(
            "INSERT INTO artifacts (a_id, name, icon_url, rarity, a_type, a_set) VALUES (?, ?, ?, ?, ?, ?)",
            a_id,
            name,
            icon_url,
            rarity,
            a_type,
            a_set
        );
    });
}

export function dbInsertUser(u_id: number, nickname: string) {
    db.serialize(() => {
        db.run(
            "INSERT INTO users (u_id, nickname) VALUES (?, ?)",
            u_id,
            nickname
        );
    });
}

export function dbInsertUserBuild(build: Build) {
    //console.log(JSON.stringify(build.w_id));
    db.serialize(() => {
        db.run(
            "INSERT INTO user_builds (u_id, c_id, w_id, a1_flower, a2_feather, a3_sands, a4_goblet, a5_circlet) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            build.u_id,
            build.c_id,
            build.w_id,
            build.a1_flower,
            build.a2_feather,
            build.a3_sands,
            build.a4_goblet,
            build.a5_circlet
        );
    });
}

export function dbInsertUserArtifact(artifact: Artifact): Promise<number> {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(
                `INSERT INTO user_artifacts (
                    u_id,
                    a_id,
                    mainstat_prop,
                    mainstat_value,
                    substat1_prop,
                    substat1_value,
                    substat2_prop,
                    substat2_value,
                    substat3_prop,
                    substat3_value,
                    substat4_prop,
                    substat4_value
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    artifact.u_id,
                    artifact.a_id,
                    artifact.mainstat.prop,
                    artifact.mainstat.value,
                    artifact.substats[0]?.prop || null,
                    artifact.substats[0]?.value || null,
                    artifact.substats[1]?.prop || null,
                    artifact.substats[1]?.value || null,
                    artifact.substats[2]?.prop || null,
                    artifact.substats[2]?.value || null,
                    artifact.substats[3]?.prop || null,
                    artifact.substats[3]?.value || null,
                ],

                // return last inserted user_artifact id (should be the one that this function just inserted)
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                }
            );
        });
    });
}
