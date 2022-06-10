const getWS = (wb, indexOfSheet) => {
    let sheet_name = wb.SheetNames[indexOfSheet];
    return wb.Sheets[sheet_name];
}

// get sheetname
const getSheetIndex = (wb, sheetname) => {
    return wb.SheetNames.indexOf(sheetname);
}

// nom des colonnes
const columsNames = {
    mcode: 'M-CODE',
    repas: 'NOMBRE DE REPAS',
    number: 'Numbering Agent',
    shift: 'Shift Name',
    transpday: 'TRANSPORT JOUR',
    transpnight: 'TRANSPORT SOIR',
    transp: 'TRANSPORT',
    salaryUP: 'SALARY UP',
    salaryAGROBOX: 'SALARY AGROBOX',
    salaryARCO: 'SALARY ARCO',
    salaryUPC: 'SALARY UPC',
    salaryJEFACTURE: 'SALARY JeFACTURE',
};


const colsIndexNames = () => {
    let alphabet = String.fromCharCode(...Array(123).keys()).slice(97).toUpperCase();
    return alphabet;
}

// read without style
const readWBxlsx = (filename) => {
    const xlsx = require('xlsx');
    return xlsx.readFile(filename, {cellDates: true});
}

// read with style
const readWBxlsxstyle = (filename) => {
    const xlsx = require('xlsx-style');
    return xlsx.readFile(filename, {cellStyles: true});
}

const findData = (ws, key) => {
    let data = [];
    Object.keys(ws).forEach(e => {
        if (ws[e].v && new String(ws[e].v).match(key))
            data.push({c: e, v: ws[e]});
    })
    return data;
}

const combineStyle = (wb_xlsx, wb_xlsx_style) => {
    const XLSX = require('xlsx')
    let sheets_leng = wb_xlsx.SheetNames.length;
    for (let i = 0; i < sheets_leng; i++) {
        let ws = wb_xlsx.Sheets[wb_xlsx.SheetNames[i]];
        let ws_s = wb_xlsx_style.Sheets[wb_xlsx_style.SheetNames[i]];
        var range = XLSX.utils.decode_range(ws['!ref']);
        Object.keys(ws).forEach(key => {
            if (ws_s[key]) {
                let s = ws_s[key].s;
                ws_s[key] = ws[key];
                ws_s[key].s = s;
            }
        });

        /* ELIMINER LES BACKGROUND NOIR */
        for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
            // loo all cells in the current column
            for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
                let cellName = XLSX.utils.encode_cell({r: rowNum, c: colNum});
                // cell styled
                const cellStyled = ws_s[cellName];
                if (cellStyled && cellStyled.s) {
                    if (cellStyled.s.fill && cellStyled.s.fill.bgColor)
                        if (cellStyled.s.fill.bgColor.rgb === '000000') { // if bg is dark
                            cellStyled.s.fill.bgColor = {}; // set bg to white
                            delete cellStyled.s.fill;
                            ws_s[cellName].s = cellStyled.s;
                    }
                }
            }
        }
        
    }

    return wb_xlsx_style;
}


// arrange transport
const arrangeTRANSPORTS = (ws) => {
    let data = [];
    let data_trans = findData(ws, columsNames.transp).map(e => e.c);
    let temp = null;
    data_trans.forEach(e => {
        data.push(e);
        if (temp !== null) {
            if (new String(e).substring(0, 1) === 'N' && new String(e).substring(1, 2) === new String(temp).substring(1, 2)) {
                let data_comb = [temp, e];
                data[data.indexOf(temp)] = data_comb;
                data.pop();
            }
        }
        temp = e;
    });
    return data;
}

const getColumnName = (ws, columnName) => {
    return findData(ws, columnName).map(e => e.c);
}

const getGroupedRequiredCol = (ws) => {
    // group column
    let MCODE_col = getColumnName(ws, 'M-CODE');
    let NUMBERINGAGENT_col = getColumnName(ws,'Numbering Agent');
    let NOMBREREPAS_col = getColumnName(ws,'NOMBRE DE REPAS');
    let TRANSPORT_col = arrangeTRANSPORTS(ws);
    return groupCol(MCODE_col, NUMBERINGAGENT_col, NOMBREREPAS_col, TRANSPORT_col);
}

const groupCol = (...cols) => {
    let data = [];
    for (let i = 0; i < cols[0].length; i++) {
        let coldata = [];
        cols.forEach(el => {
            if (el[i].constructor === Array) {
                el[i].forEach(e => {
                    coldata.push(e);
                })
            } else {
                coldata.push(el[i]);
            }
        })
        data.push(coldata)
    }
    return data;
}

// afficher toutes les données de chaque colonne
const fetchData = (ws, group_col_data = []) => {
    // const xlsx = require('xlsx');
    let jsonArray = [];
    if (group_col_data.length === 0)
        group_col_data = getGroupedRequiredCol(ws);

    group_col_data.forEach(array => {
        let line = parseInt(array[1].substring(1, array[1].length)) + 1;
        let letter0 = array[0].substring(0, 1); // M-CODE
        let letter1 = array[1].substring(0, 1); // Numbering Agent
        // const rows = xlsx.utils.sheet_to_json(ws, {header:1, blankrows: true});
        while (ws[letter0+line] || ws[letter1+line]) {
            // objet pour construire un élément.
            let obj = {};
            // creer un key shift sur l'objet.
            let shift = ws[letter0+(parseInt(array[0].substring(1, array[0].length)) - 1)];
            if (shift) obj[columsNames.shift] = shift.v;
            // parcourir le tableau cols
            array.forEach(val => {
                let letter_i = val.substring(0, 1);
                // si la valeur de la colonne Numbering Agent n'est pas vide.
                if (ws[letter_i+line]) {
                    obj[ws[val].w] = ws[letter_i+line].w || '';
                } else {
                    obj[ws[val].w] = ''; // definir vide par défaut si la cellule est vide.
                }
            })
            // ajouter dans le tableau l'objet qu'on a crée.
            jsonArray.push(obj);
            // passer dans la ligne suivante.
            line++;
        }
    });
    // retourner la le tableau.
    return jsonArray;
}


const createOutput = (DATA_RH = [], wb) => {
    const xlsx = require('xlsx');
    // creer un nouveau work book
    var newWorkbook = wb;
    // parcourir tous les feuilles SHEETS
    for (let i = 0; i < newWorkbook.SheetNames.length; i++) {
        let ws = newWorkbook.Sheets[newWorkbook.SheetNames[i]];
        // chercher ou se situe le 2000 et 1000
        let colsToFill = Array.from(Object.keys(ws)).filter(v => ws[v].w === getVar().transpprice.night
            || ws[v].w === getVar().transpprice.day
            || ws[v].w === 'TRANSPORT (2000/day)'
            || new String(ws[v].w).match('REPAS'));
            colsToFill = colsToFill.map(e => { return {c: e, v: ws[e]} });
        // total transport
        // let total_col = Array.from(Object.keys(ws)).find(v => new String(ws[v].w).match('TOTAL'));
        let important_cols = ['A', 'B'];
        let first_A_col = Object.keys(ws).find(e => e.includes(important_cols[0]));
        let line = parseInt(first_A_col.substring(1, first_A_col.length));
        const rows = xlsx.utils.sheet_to_json(ws, {header:1, blankrows: true});
        let target100 = null, 
            target200 = null;
        while (line <= rows.length) {
            if (ws[important_cols[0] + line] !== undefined || ws[important_cols[1] + line] !== undefined) {
                // numbering agent
                let numberingagent = new String(ws[important_cols[0]+line]?.w ?? '').trim();
                let mcode = new String(ws[important_cols[1]+line]?.w ?? '').trim();
                let info = null;

                // PDFButler
                if (new String(numberingagent).match('PDFB-')) {
                    info = DATA_RH.find(e => e[columsNames.number] === numberingagent);
                } else if (new String(numberingagent).includes('GARDIEN CHARLES')) {
                    info = DATA_RH.find(e => e[columsNames.mcode] === 'Gardien');
                } else {
                    // get info via RH by M-CODE and Numbering Agent
                    info = DATA_RH.find(e => e[columsNames.number] === numberingagent && e[columsNames.mcode] === mcode);
                }
                if (info) {
                    // increment the numbers of agent
                    var col2000 = colsToFill.find(e => e.v.v === parseFloat(getVar().transpprice.day));
                    var col1000 = colsToFill.find(e => e.v.v === parseFloat(getVar().transpprice.night));
                    if (col1000) target100 = col1000.c.substring(0, 1)+line;
                    if (col2000) target200 = col2000.c.substring(0, 1)+line;
                    switch (info[columsNames.shift]) {
                        case 'SHIFT 3' : case 'SHIFT WEEKEND':
                            // 1000
                            if (col1000) {
                                if (columsNames.transpnight in info) {
                                    ws[target100].v = parseFloat(info[columsNames.transpnight]) || 0;
                                    ws[target100].w = info[columsNames.transpnight];
                                }
                            }
                            // 2000
                            if (col2000) {
                                if (columsNames.transpday in info) {
                                    ws[target200].v = parseFloat(info[columsNames.transpday]) || 0;
                                    ws[target200].w = info[columsNames.transpday];
                                }
                            }
                           
                            
                        break;
                        default: 
                            // for gardien
                            if (info[columsNames.mcode] === 'Gardien') {
                                ws['I'+line].v = parseFloat(info[columsNames.transp]) || 0;
                                ws['I'+line].w = info[columsNames.transp];
                            }
                            else if (ws[colsToFill[0].c.substring(0, 1)+line]) {
                                ws[colsToFill[0].c.substring(0, 1)+line].v = parseFloat(info[columsNames.transp]) || 0;
                                ws[colsToFill[0].c.substring(0, 1)+line].w = info[columsNames.transp];
                            }
                
                            break;
                    } 

                    if (col1000 && col2000) {
                        // set formule
                        let ciNames = colsIndexNames();
                        let indexOf100 = ciNames.indexOf(col1000.c.substring(0, 1));
                        let nextCol = ciNames[indexOf100 + 1];
                        if (nextCol.length === 1) {
                            if (target100 !== null  && target200 !== null) {
                                if (info[columsNames.mcode] !== 'Gardien')
                                    ws[nextCol+line].f = `${target200}*${col2000.c}+${target100}*${col1000.c}`;
                            }
                        } 
                    }
                    
                    // Nombre de repas
                    colRep = info[columsNames.mcode] !== 'Gardien' ? 
                        colsToFill.find(e => new String(e.v.v).toUpperCase().match('REPAS'))
                        : {c: 'G43'};
                    
                    if (colRep) {
                        if (columsNames.repas in info) {
                            if (typeof ws[colRep.c.substring(0, 1)+line] === 'undefined')
                                ws[colRep.c.substring(0, 1)+line] = {};
                            ws[colRep.c.substring(0, 1)+line].t = 'n';
                            let number = info[columsNames.mcode] === 'Gardien' ? (parseFloat(info[columsNames.repas]) || 0) : (parseFloat(info[columsNames.repas]) || 0) * parseFloat(getVar().repas);
                            ws[colRep.c.substring(0, 1)+line].v = number;
                            ws[colRep.c.substring(0, 1)+line].w = ws[colRep.c.substring(0, 1)+line].v;
                        }
                    }
                }
            }
            line ++;
        }
    }

    return newWorkbook;
    
}

// sauvegarder le fichier xlsx
const saveFile = (wb, wbs, filename) => {
    let save = require('sheetjs-style');
    save.writeFile(combineStyle(wb, wbs), filename, {type: 'file'});
}

function randomCode(length = 6) {
    var code = "";
    let v = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!é&#";
    for (let i = 0; i < length; i++) { // 6 characters
      let char = v.charAt(Math.random() * v.length - 1);
      code += char;
    }
    return code;
}

// RANDOM NUMBER CODE
function randomnNumberCode(length = 6) {
    var code = "";
    let v = "0123456789";
    for (let i = 0; i < length; i++) { // 6 characters
      let char = v.charAt(Math.random() * v.length - 1);
      code += char;
    }
    return code;
}

// ===========================================================
/**
 * SALARY EXTRACTION
 */
// ===========================================================

 const createOutputSalaryUp = (DATA_RH = [], wb) => {
    const xlsx = require('xlsx');
    // creer un nouveau work book
    var newWorkbook = wb;
    const sheetColumn = getVar();
    // parcourir tous les feuilles SHEETS
    for (let i = 0; i < newWorkbook.SheetNames.length; i++) {
        let ws = newWorkbook.Sheets[newWorkbook.SheetNames[i]];
        // target column to salary up
        let colGSS = sheetColumn.gss['sheet'+(i+1)];
        let colSalaryUp = colGSS ? (colGSS['up'] || null) : null;
        
        // total transport
        let important_cols = ['A', 'B'];
        let first_A_col = Object.keys(ws).find(e => e.includes(important_cols[0]));
        let line = parseInt(first_A_col.substring(1, first_A_col.length));
        const rows = xlsx.utils.sheet_to_json(ws, {header:1, blankrows: true});
        while (line <= rows.length) {
            if (ws[important_cols[0]+line] && ws[important_cols[1]+line]) {
                // numbering agent
                let numberingagent = new String(ws[important_cols[0]+line].w).trim();
                let mcode = new String(ws[important_cols[1]+line].w).trim();
                // get info via RH by M-CODE and Numbering Agent
                let info = DATA_RH.find(e => e[columsNames.number] === numberingagent && e[columsNames.mcode] === mcode);
                if (info) {
                    // salary 
                    if (columsNames.salaryUP in info) {
                        // cols to fill
                        if (colSalaryUp) {
                            let colIndex = colSalaryUp+line;
                            if (!ws[colIndex]) {
                                ws[colIndex] = {t: 'n'}
                            }
                            ws[colIndex].v = info[columsNames.salaryUP];
                            ws[colIndex].w = new String(info[columsNames.salaryUP]);
                        }
                    }
                }
            }
            line ++;
        }
    }

    return newWorkbook;
}

const getSalaryUPData = (ws) => {
    const XLSX = require('xlsx');
    var data = [];
    var range = XLSX.utils.decode_range(ws['!ref']);
    for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
        // loo all cells in the current column
        let obj = {};
        for (let colNum = range.s.c; colNum <= 3; colNum++) {
            let cellName = XLSX.utils.encode_cell({r: rowNum, c: colNum});
            // cell styled
            const cell = ws[cellName];
            if (cell) {
                if (cellName.includes('A')) obj[columsNames.number] = cell.w;
                if (cellName.includes('B')) obj[columsNames.mcode] = cell.w;
                if (cellName.includes('C')) obj[columsNames.salaryUP] = parseFloat(cell.w) || 0;
            }
        // NOTE: secondCell is undefined if it does not exist (i.e. if its empty)
        }
        // if keys exist
        if (columsNames.mcode in obj && columsNames.salaryUP in obj) 
            data.push(obj);
    }
    return data;
}

// ===========================================================
/**
 * AGROBOX
 */
// ===========================================================

const createOutputSalaryAGROBOX = (DATA_RH = [], wb) => {
    const xlsx = require('xlsx');
    // creer un nouveau work book
    var newWorkbook = wb;
    const sheetColumn = getVar();
    // parcourir tous les feuilles SHEETS
    for (let i = 0; i < newWorkbook.SheetNames.length; i++) {
        let ws = newWorkbook.Sheets[newWorkbook.SheetNames[i]];
        // target column to salary agrobox
        let colGSS = sheetColumn.gss['sheet'+(i+1)];
        let colSalaryAgrobox = colGSS ? (colGSS['agrobox'] || null) : null;
        
        // total transport
        let important_cols = ['A', 'B'];
        let first_A_col = Object.keys(ws).find(e => e.includes(important_cols[0]));
        let line = parseInt(first_A_col.substring(1, first_A_col.length));
        const rows = xlsx.utils.sheet_to_json(ws, {header:1, blankrows: true});
        while (line <= rows.length) {
            if (ws[important_cols[0]+line] && ws[important_cols[1]+line]) {
                // numbering agent
                let numberingagent = new String(ws[important_cols[0]+line].w).trim();
                let mcode = new String(ws[important_cols[1]+line].w).trim();
                // get info via RH by M-CODE and Numbering Agent
                let info = DATA_RH.find(e => e[columsNames.number] === numberingagent && e[columsNames.mcode] === mcode);
                if (info) {
                    // salary 
                    if (columsNames.salaryAGROBOX in info) {
                        // cols to fill
                        if (colSalaryAgrobox) {
                            let colIndex = colSalaryAgrobox+line;
                            if (!ws[colIndex]) {
                                ws[colIndex] = {t: 'n'}
                            }
                            ws[colIndex].v = info[columsNames.salaryAGROBOX];
                            ws[colIndex].w = new String(info[columsNames.salaryAGROBOX]);
                        }
                    }
                }
            }
            line ++;
        }
    }

    return newWorkbook;
    
}

const getSalaryAgroboxData = (ws) => {
    const XLSX = require('xlsx');
    var data = [];
    var range = XLSX.utils.decode_range(ws['!ref']);
    for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
        // loo all cells in the current column
        let obj = {};
        for (let colNum = range.s.c; colNum <= 3; colNum++) {
            let cellName = XLSX.utils.encode_cell({r: rowNum, c: colNum});
            // cell styled
            const cell = ws[cellName];
            if (cell) {
                if (cellName.includes('A')) obj[columsNames.number] = cell.w;
                if (cellName.includes('B')) obj[columsNames.mcode] = cell.w;
                if (cellName.includes('C')) obj[columsNames.salaryAGROBOX] = parseFloat(cell.v) || 0;
            }
        // NOTE: secondCell is undefined if it does not exist (i.e. if its empty)
        }
        // if keys exist
        if ((columsNames.mcode in obj || columsNames.number in obj) && columsNames.salaryAGROBOX in obj) 
            data.push(obj);
    }
    return data;
}

// ===========================================================
/**
 * ACRO
 */
// ===========================================================

const createOutputSalaryARCO = (DATA_RH = [], wb) => {
    const xlsx = require('xlsx');
    // creer un nouveau work book
    var newWorkbook = wb;
    const sheetColumn = getVar();
    // parcourir tous les feuilles SHEETS
    for (let i = 0; i < newWorkbook.SheetNames.length; i++) {
        let ws = newWorkbook.Sheets[newWorkbook.SheetNames[i]];
        // target column to salary arco
        let colGSS = sheetColumn.gss['sheet'+(i+1)];
        let colSalaryArco = colGSS ? (colGSS['arco'] || null)  : null;
        
        // total transport
        let important_cols = ['A', 'B'];
        let line = 0;
        const rows = xlsx.utils.sheet_to_json(ws, {header:1, blankrows: true});
        while (line <= rows.length) {
            if (ws[important_cols[0]+line] && ws[important_cols[1]+line]) {
                // numbering agent
                let numberingagent = new String(ws[important_cols[0]+line].w).trim();
                let mcode = new String(ws[important_cols[1]+line].w).trim();
                // get info via RH by M-CODE and Numbering Agent
                let info = DATA_RH.find(e => e[columsNames.number] === numberingagent && e[columsNames.mcode] === mcode);
                if (info) {
                    // salary 
                    if (columsNames.salaryARCO in info) {
                        // cols to fill
                        if (colSalaryArco) {
                            let colIndex = colSalaryArco+line;
                            if (!ws[colIndex]) {
                                ws[colIndex] = {t: 'n'}
                            }
                            ws[colIndex].v = info[columsNames.salaryARCO];
                            ws[colIndex].w = new String(info[columsNames.salaryARCO]);
                        }
                    }
                }
            }
            line ++;
        }
    }

    return newWorkbook;
    
}

const getSalaryArcoData = (ws) => {
    const XLSX = require('xlsx');
    var data = [];
    var range = XLSX.utils.decode_range(ws['!ref']);
    for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
        // loo all cells in the current column
        let obj = {};
        for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
            let cellName = XLSX.utils.encode_cell({r: rowNum, c: colNum});
            // cell styled
            const cell = ws[cellName];
            if (cell) {
                if (cellName.includes('J')) obj[columsNames.number] = cell.w;
                if (cellName.includes('I')) obj[columsNames.mcode] = cell.w;
                if (cellName.includes('L')) {
                    obj[columsNames.salaryARCO] = Math.round(parseFloat(cell.v)) || 0;
                }
            }
        }
        // if keys exist
        if ((columsNames.mcode in obj || columsNames.number in obj) && columsNames.salaryARCO in obj) 
            data.push(obj);
    }
    return data;
}


// ===========================================================
/**
 * UPC
 */
// ===========================================================
 const getSalaryUPCData = (ws) => {
    const XLSX = require('xlsx');
    var data = [];
    var range = XLSX.utils.decode_range(ws['!ref']);
    for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
        // loo all cells in the current column
        let obj = {};
        for (let colNum = range.s.c; colNum <= 3; colNum++) {
            let cellName = XLSX.utils.encode_cell({r: rowNum, c: colNum});
            // cell styled
            const cell = ws[cellName];
            if (cell) {
                if (cellName.includes('A')) obj[columsNames.number] = cell.w;
                if (cellName.includes('B')) obj[columsNames.mcode] = cell.w;
                if (cellName.includes('C')) obj[columsNames.salaryUPC] = parseFloat(cell.w) || 0;
            }
        }
        // if keys exist
        if (columsNames.mcode in obj && columsNames.salaryUPC in obj) 
            data.push(obj);
    }
    return data;
}

const createOutputSalaryUPC = (DATA_RH = [], wb) => {
    const xlsx = require('xlsx');
    // creer un nouveau work book
    var newWorkbook = wb;
    const sheetColumn = getVar();
    // parcourir tous les feuilles SHEETS
    for (let i = 2; i <= 4; i++) {
        let ws = newWorkbook.Sheets[newWorkbook.SheetNames[i]];
        // target column to salary agrobox
        let colGSS = sheetColumn.gss['sheet'+(i+1)];
        let colSalaryAgrobox = colGSS ? (colGSS['upc'] || null) : null;
        
        // total transport
        let important_cols = ['A', 'B'];
        let first_A_col = Object.keys(ws).find(e => e.includes(important_cols[0]));
        let line = parseInt(first_A_col.substring(1, first_A_col.length));
        const rows = xlsx.utils.sheet_to_json(ws, {header:1, blankrows: true});
        while (line <= rows.length) {
            if (ws[important_cols[0]+line] && ws[important_cols[1]+line]) {
                // numbering agent
                let numberingagent = new String(ws[important_cols[0]+line].w).trim();
                let mcode = new String(ws[important_cols[1]+line].w).trim();
                // get info via RH by M-CODE and Numbering Agent
                let info = DATA_RH.find(e => e[columsNames.number] === numberingagent && e[columsNames.mcode] === mcode);
                if (info) {
                    // salary 
                    if (columsNames.salaryUPC in info) {
                        // cols to fill
                        if (colSalaryAgrobox) {
                            let colIndex = colSalaryAgrobox+line;
                            if (!ws[colIndex]) {
                                ws[colIndex] = {t: 'n'}
                            }
                            ws[colIndex].v = info[columsNames.salaryUPC];
                            ws[colIndex].w = new String(info[columsNames.salaryUPC]);
                        }
                    }
                }
            }
            line ++;
        }
    }

    return newWorkbook;
}


// convert date to [dd,mm,yyyy]
function getDateNow() {
    var date = new Date(Date.now()),
    mnth = ("0" + (date.getMonth() + 1)).slice(-2),
    day = ("0" + date.getDate()).slice(-2);
    return [day,  mnth, date.getFullYear()];
}

// delete file
const deleteFile = (filePath, ms) => {
    const fs = require('fs');
    setTimeout(() => {
        // check file if exists
        if (fs.existsSync(filePath))
            fs.unlinkSync(filePath);
    }, ms);
}


/**
 * Add point to have a clear date
 * 0000000 => 00.00.0000
 */
const getDateInFileName = (filename) => {
    try {
        let date = filename.split(' ')[0];
        return date.substring(0,2) +'.'+date.substring(2,4)+'.'+date.substring(4,date.length);   
    } catch {
        return ".";
    }
}

/**
GET file name
*/
const getFirstDateInOutputFilename = (filename = '') => {
    try {
        let splitted = filename.split('-');
        return splitted.length === 1 ? null : filename.split('-')[0];
    } catch {
        return null;
    }
}

const getVar = () => {
    const json = require('./var.json');
    return json;
}

const accessDB = async (func) => {
    require('mongoose').connect(
        process.env.MONGO_URI, {
        useUnifiedTopology: true,
        UseNewUrlParser: true
    }).then(async () => {
        return func();
    }).catch(err => {
        console.log(err);
    });
}

// ===========================================================
/**
 * JeFACTURE
 */
// ===========================================================

const getSalaryJEFACTUREData = (ws) => {
    const XLSX = require('xlsx');
    var data = [];
    var range = XLSX.utils.decode_range(ws['!ref']);
    for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
        // loo all cells in the current column
        let obj = {};
        for (let colNum = range.s.c; colNum <= 3; colNum++) {
            let cellName = XLSX.utils.encode_cell({r: rowNum, c: colNum});
            // cell styled
            const cell = ws[cellName];
            if (cell) {
                if (cellName.includes('A')) obj[columsNames.number] = cell.w;
                if (cellName.includes('B')) obj[columsNames.mcode] = cell.w;
                if (cellName.includes('C')) obj[columsNames.salaryJEFACTURE] = parseFloat(cell.w) || 0;
            }
        }
        // if keys exist
        if (columsNames.mcode in obj && columsNames.salaryJEFACTURE in obj) 
            data.push(obj);
    }
    return data;
}

const createOutputSalaryJEFACTURE = (JFACTURE_Data = [], wb) => {
    const xlsx = require('xlsx');
    // creer un nouveau work book
    var newWorkbook = wb;
    const sheetColumn = getVar();
    // parcourir tous les feuilles SHEETS
    for (let i = 2; i < 3; i++) {
        let ws = newWorkbook.Sheets[newWorkbook.SheetNames[i]];
        // target column to salary agrobox
        let colGSS = sheetColumn.gss['sheet'+(i+1)];
        let colSalaryJEFACTURE = colGSS ? (colGSS['jefacture'] || null) : null;
        
        // total transport
        let important_cols = ['A', 'B'];
        let first_A_col = Object.keys(ws).find(e => e.includes(important_cols[0]));
        let line = parseInt(first_A_col.substring(1, first_A_col.length));
        const rows = xlsx.utils.sheet_to_json(ws, {header:1, blankrows: true});
        while (line <= rows.length) {
            if (ws[important_cols[0]+line] && ws[important_cols[1]+line]) {
                // numbering agent
                let numberingagent = new String(ws[important_cols[0]+line].w).trim();
                let mcode = new String(ws[important_cols[1]+line].w).trim();
                // get info via RH by M-CODE and Numbering Agent
                let info = JFACTURE_Data.find(e => e[columsNames.number] === numberingagent && e[columsNames.mcode] === mcode);
                if (info) {
                    // salary 
                    if (columsNames.salaryJEFACTURE in info) {
                        // cols to fill
                        if (colSalaryJEFACTURE) {
                            let colIndex = colSalaryJEFACTURE+line;
                            if (!ws[colIndex]) {
                                ws[colIndex] = {t: 'n'}
                            }
                            ws[colIndex].v = info[columsNames.salaryJEFACTURE];
                            ws[colIndex].w = new String(info[columsNames.salaryJEFACTURE]);
                        }
                    }
                }
            }
            line ++;
        }
    }

    return newWorkbook;
}





// export functions
module.exports = {
    accessDB,
    readWBxlsx,
    readWBxlsxstyle,
    combineStyle,
    arrangeTRANSPORTS,
    getColumnName,
    groupCol,
    fetchData,
    createOutput,
    createOutputSalaryUp,
    saveFile,
    getWS,
    getGroupedRequiredCol,
    randomCode,
    randomnNumberCode,
    colsIndexNames,
    getSalaryUPData,
    getSalaryAgroboxData,
    createOutputSalaryAGROBOX,
    getSalaryArcoData,
    createOutputSalaryARCO,
    getDateNow,
    getSheetIndex,
    deleteFile,
    getVar,
    getDateInFileName,
    getFirstDateInOutputFilename,
    getSalaryUPCData,
    createOutputSalaryUPC,
    getSalaryJEFACTUREData,
    createOutputSalaryJEFACTURE
};