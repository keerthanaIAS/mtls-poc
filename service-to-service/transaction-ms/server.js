const https = require('https');
const fs = require('fs');

const server = https.createServer({
  key: fs.readFileSync('/certs/tls.key'),
  cert: fs.readFileSync('/certs/tls.crt'),
  ca: fs.readFileSync('/certs/ca.crt'),
  requestCert: true,
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2'
}, (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    return res.end('transaction-ms healthy');
  }

  if (req.url === '/api/transaction') {
    const client = req.socket.getPeerCertificate();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      message: 'Transaction API called successfully',
      service: 'transaction-ms',
      authenticatedClient: client.subject.CN,
      tlsVersion: req.socket.getProtocol()
    }));
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(8443, '0.0.0.0', () => {
  console.log('transaction-ms listening on 8443 with mTLS');
});