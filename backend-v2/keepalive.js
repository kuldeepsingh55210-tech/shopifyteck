// Prevents Supabase's free-tier database from auto-pausing due to inactivity
// (Supabase pauses projects after ~7 days with no database activity).
// This runs as its own always-on PM2 process, separate from the main backend,
// so it keeps working even if the main app is restarted or briefly down.
//
// Deploy: pm2 start keepalive.js --name keepalive-db-ping && pm2 save

require('dotenv').config();
const db = require('./src/db/db');

// 6 hours gives a wide safety margin under Supabase's 7-day inactivity window,
// so even if one ping fails (network blip, brief DB restart), the next one
// well before the pause threshold.
const PING_INTERVAL_MS = 6 * 60 * 60 * 1000;

const ping = async () => {
    try {
        await db.query('SELECT 1');
        console.log(`[Keepalive] Database ping successful - ${new Date().toISOString()}`);
    } catch (error) {
        console.error(`[Keepalive] Database ping FAILED - ${new Date().toISOString()}: ${error.message}`);
    }
};

// Ping immediately on startup (covers the case where the process was just
// restarted after being down for a while), then on a fixed interval forever.
ping();
setInterval(ping, PING_INTERVAL_MS);

console.log(`[Keepalive] Started. Pinging database every ${PING_INTERVAL_MS / (60 * 60 * 1000)} hours to prevent Supabase auto-pause.`);
