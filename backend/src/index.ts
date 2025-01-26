import express from "express";
import { EnkaClient, ArtifactSet } from "enka-network-api";
import fs from "fs";
import { dbInit } from "./db";
import sqlite3 from "sqlite3";
import { routes } from "./routes";

export const enka = new EnkaClient({ showFetchCacheLog: true }); // showFetchCacheLog is true by default

enka.cachedAssetsManager.fetchAllContents(); // returns promise
enka.cachedAssetsManager.refreshAllData();

export const app = express();
const port = 3000;

dbInit();
routes();
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

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
