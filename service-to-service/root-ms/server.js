const http = require('http');
const https = require('https');
const fs = require('fs');

const options = {
  hostname: process.env.TRANSACTION_HOST || 'transaction-ms.mtls-services.svc.cluster.local',
  port: 8443,
  path: '/api/transaction',
  method: 'GET',
  key: fs.readFileSync('/certs/tls.key'),
  cert: fs.readFileSync('/certs/tls.crt'),
  ca: fs.readFileSync('/certs/ca.crt'),
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
  timeout: 5000
};

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    return res.end('root-ms healthy');
  }

  if (req.url !== '/call-transaction') {
    res.writeHead(404);
    return res.end('Not found');
  }

  const outgoing = https.request(options, transactionRes => {
    let body = '';

    transactionRes.on('data', chunk => body += chunk);
    transactionRes.on('end', () => {
      res.writeHead(transactionRes.statusCode || 502, {
        'Content-Type': 'application/json'
      });
      res.end(body);
    });
  });

  outgoing.on('timeout', () => outgoing.destroy(new Error('Request timed out')));

  outgoing.on('error', err => {
    console.error('transaction-ms request failed:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ error: 'transaction-ms request failed' }));
  });

  outgoing.end();
});

server.listen(3001, '0.0.0.0', () => {
  console.log('root-ms listening on 3001');
});