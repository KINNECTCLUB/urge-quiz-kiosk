/**
 * Urge Quiz → Google Sheet
 *
 * 1. New Google Sheet, rename tab to "Leads"
 * 2. Extensions → Apps Script → paste this whole file → Save
 * 3. Deploy → New deployment → Type: Web app
 *    Execute as: Me
 *    Who has access: Anyone
 * 4. Copy the Web App URL (ends in /exec)
 * 5. iPad quiz → long-press logo → Staff → paste URL → Save webhook
 * 6. Play one test → row should appear in the Sheet
 */

var SHEET_NAME = 'Leads';

function doPost(e) {
  try {
    var data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    var headers = [
      'createdAt', 'email', 'firstName', 'lastName', 'birthday',
      'score', 'total', 'perfect', 'winner', 'nearMiss',
      'event', 'express', 'consent', 'id', 'userAgent'
    ];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    }

    sheet.appendRow(headers.map(function (h) {
      var v = data[h];
      if (v === true || v === false) return v ? 'TRUE' : 'FALSE';
      return v == null ? '' : v;
    }));

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput('Urge quiz Sheet webhook is live. POST JSON leads here.')
    .setMimeType(ContentService.MimeType.TEXT);
}
