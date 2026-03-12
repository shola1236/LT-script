const express = require('express');
const axios = require('axios');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')(); // Corrected Package
chromium.use(stealth);

const app = express();
const PORT = process.env.PORT || 3000;
let isRunning = false;
let proxyPool = [];
let accountsCreated = 0;

// Fetch fresh proxies from your Webshare link
async function refreshProxies() {
    try {
        const response = await axios.get(process.env.WEBSHARE_LINK);
        const rawList = response.data.trim().split('\n');
        proxyPool = rawList.map(line => {
            const [ip, port, user, pass] = line.trim().split(':');
            return `http://${user}:${pass}@${ip}:${port}`;
        });
        console.log(`Loaded ${proxyPool.length} proxies.`);
    } catch (err) {
        console.error("Proxy fetch failed:", err.message);
    }
}

async function runLoop() {
    await refreshProxies();
    
    while (isRunning) {
        if (proxyPool.length === 0) {
            console.log("No proxies available. Stopping.");
            isRunning = false;
            break;
        }
        
        const proxy = proxyPool[Math.floor(Math.random() * proxyPool.length)];
        const browser = await chromium.launch({ 
            headless: true, 
            proxy: { server: proxy.trim() } 
        });

        try {
            const page = await browser.newPage(); // Use 'page' for clarity
            console.log(`[${accountsCreated + 1}] Attempting signup...`);

            await page.goto(process.env.REF_LINK, { waitUntil: 'networkidle', timeout: 60000 });
            
            await page.getByPlaceholder('Username').fill(`user_${Math.random().toString(36).slice(2,8)}`);
            await page.getByPlaceholder('Email address').fill(`shola${Date.now()}@gmail.com`);
            
            const p = "Looter123!";
            await page.locator('input[type="password"]').first().fill(p);
            await page.locator('input[type="password"]').last().fill(p);

            await page.getByRole('button', { name: /Create My Account/i }).click();
            
            // Wait to confirm registration success
            await page.waitForTimeout(7000); 
            accountsCreated++;
            console.log(`[Success] Account #${accountsCreated} created.`);
        } catch (e) {
            console.log("Signup failed:", e.message);
        } finally {
            await browser.close();
        }

        // Give it a 5-second rest between accounts
        await new Promise(r => setTimeout(r, 5000));
    }
}

app.get('/', (req, res) => res.send(`Looter is ${isRunning ? 'Running' : 'Stopped'}. Accounts: ${accountsCreated}`));

app.get('/start', (req, res) => {
    if (!isRunning) {
        isRunning = true;
        runLoop();
        res.send("Bot started. View logs in Render.");
    } else {
        res.send("Bot is already running.");
    }
});

app.get('/stop', (req, res) => {
    isRunning = false;
    res.send("Bot will stop after the current attempt finishes.");
});

app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
