// mTLS: Who is connecting?
// Gateway: Is this request allowed through, and where should it go?
// Application-layer encryption: Can an intermediary read the sensitive business payload?
// Internal service: Decrypts the payload and performs the business operation.

// The gateway acts as a security and routing boundary, not as the application encryption mechanism itself.
const https = require('https');
const fs = require('fs');

const read = (name) =>
  fs.readFileSync(`${__dirname}/../certs/${name}`);

const internalAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 20,
  timeout: 30000
});

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = https.createServer({
  key: read('gateway.key'),
  cert: read('gateway.crt'),
  ca: read('ca.crt'),
  requestCert: true,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2'
}, (req, res) => {
  if (req.socket.getPeerCertificate().subject?.CN !== 'external-client') {
    return send(res, 403, { error: 'External client identity required' });
  }

  if (req.method !== 'POST' ||
    !['/fund-transfer', '/balance', '/refund'].includes(req.url)) {
    return send(res, 404, { error: 'Route not found' });
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 100_000) req.destroy();
  });

  req.on('end', () => {
    // The gateway routes the envelope unchanged.
    let timedOut = false;
    
    const upstream = https.request({
      hostname: 'internal-service.application-layer-encryption.svc.cluster.local',
      port: 9443,
      path: req.url,
      method: 'POST',
      key: read('gateway-client.key'),
      agent: internalAgent,
      cert: read('gateway-client.crt'),
      ca: read('ca.crt'),
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      }
    }, upstreamRes => {
      let response = '';

      upstreamRes.on('data', chunk => {
        response += chunk;
      });

      upstreamRes.on('end', () => {
        clearTimeout(upstreamTimeout);

        if (res.writableEnded) return;

        res.writeHead(upstreamRes.statusCode || 502, {
          'content-type': 'application/json'
        });

        res.end(response);
      });
    });

    const upstreamTimeout = setTimeout(() => {
      timedOut = true;
      upstream.destroy(new Error('Internal service request timed out'));
    }, 30000);

    upstream.on('error', err => {
      clearTimeout(upstreamTimeout);

      if (res.writableEnded) return;

      if (timedOut) {
        console.error('Internal service request timed out');
        return send(res, 504, {
          error: 'Internal service timeout'
        });
      }

      console.error('Internal service connection failed:', err.message);

      send(res, 502, {
        error: 'Internal service unavailable'
      });
    });

    upstream.end(body);
  });
});

server.listen(8443, '0.0.0.0', () => {
  console.log('API gateway listening on https://127.0.0.1:8443');
  console.log('Requires external-client mTLS certificate.');
});
