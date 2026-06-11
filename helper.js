// Export AGGIORNA
export async function btn_aggiorna(page) {
    await Promise.all([
        page.waitForResponse(resp => {
            const url = resp.url();

            return (
                resp.status() === 200 &&
                url.includes('/statistics/data')
            );
        }),
        // click aggiorna
        page.click('.btn-aggiorna'),
    ]);


    // aspetta overlay sparire
    await page.waitForSelector('.blockUI.blockOverlay', {
        state: 'hidden',
        timeout: 5000
    });

    //await page.waitForTimeout(3000);

}

// Export AGGIORNA
export async function filter_pasto(page, select) {
    // apri dropdown "time slots"
    await page.evaluate((select) => {

        // trova radio "pranzo"
        const input = document.querySelector(
            '.multiselect-container input[value="' + select + '"]'
        );

        if (!input) {
            throw new Error('Radio ' + select + ' non trovato');
        }

        // seleziona
        input.checked = true;

        // deseleziona gli altri radio
        document.querySelectorAll(
            '.multiselect-container input[type="radio"]'
        ).forEach(el => {
            if (el !== input) {
                el.checked = false;
            }
        });

        // trigger eventi reali
        input.dispatchEvent(
            new MouseEvent('click', {
                bubbles: true
            })
        );

        input.dispatchEvent(
            new Event('change', {
                bubbles: true
            })
        );

        // aggiorna testo bottone
        const txt = document.querySelector(
            '.multiselect-selected-text'
        );

        if (txt) {
            txt.textContent = select;
        }
    }, select);

}