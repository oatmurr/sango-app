import express from "express";
import { EnkaClient } from "enka-network-api";
import { dbInit } from "./db";
import { routes } from "./routes";

export const enka = new EnkaClient({ showFetchCacheLog: true }); // showFetchCacheLog is true by default
enka.cachedAssetsManager.cacheDirectoryPath = "./cache";
enka.cachedAssetsManager.cacheDirectorySetup();

// enka.cachedAssetsManager.fetchAllContents(); // returns promise
// enka.cachedAssetsManager.refreshAllData();

export const app = express();
const port = 3000;

async function initialise()
{
    try
    {
        // start server
        app.listen(port, () => {
            console.log(`Example app listening on port ${port}`);
        });
        
        // fetch cache contents
        await enka.cachedAssetsManager.fetchAllContents();
        enka.cachedAssetsManager.refreshAllData();

        // wait
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log("Initialising...");
        dbInit(enka);
        routes(app, enka);

        autoUpdateCache();
    }
    catch (error)
    {
        console.error("Failed to initialise:", error);
    }
}

initialise();

// cache workaround for better-sqlite3 synchronicity
// function cacheReady(): boolean
// {
//     try
//     {
//         const characters = enka.getAllCharacters();
//         const weapons = enka.getAllWeapons();
//         const artifacts = enka.getAllArtifacts();
        
//         if (characters.length > 0 && weapons.length > 0 && artifacts.length > 0)
//         {
//             return true;
//         }
//         return false
//     }
//     catch (error)
//     {
//         console.log("Cache not ready");
//         return false;
//     }
// }

// function waitCacheReady(maxAttempts: number, interval: number): Promise<void>
// {
//     return new Promise((resolve, reject) =>
//     {
//         let attempts = 0;

//         const checkInterval = setInterval(() =>
//         {
//             if (cacheReady())
//             {
//                 clearInterval(checkInterval);
//                 console.log("Cache ready");
//                 resolve();
//             }
//             else
//             {
//                 attempts++;
//                 if (attempts >= maxAttempts)
//                 {
//                     clearInterval(checkInterval);
//                     console.error("Max attempts reached. Cache not ready.");
//                     reject();
//                 }
//             }
//         }, interval);
//     });
// }

function autoUpdateCache()
{
    // https://enka-network-api.vercel.app/docs
    // auto-cache updater
    enka.cachedAssetsManager.activateAutoCacheUpdater
    ({
        instant: true, // Run the first update check immediately
        timeout: 60 * 60 * 1000, // 1 hour interval
        onUpdateStart: async () =>
        {
            console.log("Updating Genshin Data...");
        },
        onUpdateEnd: async () =>
        {
            enka.cachedAssetsManager.refreshAllData(); // Refresh memory
            console.log("Updating Completed!");
        },
    });
}
