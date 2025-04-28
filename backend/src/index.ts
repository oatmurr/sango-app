import express from "express";
import { EnkaClient } from "enka-network-api";
import { dbInit } from "./db";
import { routes } from "./routes";

export const enka = new EnkaClient({ showFetchCacheLog: true }); // showFetchCacheLog is true by default

// enka.cachedAssetsManager.fetchAllContents(); // returns promise
// enka.cachedAssetsManager.refreshAllData();

export const app = express();
const port = 3000;

async function initialise()
{
    try
    {
        await enka.cachedAssetsManager.fetchAllContents();
        enka.cachedAssetsManager.refreshAllData();

        dbInit(enka);
        // routes(app, enka);

        // testing
        // const characters = enka.getAllCharacters();
        // console.log(characters.map(c => c.name.get("en")));

        // start server
        app.listen(port, () => {
            console.log(`Example app listening on port ${port}`);
        });
    }
    catch (error)
    {
        console.error(error);
    }
}
initialise();

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
