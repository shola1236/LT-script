const express = require('express');
const axios = require('axios');
const { chromium } = require('playwright-extra');
const stealth = require('playwright-extra-plugin-stealth')();
chromium.use(stealth);

const app = express();
const PORT = process.env.PORT || 3000;
let isRunning = false;
let proxyPool = [];

// Step 1: Fetch the proxies from your link
async function refreshProxies() {
    try {
        const response = await axios.get(process.env.WEBSHARE_LINK);
        // Webshare format is usually IP:PORT:USER:PASS
        const rawList = response.data.trim().split('\n');
        proxyPool = rawList.map(line => {
            const [ip, port, user, pass] = line.trim().split(':');
            return `http://${user}:${pass}@${ip}:${port}`;
        });
        console.log(`Loaded ${proxyPool.length} proxies from Webshare.`);
    } catch (err) {
        console.error("Failed to fetch proxy list:", err.message);
    }
}

async function runLoop() {
    await refreshProxies(); // Get fresh IPs before starting
    
    while (isRunning) {
        if (proxyPool.length === 0) break;
        
        const proxy = proxyPool[Math.floor(Math.random() * proxyPool.length)];
        const browser = await chromium.launch({ headless: true, proxy: { server: proxy } });
        const context = await browser.newPage();

        try {
            await context.goto(process.env.REF_LINK, { waitUntil: 'networkidle' });
            
            // Fast Signup Logic
            await context.getByPlaceholder('Username').fill(`shola_${Math.random().toString(36).slice(2,8)}`);
            await context.getByPlaceholder('Email address').fill(`user${Date.now()}@gmail.com`);
            
            const p = "Looter123!";
            await context.locator('input[type="password"]').first().fill(p);
            await context.locator('input[type="password"]').last().fill(p);

            await context.getByRole('button', { name: /Create My Account/i }).click();
            await context.waitForTimeout(6000); 
            console.log("Account Created!");
        } catch (e) {
            console.log("Signup Failed (Likely IP block):", e.message);
        }

        await browser.close();
        // Wait 5 seconds so you don't look like a 100% bot
        await new Promise(r => setTimeout(r, 5000));
    }
}

app.get('/start', (req, res) => {
    if (!isRunning) { isRunning = true; runLoop(); }
    res.send("Bot is now running. Check Render logs for progress.");
});

app.get('/stop', (req, res) => {
    isRunning = false;
    res.send("Bot stopping...");
});

app.listen(PORT, () => console.log(`Live on port ${PORT}`));
