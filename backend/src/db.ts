import sqlite3 from "sqlite3";
import { enka } from "./index";

const db = new sqlite3.Database("cinder.db");

/**
 * Initializes the database by creating the `characters` table if it does not exist,
 * and populates it with character data from the `enka` source.
 *
 * The function performs the following steps:
 * 1. Creates the `characters` table with columns `id`, `c_id`, and `name`.
 * 2. Retrieves all characters from the `enka` source.
 * 3. For each character, checks if the character's name already exists in the `characters` table.
 * 4. If the character's name does not exist in the table, inserts the character into the table.
 *
 */
export function dbInit() {
    db.serialize(() => {
        db.run(
            "CREATE TABLE IF NOT EXISTS characters (id INTEGER PRIMARY KEY AUTOINCREMENT, c_id INTEGER, name TEXT, rarity INTEGER, element TEXT, c_class TEXT)"
        );

        db.run(
            "CREATE TABLE IF NOT EXISTS weapons (id INTEGER PRIMARY KEY AUTOINCREMENT, w_id INTEGER, name TEXT, rarity INTEGER, w_class TEXT)"
        );

        db.run(
            "CREATE TABLE IF NOT EXISTS artifacts (id INTEGER PRIMARY KEY AUTOINCREMENT, a_id INTEGER, name TEXT, rarity INTEGER, a_type TEXT, a_set TEXT)"
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
    rarity: number,
    element: string,
    c_class: string
) {
    console.log(name);
    db.serialize(() => {
        db.run(
            "INSERT INTO characters (c_id, name, rarity, element, c_class) VALUES (?, ?, ?, ?, ?)",
            c_id,
            name,
            rarity,
            element,
            c_class
        );
    });
}

export function dbInsertWeapon(
    w_id: number,
    name: string,
    rarity: number,
    w_class: string
) {
    db.serialize(() => {
        db.run(
            "INSERT INTO weapons (w_id, name, rarity, w_class) VALUES (?, ?, ?, ?)",
            w_id,
            name,
            rarity,
            w_class
        );
    });
}

export function dbInsertArtifact(
    a_id: number,
    name: string,
    rarity: number,
    a_type: string,
    a_set: string
) {
    db.serialize(() => {
        db.run(
            "INSERT INTO artifacts (a_id, name, rarity, a_type, a_set) VALUES (?, ?, ?, ?, ?)",
            a_id,
            name,
            rarity,
            a_type,
            a_set
        );
    });
}
