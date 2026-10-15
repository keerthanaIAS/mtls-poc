const https = require('https');
const fs = require('fs');

const read = (p) => fs.readFileSync(p);

const server = https.createServer({
  key: read('certbot-config-fresh/live/transaction-ms/privkey.pem'),
  cert: read('certbot-config-fresh/live/transaction-ms/fullchain.pem'),
  ca: read('certs/client-ca/ca.pem'),
  requestCert: true,
  rejectUnauthorized: true
}, (req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({
    message: 'mTLS connection successful',
    authenticatedClient: req.socket.getPeerCertificate().subject.CN,
    tlsVersion: req.socket.getProtocol()
  }));
});

server.on('tlsClientError', (err) => {
  console.log('Client TLS rejected:', err.message);
});

server.listen(3443, '127.0.0.1', () => {
  console.log('transaction-ms listening on port 3443');
});
