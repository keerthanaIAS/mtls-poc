const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('/certs/server.key'),
  cert: fs.readFileSync('/certs/server.crt'),

  // Trust our CA for client certificates
  ca: fs.readFileSync('/certs/ca.crt'),

  // This is the critical mTLS setting:
  // reject clients that do not provide a valid certificate
  requestCert: true,
  rejectUnauthorized: true
};

https.createServer(options, (req, res) => {
  const clientCert = req.socket.getPeerCertificate(); // retrieve the parsed client certificate object inside the request handler

  console.log('Client certificate subject:', clientCert.subject);

  res.writeHead(200);
  res.end('mTLS connection successful\n');
}).listen(3001, '0.0.0.0', () => {
  console.log('mTLS server listening on port 3001');
});
