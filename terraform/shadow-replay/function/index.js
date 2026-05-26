'use strict';
const https = require('https');
const http = require('http');
const { URL } = require('url');

const STAGING_API_URL = process.env.STAGING_API_URL;
const STAGING_API_KEY = process.env.STAGING_API_KEY;
const FORWARD_PERCENTAGE = parseInt(process.env.FORWARD_PERCENTAGE || '100');
const IGNORE_PATHS = (process.env.IGNORE_PATHS || '/health,/metrics').split(',');

exports.handler = async (event) => {
  const records = event.Records || [];
  const results = { forwarded: 0, skipped: 0, errors: 0 };

  for (const record of records) {
    try {
      // Kinesis records are base64 encoded
      const payload = JSON.parse(
        Buffer.from(record.kinesis.data, 'base64').toString('utf8')
      );

      // Skip ignored paths
      if (IGNORE_PATHS.some(p => payload.path?.startsWith(p))) {
        results.skipped++;
        continue;
      }

      // Apply sampling percentage
      if (Math.random() * 100 > FORWARD_PERCENTAGE) {
        results.skipped++;
        continue;
      }

      // Forward to staging (fire-and-forget, don't wait for response)
      await forwardRequest(payload);
      results.forwarded++;
    } catch (err) {
      console.error('Failed to process record:', err.message);
      results.errors++;
    }
  }

  console.log('Shadow replay results:', JSON.stringify(results));
  return results;
};

async function forwardRequest(payload) {
  const stagingUrl = new URL(payload.path || '/', STAGING_API_URL);
  if (payload.query) stagingUrl.search = payload.query;

  const isHttps = stagingUrl.protocol === 'https:';
  const options = {
    hostname: stagingUrl.hostname,
    port: stagingUrl.port || (isHttps ? 443 : 80),
    path: stagingUrl.pathname + stagingUrl.search,
    method: payload.method || 'GET',
    headers: {
      ...stripSensitiveHeaders(payload.headers || {}),
      'x-shadow-replay': 'true',
      'x-shadow-timestamp': payload.timestamp || new Date().toISOString(),
      'x-api-key': STAGING_API_KEY,
      'content-type': 'application/json',
    },
    timeout: 10000,
  };

  return new Promise((resolve) => {
    const lib = isHttps ? https : http;
    const req = lib.request(options, (res) => {
      res.resume(); // Drain response
      resolve({ status: res.statusCode });
    });
    req.on('error', () => resolve({ status: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0 }); });
    if (payload.body && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      req.write(typeof payload.body === 'string' ? payload.body : JSON.stringify(payload.body));
    }
    req.end();
  });
}

function stripSensitiveHeaders(headers) {
  const blocked = new Set(['authorization', 'cookie', 'x-api-key', 'stripe-signature']);
  return Object.fromEntries(
    Object.entries(headers).filter(([k]) => !blocked.has(k.toLowerCase()))
  );
}
