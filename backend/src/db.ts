import Database from "better-sqlite3";
import { EnkaClient } from "enka-network-api";
import { Build, Artifact } from "./types";

const db = new Database("sango.db");

const placeholder_url =
    "https://static.wikia.nocookie.net/gensin-impact/images/8/84/Unknown_Icon.png/revision/latest?cb=20220509204455";

// declare prepared statements
let dbSelectCharacterStmt: Database.Statement;
let dbSelectWeaponStmt: Database.Statement;
let dbSelectArtifactStmt: Database.Statement;
let dbInsertCharacterStmt: Database.Statement;
let dbInsertWeaponStmt: Database.Statement;
let dbInsertArtifactStmt: Database.Statement;
let dbInsertUserStmt: Database.Statement;
let dbInsertUserArtifactStmt: Database.Statement;
let dbInsertUserBuildStmt: Database.Statement;

/**
 * initialise database by creating creating and populating tables
 * - characters: stores character information (id, name, rarity, element, class)
 * - weapons: stores weapon information (id, name, rarity, class)
 * - artifacts: stores artifact information (id, name, rarity, type, set)
 * - users: stores user information (id, nickname)
 * - user_artifacts: stores user artifact information (id, artifact id, mainstat, substats)
 * - user_builds: stores user build information (id, character id, weapon id, USER artifacts)
 */
export function dbInit(enka: EnkaClient)
{
    // UNIQUE(c_id, element) is for handling duplicate traveler c_ids
    db.exec
    (
        `CREATE TABLE IF NOT EXISTS characters
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            c_id INTEGER UNIQUE,
            name TEXT,
            icon_url TEXT,
            rarity INTEGER,
            element TEXT,
            c_class TEXT
        )`
    );
    db.exec
    (
        `CREATE TABLE IF NOT EXISTS weapons
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            w_id INTEGER UNIQUE,
            name TEXT,
            icon_url TEXT,
            rarity INTEGER,
            w_class TEXT
        )`
    );
    db.exec
    (
        `CREATE TABLE IF NOT EXISTS artifacts
        (
            id INTEGER PRIMARY KEY AUTOINCREMENT,    
            a_id INTEGER UNIQUE,
            name TEXT,
            icon_url TEXT,
            rarity INTEGER,
            a_type TEXT,
            a_set TEXT
        )`
    );
    db.exec
    (
        `CREATE TABLE IF NOT EXISTS users
        (
            u_id INTEGER PRIMARY KEY,
            nickname TEXT
        )`
    );
    db.exec
    (
        `CREATE TABLE IF NOT EXISTS user_artifacts
        (
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
    db.exec
    (
        `CREATE TABLE IF NOT EXISTS user_builds
        (
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

    // prepare statements after tables are created
    prepareStatements();

    // populate tables with enka
    populateTables(enka);
}

function prepareStatements()
{
    dbSelectCharacterStmt = db.prepare
    (
        `SELECT name FROM characters WHERE name = ?`
    );
    dbSelectWeaponStmt = db.prepare
    (
        `SELECT name FROM weapons WHERE name = ?`
    );
    dbSelectArtifactStmt = db.prepare
    (
        `SELECT name FROM artifacts WHERE name = ?`
    );

    // IGNORE is to prevent duplicate travelers (temporary workaaround)
    dbInsertCharacterStmt = db.prepare
    (
        `INSERT OR IGNORE INTO characters
        (
            c_id, name, icon_url, rarity, element, c_class
        )
        VALUES (?, ?, ?, ?, ?, ?)`
    );
    dbInsertWeaponStmt = db.prepare
    (
        `INSERT INTO weapons
        (
            w_id, name, icon_url, rarity, w_class
        )
        VALUES (?, ?, ?, ?, ?)`
    );
    dbInsertArtifactStmt = db.prepare
    (
        `INSERT INTO artifacts
        (
            a_id, name, icon_url, rarity, a_type, a_set
        )
        VALUES (?, ?, ?, ?, ?, ?)`
    );
    dbInsertUserStmt = db.prepare
    (
        `INSERT INTO users
        (
            u_id, nickname
        )
        VALUES (?, ?)`
    );
    dbInsertUserArtifactStmt = db.prepare
    (
        `INSERT INTO user_artifacts
        (
            u_id,
            a_id,
            mainstat_prop, mainstat_value,
            substat1_prop, substat1_value,
            substat2_prop, substat2_value,
            substat3_prop, substat3_value,
            substat4_prop, substat4_value
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    dbInsertUserBuildStmt = db.prepare
    (
        `INSERT INTO user_builds
        (
            u_id,
            c_id,
            w_id,
            a1_flower, a2_feather, a3_sands, a4_goblet, a5_circlet
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
}

function populateTables(enka: EnkaClient)
{
    try
    {
        // populate characters table
        const characters = enka.getAllCharacters();
        characters.forEach((c) =>
        {
            const row = dbSelectCharacterStmt.get(c.name.get());
            if (!row)
            {
                if (c.element)
                {
                    dbInsertCharacterStmt.run(
                        c.id,
                        c.name.get(),
                        c.icon.url || placeholder_url,
                        c.stars,
                        c.element.name.get(),
                        c.weaponType
                    );
                }
            }
        });

        // populate weapons table
        const weapons = enka.getAllWeapons();
        weapons.forEach((w) =>
        {
            const row = dbSelectWeaponStmt.get(w.name.get());
            if (!row)
            {
                dbInsertWeaponStmt.run(
                    w.id,
                    w.name.get(),
                    w.icon.url || placeholder_url,
                    w.stars,
                    w.weaponType
                );
            }
        });

        // populate artifacts table
        const artifacts = enka.getAllArtifacts();
        artifacts.forEach((a) =>
        {
            const row = dbSelectArtifactStmt.get(a.name.get());
            if (!row)
            {
                dbInsertArtifactStmt.run(
                    a.id,
                    a.name.get(),
                    a.icon.url || placeholder_url,
                    a.stars,
                    a.equipType,
                    a.set.name.get()
                );
            }
        });
    }
    catch (error)
    {
        console.error("Error populating tables:", error);
    }

}

export function dbInsertCharacter
(
    c_id: number,
    name: string,
    icon_url: string,
    rarity: number,
    element: string,
    c_class: string
)
{
    console.log(name, icon_url);
    dbInsertCharacterStmt.run
    (
        c_id, name, icon_url, rarity,
        element, c_class
    );
}

export function dbInsertWeapon
(
    w_id: number,
    name: string,
    icon_url: string,
    rarity: number,
    w_class: string
)
{
    dbInsertWeaponStmt.run
    (
        w_id, name, icon_url, rarity,
        w_class
    );
}

export function dbInsertArtifact
(
    a_id: number,
    name: string,
    icon_url: string,
    rarity: number,
    a_type: string,
    a_set: string
)
{
    dbInsertArtifactStmt.run
    (
        a_id, name, icon_url, rarity,
        a_type, a_set
    );
}

export function dbInsertUser(u_id: number, nickname: string)
{
    dbInsertUserStmt.run
    (
        u_id, nickname
    );
}

export function dbInsertUserArtifact(artifact: Artifact): Promise<number>
{
    // wrapped in Promise so build creation doesn't attempt to reference artifacts before they are inserted
    return new Promise((resolve, reject) =>
    {
        try
        {
            const info = dbInsertUserArtifactStmt.run
            (
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
                artifact.substats[3]?.value || null
            );

            // return last inserted user_artifact id (should be the one that this function just inserted)
            resolve(info.lastInsertRowid as number);
        }
        catch (error)
        {
            console.error(error);
            reject(error);
        }
    });
}

export function dbInsertUserBuild(build: Build)
{
    dbInsertUserBuildStmt.run
    (
        build.u_id,
        build.c_id,
        build.w_id,
        build.a1_flower,
        build.a2_feather,
        build.a3_sands,
        build.a4_goblet,
        build.a5_circlet
    );
}