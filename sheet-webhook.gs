/**
 * Urge Quiz → Google Sheet + Shopify customers
 *
 * Receives POST JSON from the quiz kiosk.
 * 1) Appends a row to the "Leads" tab
 * 2) Upserts a Shopify customer with marketing consent (same list as site waitlist)
 *
 * SHOPIFY_ADMIN_TOKEN is set via one-time configure POST (or Script Properties).
 */

var SHEET_NAME = 'Leads';
var SHOP = '1rfgq1-eb.myshopify.com';
var API_VERSION = '2025-01';

function doPost(e) {
  try {
    var data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }

    // One-time / refresh: set Shopify Admin token for customer upserts
    // Body: { "_configureShopify": true, "token": "..." }
    if (data && data._configureShopify && data.token) {
      PropertiesService.getScriptProperties().setProperty('SHOPIFY_ADMIN_TOKEN', String(data.token));
      return jsonOut({ ok: true, configured: true });
    }

    appendLeadRow(data);
    var shopify = upsertShopifyCustomer(data);

    return jsonOut({ ok: true, shopify: shopify });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function doGet() {
  var hasToken = !!PropertiesService.getScriptProperties().getProperty('SHOPIFY_ADMIN_TOKEN');
  return ContentService
    .createTextOutput('Urge quiz webhook live. Sheet=yes ShopifyToken=' + (hasToken ? 'yes' : 'no'))
    .setMimeType(ContentService.MimeType.TEXT);
}

function appendLeadRow(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  var headers = [
    'createdAt', 'email', 'firstName', 'lastName', 'birthday',
    'score', 'total', 'perfect', 'winner', 'nearMiss',
    'event', 'express', 'consent', 'id', 'userAgent', 'shopifyCustomerId'
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  sheet.appendRow(headers.map(function (h) {
    var v = data[h];
    if (v === true || v === false) return v ? 'TRUE' : 'FALSE';
    return v == null ? '' : v;
  }));
}

function upsertShopifyCustomer(data) {
  var email = String(data.email || '').trim().toLowerCase();
  if (!email || email.indexOf('@') < 0) {
    return { skipped: true, reason: 'no_email' };
  }

  var token = PropertiesService.getScriptProperties().getProperty('SHOPIFY_ADMIN_TOKEN');
  if (!token) {
    return { skipped: true, reason: 'no_shopify_token' };
  }

  var tags = ['waitlist', 'free samples', 'early access', 'quiz', 'source:quiz'];
  if (data.winner || data.perfect) tags.push('quiz-winner');
  if (data.event) tags.push('event:' + String(data.event).replace(/,/g, ' '));

  // Find existing customer by email
  var search = shopifyGql(token, {
    query: 'query($q: String!) { customers(first: 1, query: $q) { nodes { id email tags } } }',
    variables: { q: 'email:' + email }
  });

  var nodes = ((((search || {}).data || {}).customers || {}).nodes) || [];
  var existing = nodes.length ? nodes[0] : null;

  if (existing && existing.id) {
    var mergedTags = uniqueTags((existing.tags || []).concat(tags));
    var upd = shopifyGql(token, {
      query: 'mutation($input: CustomerInput!) { customerUpdate(input: $input) { customer { id email tags emailMarketingConsent { marketingState } } userErrors { message } } }',
      variables: {
        input: {
          id: existing.id,
          firstName: data.firstName || undefined,
          lastName: data.lastName || undefined,
          tags: mergedTags,
          emailMarketingConsent: data.consent === false ? undefined : {
            marketingState: 'SUBSCRIBED',
            marketingOptInLevel: 'SINGLE_OPT_IN'
          },
          note: noteForLead(data)
        }
      }
    });
    // Also force marketing consent update
    if (data.consent !== false) {
      shopifyGql(token, {
        query: 'mutation($input: CustomerEmailMarketingConsentUpdateInput!) { customerEmailMarketingConsentUpdate(input: $input) { customer { id emailMarketingConsent { marketingState } } userErrors { message } } }',
        variables: {
          input: {
            customerId: existing.id,
            emailMarketingConsent: {
              marketingState: 'SUBSCRIBED',
              marketingOptInLevel: 'SINGLE_OPT_IN'
            }
          }
        }
      });
    }
    var uerr = ((((upd || {}).data || {}).customerUpdate || {}).userErrors) || [];
    return {
      action: 'updated',
      id: existing.id,
      errors: uerr
    };
  }

  var created = shopifyGql(token, {
    query: 'mutation($input: CustomerInput!) { customerCreate(input: $input) { customer { id email tags emailMarketingConsent { marketingState } } userErrors { message field } } }',
    variables: {
      input: {
        email: email,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        tags: tags,
        note: noteForLead(data),
        emailMarketingConsent: data.consent === false ? undefined : {
          marketingState: 'SUBSCRIBED',
          marketingOptInLevel: 'SINGLE_OPT_IN'
        }
      }
    }
  });

  var cust = ((((created || {}).data || {}).customerCreate || {}).customer) || null;
  var cerr = ((((created || {}).data || {}).customerCreate || {}).userErrors) || [];
  if (cust && cust.id && data.consent !== false) {
    shopifyGql(token, {
      query: 'mutation($input: CustomerEmailMarketingConsentUpdateInput!) { customerEmailMarketingConsentUpdate(input: $input) { customer { id emailMarketingConsent { marketingState } } userErrors { message } } }',
      variables: {
        input: {
          customerId: cust.id,
          emailMarketingConsent: {
            marketingState: 'SUBSCRIBED',
            marketingOptInLevel: 'SINGLE_OPT_IN'
          }
        }
      }
    });
  }
  return {
    action: 'created',
    id: cust && cust.id,
    errors: cerr,
    rawErrors: (created && created.errors) || null
  };
}

function noteForLead(data) {
  var parts = [
    'Source: Urge Quiz Kiosk',
    'Score: ' + (data.score != null ? data.score : '') + '/' + (data.total != null ? data.total : ''),
    data.winner || data.perfect ? 'Prize winner (10/10)' : '',
    data.event ? 'Event: ' + data.event : '',
    data.birthday ? 'Birthday: ' + data.birthday : '',
    data.id ? 'LeadId: ' + data.id : ''
  ];
  return parts.filter(Boolean).join(' | ');
}

function uniqueTags(arr) {
  var seen = {};
  var out = [];
  (arr || []).forEach(function (t) {
    var k = String(t || '').trim();
    if (!k || seen[k]) return;
    seen[k] = true;
    out.push(k);
  });
  return out;
}

function shopifyGql(token, payload) {
  var url = 'https://' + SHOP + '/admin/api/' + API_VERSION + '/graphql.json';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      // CLI identity tokens use Bearer; custom app tokens use X-Shopify-Access-Token
      'Authorization': 'Bearer ' + token,
      'X-Shopify-Access-Token': token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var text = res.getContentText();
  try {
    var parsed = JSON.parse(text);
    if (code >= 400) {
      return { httpError: code, body: parsed };
    }
    return parsed;
  } catch (e) {
    return { httpError: code, body: text };
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
