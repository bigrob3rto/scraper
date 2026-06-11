import ExcelJS from 'exceljs';
import path from 'path';

let workbook = null;

let sheet = null;

let rowsBuffer = [];

//******************************************************************************/
function parseEuro(value) {

    if (!value) return 0;

    value = value.toString().trim();

    if (value.includes(',') && value.includes('.')) {

        if (value.lastIndexOf(',') > value.lastIndexOf('.')) {
            value = value
                .replace(/\./g, '')
                .replace(',', '.');
        } else {
            value = value.replace(/,/g, '');
        }

    } else if (value.includes(',')) {
        value = value.replace(',', '.');
    }

    value = value.replace(/[^\d.-]/g, '');

    return parseFloat(value) || 0;
}

//******************************************************************************/
export async function init_excel(workbookBuffer) {

    workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(workbookBuffer);

    sheet = workbook.getWorksheet('Giornaliero');
    rowsBuffer = [];

    console.log('✅ Excel loaded');
}

//******************************************************************************/
export function buffer_excel(
    day,
    result,
    result_pranzo,
    result_cena
) {

    rowsBuffer.push([

        day,

        parseEuro(result.incasso),
        parseEuro(result.annulli),
        parseEuro(result.addebiti),

        parseEuro(result_pranzo.incasso),
        parseEuro(result_cena.incasso),

        result.coperti,
        result_pranzo.coperti,
        result_cena.coperti

    ]);
}


//******************************************************************************/
function findLastDataRow(sheet) {
    let lastDataRow = 0;

    sheet.eachRow((row, rowNumber) => {
        const hasData = row.values
            .slice(1)
            .some(v => v !== undefined && v !== null && v !== '');

        if (hasData) {
            lastDataRow = rowNumber;
        }
    });

    return lastDataRow;
}

//******************************************************************************/
export async function save_excel() {
    // Nome file univoco
    //const filename = `report-${Date.now()}.xlsx`;

    // File temporaneo
    //const filepath = path.join('/tmp', filename);

    const lastDataRow = findLastDataRow(sheet);
    let rowIndex = lastDataRow + 1;
    console.log('Ultima riga con dati:', lastDataRow);

    for (const row of rowsBuffer) {
        sheet.getRow(rowIndex).values = row;
        rowIndex++;
    }
    // Salva Excel
    //await workbook.xlsx.writeFile(filepath);
    console.log('✅ Excel saved');

    return await workbook.xlsx.writeBuffer();
}

//******************************************************************************/
export async function createExcel() {

    const workbook = new ExcelJS.Workbook();

    const sheet = workbook.addWorksheet('Report');

    sheet.columns = [
        { header: 'Product', key: 'product', width: 30 },
        { header: 'Price', key: 'price', width: 15 },
        { header: 'Date', key: 'date', width: 25 }
    ];

    // DATI ESEMPIO
    sheet.addRow({
        product: 'Item A',
        price: 100,
        date: new Date().toISOString()
    });

    sheet.addRow({
        product: 'Item B',
        price: 200,
        date: new Date().toISOString()
    });

    // Nome file univoco
    const filename = `report-${Date.now()}.xlsx`;

    // File temporaneo
    const filepath = path.join('/tmp', filename);

    // Salva Excel
    await workbook.xlsx.writeFile(filepath);
    console.log('Excel creato:', filepath);

    return {
        filepath,
        filename
    };
}