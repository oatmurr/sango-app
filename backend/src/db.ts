import Database from "better-sqlite3";
import { EnkaClient } from "enka-network-api";
import { Build, Artifact, BuildInput, ArtifactInput, User, Character, Weapon } from "./types";
import crypto from "crypto";

function generateUserArtifactHash(artifact: ArtifactInput): string
{
    // sort substats for hashing to be consistent
    const sortedSubstats = artifact.substats
        .map(s => `${s.prop}:${s.value}`)
        .sort()
        .join('-');
    
    const hashString = `${artifact.u_id}-${artifact.a_id}-${artifact.mainstat.prop}-${artifact.mainstat.value}-${sortedSubstats}`;
    return crypto.createHash('md5').update(hashString).digest('hex');
}

function generateUserBuildHash(build: BuildInput): string
{
    const sortedArtifacts = [
        build.ua_id_flower,
        build.ua_id_feather,
        build.ua_id_sands,
        build.ua_id_goblet,
        build.ua_id_circlet
    ].filter(id => id !== null && id !== undefined).sort().join('-');

    const hashString = `${build.u_id}-${build.c_id}-${build.w_id}-${sortedArtifacts}`;
    return crypto.createHash('md5').update(hashString).digest('hex');
}

const db = new Database("sango.db");

const placeholder_url =
    "https://static.wikia.nocookie.net/gensin-impact/images/8/84/Unknown_Icon.png/revision/latest?cb=20220509204455";

// declare prepared statements
let dbSelectCharacterStmt: Database.Statement;
let dbSelectWeaponStmt: Database.Statement;
let dbSelectArtifactStmt: Database.Statement;
let dbSelectUserArtifactStmt: Database.Statement;
let dbSelectUserBuildStmt: Database.Statement;
let dbSelectUserBuildsByUIDStmt: Database.Statement;
let dbSelectUserStmt: Database.Statement;

let dbInsertCharacterStmt: Database.Statement;
let dbInsertWeaponStmt: Database.Statement;
let dbInsertArtifactStmt: Database.Statement;
let dbInsertUserStmt: Database.Statement;
let dbInsertUserArtifactStmt: Database.Statement;
let dbInsertUserBuildStmt: Database.Statement;

// let dbFindExistingUserArtifactStmt: Database.Statement;
// let dbFindExistingUserBuildStmt: Database.Statement;

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
            ua_id TEXT PRIMARY KEY,
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
            ub_id TEXT PRIMARY KEY,
            u_id INTEGER,
            c_id INTEGER,
            w_id INTEGER,
            ua_id_flower TEXT,
            ua_id_feather TEXT,
            ua_id_sands TEXT,
            ua_id_goblet TEXT,
            ua_id_circlet TEXT,
            FOREIGN KEY (u_id) REFERENCES users(u_id),
            FOREIGN KEY (c_id) REFERENCES characters(c_id),
            FOREIGN KEY (w_id) REFERENCES weapons(w_id),
            FOREIGN KEY (ua_id_flower) REFERENCES user_artifacts(ua_id),
            FOREIGN KEY (ua_id_feather) REFERENCES user_artifacts(ua_id),
            FOREIGN KEY (ua_id_sands) REFERENCES user_artifacts(ua_id),
            FOREIGN KEY (ua_id_goblet) REFERENCES user_artifacts(ua_id),
            FOREIGN KEY (ua_id_circlet) REFERENCES user_artifacts(ua_id)
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
        `SELECT * FROM characters WHERE c_id = ?`
    );
    dbSelectWeaponStmt = db.prepare
    (
        `SELECT * FROM weapons WHERE w_id = ?`
    );
    dbSelectArtifactStmt = db.prepare
    (
        `SELECT * FROM artifacts WHERE a_id = ?`
    );
    dbSelectUserArtifactStmt = db.prepare
    (
        `SELECT * FROM user_artifacts WHERE ua_id = ?`
    );
    dbSelectUserBuildStmt = db.prepare
    (
        `SELECT * FROM user_builds WHERE ub_id = ?`
    );
    dbSelectUserBuildsByUIDStmt = db.prepare
    (
        `SELECT * FROM user_builds WHERE u_id = ?`
    );
    dbSelectUserStmt = db.prepare
    (
        `SELECT * FROM users WHERE u_id = ?`
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
            ua_id,
            u_id,
            a_id,
            mainstat_prop, mainstat_value,
            substat1_prop, substat1_value,
            substat2_prop, substat2_value,
            substat3_prop, substat3_value,
            substat4_prop, substat4_value
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    dbInsertUserBuildStmt = db.prepare
    (
        `INSERT INTO user_builds
        (
            ub_id,
            u_id,
            c_id,
            w_id,
            ua_id_flower, ua_id_feather, ua_id_sands, ua_id_goblet, ua_id_circlet
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    // // need to check IS NULL separately because NULL = NULL doesn't return true
    // dbFindExistingUserArtifactStmt = db.prepare
    // (
    //     `SELECT id FROM user_artifacts 
    //     WHERE u_id = ? AND a_id = ? AND 
    //           mainstat_prop = ? AND mainstat_value = ? AND
    //           (substat1_prop IS NULL OR substat1_prop = ?) AND 
    //           (substat1_value IS NULL OR substat1_value = ?) AND
    //           (substat2_prop IS NULL OR substat2_prop = ?) AND 
    //           (substat2_value IS NULL OR substat2_value = ?) AND
    //           (substat3_prop IS NULL OR substat3_prop = ?) AND 
    //           (substat3_value IS NULL OR substat3_value = ?) AND
    //           (substat4_prop IS NULL OR substat4_prop = ?) AND 
    //           (substat4_value IS NULL OR substat4_value = ?)`
    // );
    // // checks id (not a_id)
    // dbFindExistingUserBuildStmt = db.prepare
    // (
    //     `SELECT id FROM user_builds 
    //     WHERE u_id = ? AND c_id = ? AND w_id = ? AND
    //         a1_flower = ? AND
    //         a2_feather = ? AND 
    //         a3_sands = ? AND
    //         a4_goblet = ? AND
    //         a5_circlet = ?`
    // );
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
                // only use first four digits of a_id (fifth digit refers to number of starting substats)
                const a_id = Math.floor(a.id / 10) % 10000;
                console.log(a_id);

                const row = dbSelectArtifactStmt.get(a_id);
                if (!row)
                {
                    dbInsertArtifactStmt.run(
                        a_id,
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

export function dbGetCharacter(c_id: number): Character | undefined
{
    return dbSelectCharacterStmt.get(c_id) as Character | undefined;
}

export function dbGetWeapon(w_id: number): Weapon | undefined
{
    return dbSelectWeaponStmt.get(w_id) as Weapon | undefined;
}

export function dbGetArtifact(a_id: number): Artifact | undefined
{
    return dbSelectArtifactStmt.get(a_id) as Artifact | undefined;
}

export function dbGetUserArtifact(ua_id: string): Artifact | undefined
{
    return dbSelectUserArtifactStmt.get(ua_id) as Artifact | undefined;
}

export function dbGetUserBuild(ub_id: string): Build | undefined
{
    return dbSelectUserBuildStmt.get(ub_id) as Build | undefined;
}

export function dbGetUserBuildsByUID(u_id: number): Build[]
{
    return dbSelectUserBuildsByUIDStmt.all(u_id) as Build[];
}

export function dbGetUser(u_id: number): User | undefined
{
    return dbSelectUserStmt.get(u_id) as User | undefined;
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
    // only use first four digits of a_id (fifth digit refers to number of starting substats)
    const dba_id = Math.floor(a_id / 10) % 10000;
    
    dbInsertArtifactStmt.run
    (
        dba_id, name, icon_url, rarity,
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

export function dbInsertUserArtifact(artifact: ArtifactInput): Promise<string>
{
    // wrapped in Promise so build creation doesn't attempt to reference artifacts before they are inserted
    return new Promise((resolve, reject) =>
    {
        try
        {
            // only use first four digits of a_id (fifth digit refers to number of starting substats)
            const db_a_id = Math.floor(artifact.a_id / 10) % 10000;
            // const dbArtifact =
            // {
            //     ...artifact,
            //     a_id: dba_id
            // }

            // // check if identical artifact already exists
            // const existingArtifactId = dbFindExistingUserArtifact(dbArtifact);

            // if (existingArtifactId)
            // {
            //     console.log(`Found existing artifact with ID ${existingArtifactId}`);
            //     resolve(existingArtifactId);
            //     return;
            // }
            
            // // otherwise, insert new artifact
            // const info = dbInsertUserArtifactStmt.run

            const ua_id = generateUserArtifactHash(artifact);
            
            dbInsertUserArtifactStmt.run
            (
                ua_id,
                artifact.u_id,
                db_a_id,
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

            // // return last inserted user_artifact id (should be the one that this function just inserted)
            // console.log(`Inserted artifact with ID ${info.lastInsertRowid}`);
            // resolve(info.lastInsertRowid as number);
            console.log(`Attempting to insert artifact with hash ${ua_id}`);
            resolve(ua_id);
        }
        catch (error: any)
        {
            if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY')
            {
                const ua_id = generateUserArtifactHash(artifact);
                console.log(`Artifact already exists with hash ${ua_id}`);
                resolve(ua_id);
            }
            else
            {
                console.error("Error inserting artifact:", error);
                reject(error);
            }
        }
    });
}

export function dbInsertUserBuild(build: BuildInput): Promise<string>
{
    return new Promise((resolve, reject) =>
    {
        try
        {
            // // check if identical build already exists
            // const existingBuildId = dbFindExistingUserBuild(build);

            // if (existingBuildId)
            // {
            //     console.log(`Found existing build with ID ${existingBuildId}`);
            //     resolve(existingBuildId);
            //     return;
            // }

            // // otherwise, insert new build
            // const info = dbInsertUserBuildStmt.run

            const ub_id = generateUserBuildHash(build);
            dbInsertUserBuildStmt.run
            (
                ub_id,
                build.u_id,
                build.c_id,
                build.w_id,
                build.ua_id_flower,
                build.ua_id_feather,
                build.ua_id_sands,
                build.ua_id_goblet,
                build.ua_id_circlet
            );

            // console.log(`Inserted new build with ID ${info.lastInsertRowid}`);
            // resolve(info.lastInsertRowid as number);
            console.log(`Inserted new build with hash ${ub_id}`);
            resolve(ub_id);
        }
        catch (error: any)
        {
            if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY')
            {
                const ub_id = generateUserBuildHash(build);
                console.log(`Build already exists with hash ${ub_id}`);
                resolve(ub_id);
            }
            else
            {
                console.error("Error inserting build:", error);
                reject(error);
            }
        }
    });
}

// export function dbFindExistingUserArtifact(artifact: Artifact): number | null
// {
//     const result = dbFindExistingUserArtifactStmt.get
//     (
//         artifact.u_id,
//         artifact.a_id,
//         artifact.mainstat.prop,
//         artifact.mainstat.value,
//         artifact.substats[0]?.prop || null,
//         artifact.substats[0]?.value || null,
//         artifact.substats[1]?.prop || null,
//         artifact.substats[1]?.value || null,
//         artifact.substats[2]?.prop || null,
//         artifact.substats[2]?.value || null,
//         artifact.substats[3]?.prop || null,
//         artifact.substats[3]?.value || null
//     ) as { id: number } | undefined;

//     return result ? result.id : null;
// }

// export function dbFindExistingUserBuild(build: Build): number | null
// {
//     const result = dbFindExistingUserBuildStmt.get(
//         build.u_id,
//         build.c_id,
//         build.w_id,
//         build.a1_flower,
//         build.a2_feather,
//         build.a3_sands,
//         build.a4_goblet,
//         build.a5_circlet
//     ) as { id: number } | undefined;

//     return result ? result.id : null;
// }