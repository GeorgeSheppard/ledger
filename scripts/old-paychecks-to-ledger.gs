/**
 * One-time converter: your old paycheck sheet -> Ledger's `_Paychecks` table.
 *
 * Use it once, then delete it:
 *  1. Open the OLD paycheck spreadsheet, then Extensions > Apps Script.
 *  2. Paste this whole file over the default code and save.
 *  3. Pick `convertOldPaychecks` in the toolbar and press Run (approve the permissions prompt).
 *
 * The old tab must have a header row with the columns
 *   Date, Tax Code, Tax Year, Total Income, Pension (Salary Sacrifice), Pension (Employer),
 *   Taxable Benefits, Income Tax, NI, Student Loan, Donations, Take Home
 * (in any order; or no header at all if the columns are in that order).
 *
 * Output is the plain table Ledger reads and Excel can chart, one row per payslip line:
 *   Date | Paycheck | Type | Name | Amount     (Type: Income / Benefit in kind / Deduction)
 *
 * By default it writes a new tab called "_Paychecks (new)" in the old spreadsheet; copy its rows
 * into the `_Paychecks` tab of your Ledger sheet. To skip the copying, put your Ledger
 * spreadsheet's id (the long part of its URL) in TARGET_SPREADSHEET_ID: the rows are then added
 * to its `_Paychecks` tab (below any paychecks already there), and nothing is written to the old sheet.
 *
 * Mapping:
 *  - Total Income -> Income "Salary"; Taxable Benefits -> Benefit in kind "Taxable benefits".
 *  - Income Tax, NI, Student Loan, Donations and Pension (Salary Sacrifice) -> Deductions.
 *  - Pension (Employer) is left out (paid by your employer, not part of take-home).
 *  - Tax Code and Tax Year are dropped. Zero amounts are skipped.
 *  - Take Home is only a check. Rows that do not add up are listed in the message when it finishes.
 *    If a row only adds up without the salary-sacrifice pension, that pension is not listed as a deduction.
 */

/** The old tab's name; leave empty to use the tab that is open. */
var SOURCE_SHEET = '';
/** Optional: the Ledger spreadsheet's id, to write straight into its `_Paychecks` tab. */
var TARGET_SPREADSHEET_ID = '';

var HEADER = ['Date', 'Paycheck', 'Type', 'Name', 'Amount'];
var COLUMNS = [
  'date',
  'taxCode',
  'taxYear',
  'income',
  'pensionSacrifice',
  'pensionEmployer',
  'benefits',
  'incomeTax',
  'ni',
  'studentLoan',
  'donations',
  'takeHome',
];
var HEADER_NAMES = {
  date: /^(date|paydate|paid)$/,
  taxCode: /^taxcode$/,
  taxYear: /^taxyear$/,
  income: /^(totalincome|income|gross|grosspay|salary)$/,
  pensionSacrifice: /^pension(salarysacrifice|sacrifice|ss)$/,
  pensionEmployer: /^pension(employer|er)$/,
  benefits: /^(taxablebenefits|benefits|benefitsinkind|bik)$/,
  incomeTax: /^(incometax|tax|paye)$/,
  ni: /^(ni|nationalinsurance)$/,
  studentLoan: /^studentloan$/,
  donations: /^(donations|donation|charity)$/,
  takeHome: /^(takehome|takehomepay|net|netpay)$/,
};

function convertOldPaychecks() {
  var source = SpreadsheetApp.getActive();
  var sheet = SOURCE_SHEET ? source.getSheetByName(SOURCE_SHEET) : source.getActiveSheet();
  if (!sheet) throw new Error('No tab called "' + SOURCE_SHEET + '".');
  // Older sheets can have no time zone set, so fall back to the script's, then UTC.
  var tz = source.getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'UTC';

  var result = convertRows_(sheet.getDataRange().getValues(), tz);
  if (result.paychecks.length === 0)
    throw new Error(
      'No paychecks could be read from "' + sheet.getName() + '".\n' + result.warnings.join('\n')
    );

  var target = TARGET_SPREADSHEET_ID ? SpreadsheetApp.openById(TARGET_SPREADSHEET_ID) : source;
  var tabName = TARGET_SPREADSHEET_ID ? '_Paychecks' : '_Paychecks (new)';
  var tab = target.getSheetByName(tabName);
  if (tab && !TARGET_SPREADSHEET_ID)
    throw new Error('"' + tabName + '" already exists. Delete it and run again.');
  if (!tab) tab = target.insertSheet(tabName);

  var existing =
    tab.getLastRow() > 0 ? tab.getRange(1, 1, tab.getLastRow(), HEADER.length).getValues() : [];
  var firstRow;
  var label;
  if (existing.length === 0) {
    tab.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight('bold');
    firstRow = 2;
    label = 1;
  } else {
    var header = existing[0].map(String);
    if (header.join('|').toLowerCase() !== HEADER.join('|').toLowerCase())
      throw new Error(
        'The `_Paychecks` tab is not the Date | Paycheck | Type | Name | Amount table. Open Ledger, change a paycheck so it rewrites the tab, then run this again.'
      );
    firstRow = existing.length + 1;
    label =
      existing.slice(1).reduce(function (max, row) {
        return Math.max(max, Number(row[1]) || 0);
      }, 0) + 1;
  }

  var rows = [];
  result.paychecks.forEach(function (p, i) {
    var parts = p.date.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    p.lines.forEach(function (l) {
      rows.push([date, String(label + i), l[0], l[1], l[2]]);
    });
  });
  tab.getRange(firstRow, 1, rows.length, HEADER.length).setValues(rows);
  tab.getRange(firstRow, 1, rows.length, 1).setNumberFormat('yyyy-mm-dd');
  tab
    .getRange(firstRow, 2, rows.length, 1)
    .setNumberFormat('@')
    .setValues(
      rows.map(function (r) {
        return [r[1]];
      })
    );
  tab.getRange(firstRow, 5, rows.length, 1).setNumberFormat('0.00');

  var message =
    'Wrote ' +
    result.paychecks.length +
    ' paychecks (' +
    rows.length +
    ' rows) to "' +
    tabName +
    '"' +
    (TARGET_SPREADSHEET_ID
      ? ' in the Ledger spreadsheet.'
      : ". Copy them into your Ledger sheet's `_Paychecks` tab.") +
    (result.warnings.length ? '\n\nCheck these:\n' + result.warnings.join('\n') : '');
  Logger.log(message);
  SpreadsheetApp.getUi().alert(message);
}

/** Pure conversion: sheet values -> { paychecks: [{date, lines: [[type, name, amount]]}], warnings }. */
function convertRows_(grid, tz) {
  var warnings = [];
  var paychecks = [];
  if (grid.length === 0) return { paychecks: paychecks, warnings: ['The tab is empty.'] };

  var index = {};
  grid[0].forEach(function (cell, i) {
    var key = String(cell)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    for (var c = 0; c < COLUMNS.length; c++) {
      if (index[COLUMNS[c]] === undefined && HEADER_NAMES[COLUMNS[c]].test(key)) {
        index[COLUMNS[c]] = i;
        break;
      }
    }
  });
  var hasHeader = index.date !== undefined && index.income !== undefined;
  if (!hasHeader) {
    index = {};
    COLUMNS.forEach(function (c, i) {
      index[c] = i;
    });
  }
  var rows = hasHeader ? grid.slice(1) : grid;

  var dayFirst = !rows.some(function (r) {
    var m = String(cellOf_(r, index.date))
      .trim()
      .match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-]\d{2,4}$/);
    return m && Number(m[1]) <= 12 && Number(m[2]) > 12 ? true : false;
  });

  var employer = 0;
  rows.forEach(function (row, n) {
    var label = 'Row ' + (n + (hasHeader ? 2 : 1));
    var date = parseDate_(cellOf_(row, index.date), dayFirst, tz);
    if (!date) {
      if (
        row.some(function (c) {
          return String(c).trim() !== '';
        })
      )
        warnings.push(label + ' skipped: no readable date.');
      return;
    }
    var amount = function (column) {
      return parseAmount_(cellOf_(row, index[column]));
    };
    var income = amount('income');
    if (!(income > 0)) {
      warnings.push(label + ' (' + date + ') skipped: Total Income is missing or not positive.');
      return;
    }

    var sacrifice = Math.abs(amount('pensionSacrifice') || 0);
    var others = ['incomeTax', 'ni', 'studentLoan', 'donations'].reduce(function (t, c) {
      return t + Math.abs(amount(c) || 0);
    }, 0);
    var takeHome = amount('takeHome');
    employer += Math.abs(amount('pensionEmployer') || 0);

    var matches = function (expected) {
      return takeHome !== null && Math.abs(round_(expected) - takeHome) < 0.01;
    };
    var deductSacrifice = true;
    if (
      takeHome !== null &&
      !matches(income - sacrifice - others) &&
      sacrifice > 0 &&
      matches(income - others)
    ) {
      deductSacrifice = false;
      warnings.push(
        label +
          ' (' +
          date +
          '): Take Home only adds up without the salary-sacrifice pension, so it is not listed as a deduction.'
      );
    }

    var lines = [['Income', 'Salary', income]];
    var add = function (type, name, value) {
      var v = Math.abs(value || 0);
      if (v > 0) lines.push([type, name, round_(v)]);
    };
    add('Benefit in kind', 'Taxable benefits', amount('benefits'));
    add('Deduction', 'Income tax', amount('incomeTax'));
    add('Deduction', 'National Insurance', amount('ni'));
    add('Deduction', 'Student loan', amount('studentLoan'));
    if (deductSacrifice) add('Deduction', 'Pension (salary sacrifice)', sacrifice);
    add('Deduction', 'Donations', amount('donations'));

    var net = lines.reduce(function (t, l) {
      return l[0] === 'Income' ? t + l[2] : l[0] === 'Deduction' ? t - l[2] : t;
    }, 0);
    if (takeHome !== null && Math.abs(round_(net) - takeHome) >= 0.01)
      warnings.push(
        label +
          ' (' +
          date +
          '): worked-out take-home ' +
          round_(net).toFixed(2) +
          ' does not match the Take Home column ' +
          takeHome.toFixed(2) +
          '.'
      );
    paychecks.push({ date: date, lines: lines });
  });

  if (employer > 0)
    warnings.push(
      'Pension (Employer) totalling ' +
        round_(employer).toFixed(2) +
        ' was left out: it is paid by your employer, not part of take-home pay.'
    );
  paychecks.sort(function (a, b) {
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
  return { paychecks: paychecks, warnings: warnings };
}

function cellOf_(row, i) {
  return i === undefined || row[i] === undefined ? '' : row[i];
}
function round_(n) {
  return Math.round(n * 100) / 100;
}
function pad_(n) {
  return (n < 10 ? '0' : '') + n;
}

/** A Date cell, `2026-09-25`, `25/09/2026` (day first unless a date proves month first) or `25 Sep 2026` -> `yyyy-mm-dd`. */
function parseDate_(value, dayFirst, tz) {
  if (Object.prototype.toString.call(value) === '[object Date]')
    return isNaN(value.getTime()) ? null : Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  var text = String(value)
    .trim()
    .split(/[T\s](?=\d{1,2}:)/)[0]
    .trim();
  var y, m, d, found;
  if ((found = text.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/))) {
    y = +found[1];
    m = +found[2];
    d = +found[3];
  } else if ((found = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})$/))) {
    y = +found[3];
    d = dayFirst ? +found[1] : +found[2];
    m = dayFirst ? +found[2] : +found[1];
  } else if (
    (found = text.match(/^(\d{1,2})[\s\-\/.]+([a-z]{3,9})\.?[\s\-\/.,]+(\d{2}|\d{4})$/i))
  ) {
    d = +found[1];
    y = +found[3];
    m =
      ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(
        found[2].slice(0, 3).toLowerCase()
      ) + 1;
  } else return null;
  if (y < 100) y += 2000;
  var check = new Date(Date.UTC(y, m - 1, d));
  if (
    !m ||
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  )
    return null;
  return y + '-' + pad_(m) + '-' + pad_(d);
}

/** A number, or text such as `£1,234.50`, `(12.30)` or `-12`; blank or non-numeric -> null. */
function parseAmount_(value) {
  if (typeof value === 'number') return round_(value);
  var text = String(value).trim();
  if (text === '') return null;
  var negative = /^\(.*\)$/.test(text) || /^-/.test(text);
  text = text.replace(/[^\d.]/g, '');
  if (text === '' || isNaN(Number(text))) return null;
  return round_(negative ? -Number(text) : Number(text));
}
