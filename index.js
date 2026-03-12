const express = require('express');
const axios = require('axios');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const app = express();
const PORT = process.env.PORT || 3000;
let isRunning = false;
let accountsCreated = 0;

// Human-like Name Generator
const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];

const genIdentity = () => {
    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    const num = Math.floor(Math.random() * 999);
    return {
        user: `${fn.toLowerCase()}${num}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}${num}@gmail.com`
    };
};

async function runLoop() {
    const response = await axios.get(process.env.WEBSHARE_LINK);
    const proxyPool = response.data.trim().split('\n').map(line => {
        const [ip, port, user, pass] = line.trim().split(':');
        return `http://${user}:${pass}@${ip}:${port}`;
    });

    while (isRunning) {
        const identity = genIdentity();
        const proxy = proxyPool[Math.floor(Math.random() * proxyPool.length)];
        const browser = await chromium.launch({ headless: true, proxy: { server: proxy.trim() } });
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            console.log(`--- Attempting Account: ${identity.user} ---`);
            await page.goto(process.env.REF_LINK, { waitUntil: 'networkidle', timeout: 30000 });

            // LOGGING THE ISSUE: Check if selectors exist before filling
            const userField = await page.getByPlaceholder('Username').isVisible();
            if (!userField) throw new Error("CRITICAL: Username field not found. Site layout might have changed.");

            await page.getByPlaceholder('Username').fill(identity.user, { delay: 100 });
            await page.getByPlaceholder('Email address').fill(identity.email, { delay: 120 });
            
            const p = "Looter123!";
            await page.locator('input[type="password"]').first().fill(p);
            await page.locator('input[type="password"]').last().fill(p);

            await page.getByRole('button', { name: /Create My Account/i }).click();

            // LOGGING THE ISSUE: Wait for success or error message on screen
            const success = await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => null);
            
            if (success) {
                accountsCreated++;
                console.log(`[SUCCESS] Account #${accountsCreated} created.`);
            } else {
                // Scrape the page for any red error text
                const errorMsg = await page.locator('.text-danger, .error-message, .alert').innerText().catch(() => "Unknown rejection");
                console.log(`[REJECTED] Site said: ${errorMsg}`);
            }
        } catch (e) {
            console.log(`[CRASH] Error: ${e.message}`);
        } finally {
            await browser.close();
        }
        await new Promise(r => setTimeout(r, 5000));
    }
}

app.get('/', (req, res) => res.send(`Status: ${isRunning ? 'Running' : 'Stopped'}. Loot: ${accountsCreated}`));
app.get('/start', (req, res) => { isRunning = true; runLoop(); res.send("Started"); });
app.get('/stop', (req, res) => { isRunning = false; res.send("Stopped"); });
app.listen(PORT);
