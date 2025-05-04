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
let dbFindExistingUserArtifactStmt: Database.Statement;
let dbFindExistingUserBuildStmt: Database.Statement;

/**
 * initialise database by creating creating and populating tables
 * - characters: stores character information (id, name, rarity, element, class)
 * - weapons: stores weapon information (id, name, rarity, class)
 * - artifacts: stores artifact information (id, name, rarity, type, set)
 * - users: stores user information (id, nickname)
 * - user_artifacts: stores user artifact information (id, artifact id, mainstat, substats)
 * - user_builds: stores user build information (id, character id, weapon id, USER artifacts)
 */
export async function dbInit(enka: EnkaClient)
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
    await populateTables(enka);
}

function prepareStatements()
{
    dbSelectCharacterStmt = db.prepare
    (
        `SELECT name FROM characters WHERE c_id = ?`
    );
    dbSelectWeaponStmt = db.prepare
    (
        `SELECT name FROM weapons WHERE w_id = ?`
    );
    dbSelectArtifactStmt = db.prepare
    (
        `SELECT name FROM artifacts WHERE a_id = ?`
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
        `INSERT OR REPLACE INTO users
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
    // need to check IS NULL separately because NULL = NULL doesn't return true
    dbFindExistingUserArtifactStmt = db.prepare
    (
        `SELECT id FROM user_artifacts 
        WHERE u_id = ? AND a_id = ? AND 
              mainstat_prop = ? AND mainstat_value = ? AND
              (substat1_prop IS NULL OR substat1_prop = ?) AND 
              (substat1_value IS NULL OR substat1_value = ?) AND
              (substat2_prop IS NULL OR substat2_prop = ?) AND 
              (substat2_value IS NULL OR substat2_value = ?) AND
              (substat3_prop IS NULL OR substat3_prop = ?) AND 
              (substat3_value IS NULL OR substat3_value = ?) AND
              (substat4_prop IS NULL OR substat4_prop = ?) AND 
              (substat4_value IS NULL OR substat4_value = ?)`
    );
    // checks id (not a_id)
    dbFindExistingUserBuildStmt = db.prepare
    (
        `SELECT id FROM user_builds 
        WHERE u_id = ? AND c_id = ? AND w_id = ? AND
            a1_flower = ? AND
            a2_feather = ? AND 
            a3_sands = ? AND
            a4_goblet = ? AND
            a5_circlet = ?`
    );
}

function populateTables(enka: EnkaClient): Promise<void>
{
    return new Promise((resolve, reject) =>
    {
        try
        {
            // populate characters table
            const characters = enka.getAllCharacters();
            characters.forEach((c) =>
            {
                const row = dbSelectCharacterStmt.get(c.id);
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
                const row = dbSelectWeaponStmt.get(w.id);
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
                const row = dbSelectArtifactStmt.get(a.id);
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
            console.log("Populated tables");
            resolve();
        }
        catch (error)
        {
            console.error("Error populating tables:", error);
            reject(error);
        }
    });
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
            // check if identical artifact already exists
            const existingArtifactId = dbFindExistingUserArtifact(artifact);

            if (existingArtifactId)
            {
                console.log(`Found existing artifact with ID ${existingArtifactId}`);
                resolve(existingArtifactId);
                return;
            }
            
            // otherwise, insert new artifact
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
            console.log(`Inserted artifact with ID ${info.lastInsertRowid}`);
            resolve(info.lastInsertRowid as number);
        }
        catch (error)
        {
            console.error("Error inserting artifact:", error);
            reject(error);
        }
    });
}

export function dbInsertUserBuild(build: Build): Promise<number>
{
    return new Promise((resolve, reject) =>
    {
        try
        {
            // check if identical build already exists
            const existingBuildId = dbFindExistingUserBuild(build);

            if (existingBuildId)
            {
                console.log(`Found existing build with ID ${existingBuildId}`);
                resolve(existingBuildId);
                return;
            }

            // otherwise, insert new build
            const info = dbInsertUserBuildStmt.run
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

            console.log(`Inserted new build with ID ${info.lastInsertRowid}`);
            resolve(info.lastInsertRowid as number);
        }
        catch (error)
        {
            console.error("Error inserting build:", error);
            reject(error);
        }
    });
}

export function dbFindExistingUserArtifact(artifact: Artifact): number | null
{
    const result = dbFindExistingUserArtifactStmt.get
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
    ) as { id: number } | undefined;

    return result ? result.id : null;
}

export function dbFindExistingUserBuild(build: Build): number | null
{
    const result = dbFindExistingUserBuildStmt.get(
        build.u_id,
        build.c_id,
        build.w_id,
        build.a1_flower,
        build.a2_feather,
        build.a3_sands,
        build.a4_goblet,
        build.a5_circlet
    ) as { id: number } | undefined;

    return result ? result.id : null;
}