import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { btn_aggiorna, filter_pasto } from './helper.js';
import { init_excel, buffer_excel, save_excel, createExcel } from './excel.js';
import { uploadToGoogleDrive, loadWorkbookFromDrive, updateFileOnDrive } from './drive.js';

import dotenv from 'dotenv';
dotenv.config();


var browser = null;

// call main function
await manual();
process.exit(0);


//******************************************************************************/
async function manual() {
  const day = process.argv[2];

  if (!day) {
    throw new Error('Missing day argument');
  }

  await scrape(day);
}



//******************************************************************************/
function getDates(start, stop) {
    const dates = [];
    let current = new Date(start);
    const end = new Date(stop);

    while (current <= end) {
        dates.push(current.toISOString().slice(0, 10));
        current.setDate(current.getDate() + 1);
    }

    return dates;
}
var page;

//******************************************************************************/
async function scrape(day) {

    console.log("Request Started");

    // load file xlsx from drive
    console.log("ENV FILE ID:", process.env.GOOGLE_FILE_ID);
    const workbookBuffer = await loadWorkbookFromDrive(process.env.GOOGLE_FILE_ID);
    await init_excel(workbookBuffer);


    if (!browser) {

        browser = await chromium.launch({
            //headless: false, // metti false per debug visivo
            headless: true, // metti false per debug visivo
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
                '--no-zygote'
            ]
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/147.0.0.0 Safari/537.36',
            viewport: null // Usa la dimensione massima della finestra
        });

        page = await context.newPage();

        // =========================
        // 1. INTERCETTA API
        // =========================
        let apiResponses = [];

        page.on('response', async (response) => {
            //console.log(response.status(), response.request().method(), response.url());
            const url = response.url();

            if (
                url.includes('/api/') ||
                url.includes('/graphql')
            ) {
                try {
                    const json = await response.json();
                    apiResponses.push({
                        url,
                        data: json
                    });

                    console.log('📡 API:', url);
                } catch {
                    // non JSON → ignora
                }
            }
        });

        // =========================
        // 2. LOGIN
        // =========================
        await page.goto(`${process.env.BASE_URL}/it/auth/login`, {
            waitUntil: 'networkidle'
        });

        // compila form
        await page.fill('input[name="email"]', process.env.USERNAME);
        await page.fill('input[name="password"]', process.env.PASSWORD);

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }),
            page.click('button[type="submit"]')
        ]);

        console.log('✅ Login eseguito');

        // =========================
        // 3. NAVIGAZIONE PAGINA TARGET
        // =========================

        await Promise.all([
            page.waitForResponse(resp => {
                const url = resp.url();

                return (
                    resp.status() === 200 &&
                    url.includes('/statistics/data')
                );
            }),
            // click aggiorna
            page.goto(`${process.env.BASE_URL}/it/cloud-stats/totalizzazioni/eat`, {
                waitUntil: 'networkidle'
            })
        ]);
        await page.waitForSelector('.blockUI.blockOverlay', {
            state: 'hidden',
            timeout: 30000
        });


        console.log('📄 Pagina caricata');
    }

    // debug page still connected?
    console.log('URL:', await page.url());

    const debug = await page.evaluate(() => ({
        title: document.title,
        jquery: typeof window.$,
        moment: typeof window.moment,
        filtro: !!document.querySelector('#filtro-data')
    }));

    console.log(debug);

    console.log('📅 Processing:', day);

    await page.evaluate((day) => {
        const el = $('#filtro-data');
        const drp = el.data('daterangepicker');

        const start = window.moment(day, 'YYYY-MM-DD');
        const end = window.moment(day, 'YYYY-MM-DD');

        drp.setStartDate(start);
        drp.setEndDate(end);

        el.val(
            start.format(drp.locale.format) +
            drp.locale.separator +
            end.format(drp.locale.format)
        );

        el.trigger('apply.daterangepicker', drp);

    }, day);


    // AGGIORNA
    await btn_aggiorna(page);

    console.log('✅ Giorno completato:', day);

    // scrape info
    const result = await page.evaluate(() => ({
        incasso: document.querySelector('#totale-venduto .totale')?.textContent?.trim() || '0',
        coperti: parseInt(document.querySelector('#totale-venduto .totale-coperti')?.textContent?.trim() || '0'),
        addebiti: document.querySelector('.num-addebiti')?.textContent?.trim() || '0',
        annulli: document.querySelector('.num-annulli')?.textContent?.trim() || '0'
    }
    ));
    console.log('📝 RESULT:', day, result);

    // pranzo
    // click filtri
    const btn = page.locator('.btn-extra-filters').first();

    if (await btn.isVisible()) {
        await btn.click({ force: true });
    }

    // apri dropdown "time slots"
    await filter_pasto(page, 'pranzo');

    // AGGIORNA
    await btn_aggiorna(page);

    // scrape info
    const result_pranzo = await page.evaluate(() => ({
        incasso: document.querySelector('#totale-venduto .totale')?.textContent?.trim() || '0',
        coperti: parseInt(document.querySelector('#totale-venduto .totale-coperti')?.textContent?.trim() || '0'),
    }));
    console.log('📝 RESULT_PRANZO:', day, result_pranzo);

    // apri dropdown "time slots"
    await filter_pasto(page, 'cena');

    // AGGIORNA
    await btn_aggiorna(page);

    // scrape info
    const result_cena = await page.evaluate(() => ({
        incasso: document.querySelector('#totale-venduto .totale')?.textContent?.trim() || '0',
        coperti: parseInt(document.querySelector('#totale-venduto .totale-coperti')?.textContent?.trim() || '0'),
    }));
    console.log('📝 RESULT_CENA:', day, result_cena);


    await buffer_excel(
        day,
        result,
        result_pranzo,
        result_cena
    );

    // apri dropdown "time slots"
    await filter_pasto(page, '--');

    // 1. CREA EXCEL
    const buffer = await save_excel();

    // 2. UPLOAD DRIVE
    //const uploadedFile = await uploadToGoogleDrive(filepath, filename);
    await updateFileOnDrive(
        process.env.GOOGLE_FILE_ID,
        buffer
    );

    // 3. CANCELLA FILE TEMP
    //fs.unlinkSync(filepath);

    //console.log('Temporary file deleted');

    // close browser only after all operations are done
    await browser.close();

    return {
        day,
        result,
        result_pranzo,
        result_cena
    }
}

