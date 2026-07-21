/**
 * Urge Quiz → Google Sheet backup
 *
 * Setup (5 min):
 * 1. Create a Google Sheet, name tab "Leads"
 * 2. Extensions → Apps Script → paste this file
 * 3. Deploy → New deployment → Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the Web App URL
 * 5. On the iPad quiz: long-press URGE → Staff → paste Webhook URL → Save webhook
 *
 * First row headers are created automatically.
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
    .createTextOutput('Urge quiz webhook is live. POST JSON leads here.')
    .setMimeType(ContentService.MimeType.TEXT);
}
