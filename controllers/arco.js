"use strict";
var Workbook = require('xlsx-populate');
/**
 * doCopy function
 * @param {Workbook} wbo 
 * @param {String} inputFilename 
 * @returns Workbook
 */
const doCopy = async function(wbo, inputFilename) {
    await Workbook.fromFileAsync(inputFilename).then(async (wb) => {
        var sheet = wb.sheet(0);
        let maxRowsNum = sheet.usedRange()._numRows;
        let activeRow = (wbo.sheet(1).cell('M9').value() == 0 || wbo.sheet(1).cell('M9').value() === undefined) ? 0 : getLastFreeRow(wbo) - 2;
        for (let ri = 25; ri < maxRowsNum; ri++) {
            let colNums = sheet.row(ri)._cells.length;
            // if row doesn't have empty value
            if (!wb.sheet(0).cell('B' + ri).value() && !wb.sheet(0).cell('E' + ri).value()) break;
            // number format
            if (sheet.row(ri).cell(1).style('numberFormat') !== 'General')
                wbo.sheet(0).row(ri - 23 + activeRow).cell(1).style('numberFormat', sheet.row(ri).cell(1).style('numberFormat'));
            for (let ci = 1; ci <= colNums; ci++) {
                wbo.sheet(0).row(ri - 23 + activeRow).cell(ci).value(sheet.row(ri).cell(ci).value());
            }
        }
        // SHEET 2
        // change number of report or days
        wbo.sheet(1).cell('M9').value((wbo.sheet(1).cell('M9').value() + 1) || 1);

        // set formula
        let numRow = wbo.sheet(0).usedRange()._numRows;
        for (let i = 10; i < wbo.sheet(1).usedRange()._numRows; i++) {
            wbo.sheet(1).cell(`D${i}`).formula(`SUMIF(${wbo.sheet(0).name()}!C2:'${wbo.sheet(0).name()}'!C${numRow},Summary!C${i},${wbo.sheet(0).name()}!D2:'${wbo.sheet(0).name()}'!D${numRow})`);
            wbo.sheet(1).cell(`E${i}`).formula(`SUMIF(${wbo.sheet(0).name()}!F2:'${wbo.sheet(0).name()}'!F${numRow},Summary!C${i},${wbo.sheet(0).name()}!D2:'${wbo.sheet(0).name()}'!D${numRow})`);
            wbo.sheet(1).cell(`G${i}`).formula(`SUMIF(${wbo.sheet(0).name()}!C2:'${wbo.sheet(0).name()}'!C${numRow},Summary!C${i},${wbo.sheet(0).name()}!E2:'${wbo.sheet(0).name()}'!E${numRow})`);
        }
    });
    return wbo;
};

const getLastFreeRow = (wb) => {
    let totalRow = wb.sheet(0).usedRange()._numRows;
    let middleRow = Math.round(totalRow/2);
    // check value of middle row cell if not empty
    let start = (wb.sheet(0).cell('B' + middleRow).value()) ? middleRow : 2;
    while (start <= totalRow) {
        if (!wb.sheet(0).cell('B' + start).value() && !wb.sheet(0).cell('E' + start).value()) break;
        start++;
    }
    return start;
}

const readFileAsync = async (filename) => {
    let wb = await Workbook.fromFileAsync(filename);
    return wb;
}

/**
 * Arco Analysis
 * @param {String} filename 
 * @param {Array} Data 
 * @returns Array
 */
const getAndMergeData = async (filename, Data = []) => {
    return await Workbook.fromFileAsync(filename).then(async (wbo) => {
        let colsNum = wbo.sheet(0).usedRange()._numColumns;
        for (let i = 1; i <= colsNum; i++) {
            let m_code = wbo.sheet(0).row(14).cell(i).value();
            if (m_code) {
                let obj = {
                    m_code: wbo.sheet(0).row(14).cell(i).value(),
                    v_1: wbo.sheet(0).row(17).cell(i).value(),
                    v_2: wbo.sheet(0).row(20).cell(i).value(),
                    error: wbo.sheet(0).row(18).cell(i).value(),
                }
                Data.push(obj);
            }
        }
        return Data;
    }).catch((err) => {
        console.log(err);
        return new Array();
    });
}

/**
 * Filter data value and reduce to get its sum with some keys
 * @param {Array} Data 
 * @param {String} M_CODE 
 * @param {String} valueOf Object key
 * @returns {Number}
 */
const findDataValue = (Data, M_CODE, valueOf) => {
    let array = Data.filter(e => e['m_code'] === M_CODE).map(e => e[valueOf]);
    return (array.length > 0) ? array.reduce((a, b) => (parseFloat(a)) ? a + b: b) : 0;
}

/**
 * Fill the template arco analysis file with the data in params
 * @param {Workbook} wbo 
 * @param {Array} Data 
 * @param {String} dateInterval 
 * @returns {Workbook}
 */
const fillTemplateWithData = (wbo, Data, dateInterval = "") => {
    // change date in A1
    wbo.sheet(0).cell('A1').value(dateInterval);

    let rowNums = wbo.sheet(0).usedRange()._numRows;
    for (let i = 4; i <= rowNums; i++) {
        let m_code = wbo.sheet(0).cell('B' + i).value();
        if (m_code) {
            // v1
            wbo.sheet(0).cell('C' + i).value( wbo.sheet(0).cell('C' + i).value() ?
                findDataValue(Data, m_code, 'v_1') + wbo.sheet(0).cell('C' + i).value() : 
                findDataValue(Data, m_code, 'v_1'));
            // v2
            wbo.sheet(0).cell('D' + i).value( wbo.sheet(0).cell('D' + i).value() ?
                findDataValue(Data, m_code, 'v_2') + wbo.sheet(0).cell('D' + i).value() : 
            findDataValue(Data, m_code, 'v_2'));
            // error
            wbo.sheet(0).cell('E' + i).value(wbo.sheet(0).cell('E' + i).value() ?
                findDataValue(Data, m_code, 'error') + wbo.sheet(0).cell('E' + i).value() : 
            findDataValue(Data, m_code, 'error'));
        }
    }
    return wbo;
}

module.exports = {
    readFileAsync,
    getLastFreeRow,
    doCopy,
    findDataValue,
    fillTemplateWithData,
    getAndMergeData
}