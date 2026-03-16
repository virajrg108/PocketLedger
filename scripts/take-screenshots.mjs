import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
    if (!fs.existsSync('public/screenshots')) {
        fs.mkdirSync('public/screenshots', { recursive: true });
    }
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2
    });
    const page = await context.newPage();

    // Navigate to a static file on the same origin so that React/Vite HMR/PWA scripts don't execute and destroy the context
    await page.goto('http://localhost:5173/manifest.webmanifest');

    // Seed DB with exact requirements: 2 banks with ~4 lakh, 2 credit cards with ~1 lakh
    await page.evaluate(async () => {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('PocketLedgerDB', 3);
            req.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction(['accounts', 'transactions'], 'readwrite');
                const accountsStore = tx.objectStore('accounts');
                const txStore = tx.objectStore('transactions');

                accountsStore.clear();
                txStore.clear();

                accountsStore.put({ name: 'HDFC Bank', initialBalance: 420000 });
                accountsStore.put({ name: 'Federal Bank', initialBalance: 380000 });
                accountsStore.put({ name: 'Amazon ICICI CC', initialBalance: -115000 });
                accountsStore.put({ name: 'HDFC Regalia CC', initialBalance: -85000 });

                const now = new Date();
                txStore.put({ title: 'TechCorp Salary', amount: 125000, type: 'Credit', source: 'HDFC Bank', category: 'Other', timestamp: new Date(now.getTime() - 5 * 86400000).toISOString() });
                txStore.put({ title: 'Apartment Rent', amount: -45000, type: 'Debit', source: 'Federal Bank', category: 'Need', timestamp: new Date(now.getTime() - 4 * 86400000).toISOString() });
                txStore.put({ title: 'Supermarket', amount: -12000, type: 'Debit', source: 'Amazon ICICI CC', category: 'Need', timestamp: new Date(now.getTime() - 2 * 86400000).toISOString() });
                txStore.put({ title: 'Weekend Dining', amount: -6500, type: 'Debit', source: 'HDFC Regalia CC', category: 'Want', timestamp: new Date(now.getTime() - 1 * 86400000).toISOString() });
                txStore.put({ title: 'Card Payment', amount: 40000, type: 'Transfer', source: 'HDFC Bank', toSource: 'Amazon ICICI CC', timestamp: new Date(now.getTime() - 12 * 3600000).toISOString() });

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };
        });
    });

    // Wait slightly
    await page.waitForTimeout(1000);

    // Now navigate to the actual application
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'public/screenshots/dashboard.png' });
    console.log('Dashboard captured');

    await page.goto('http://localhost:5173/settings');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'public/screenshots/settings.png' });
    console.log('Settings captured');

    await page.goto('http://localhost:5173/add');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'public/screenshots/new-entry.png' });
    console.log('New entry captured');

    await page.goto('http://localhost:5173/reports');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'public/screenshots/reports.png' });
    console.log('Reports captured');

    await browser.close();
})();
