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

        // // Test with default parameter (undefined)
        // const defaultArtifacts = enka.getAllArtifacts();
        // console.log(`Default parameter: Got ${defaultArtifacts.length} Artifacts`);
        
        // // Sample the first few Artifacts
        // console.log("Sample Artifacts (default):");
        // defaultArtifacts.forEach(a => {
        //     console.log(`- ${a.name.get()}, ID: ${a.id}, Rarity: ${a.stars}`);
        // });

        console.log("Initialising...");
        await dbInit(enka);
        routes(app, enka);

        autoUpdateCache();
    }
    catch (error)
    {
        console.error("Failed to initialise:", error);
    }
}

initialise();

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
