const https = require('https');
const fs = require('fs');

const mode = process.env.CLIENT_MODE || 'valid';

const options = {
  hostname: 'transaction-ms.test',
  port: 3443,
  path: '/',
  method: 'GET',
  ca: fs.readFileSync('certs/pebble-root-ca.pem'),

  // Resolve the test hostname locally while preserving TLS hostname validation.
  lookup: (hostname, options, callback) => {
    if (options && options.all) {
      callback(null, [{ address: '127.0.0.1', family: 4 }]);
    } else {
      callback(null, '127.0.0.1', 4);
    }
  }
};

if (mode !== 'none') {
  const untrusted = mode === 'untrusted';

  options.key = fs.readFileSync(
    untrusted ? 'certs/untrusted/client-key.pem'
              : 'certs/root-ms-client-key.pem'
  );

  options.cert = fs.readFileSync(
    untrusted ? 'certs/untrusted/client.pem'
              : 'certs/root-ms-client.pem'
  );
}

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('HTTP status:', res.statusCode);
    console.log(body);
  });
});

req.on('error', (err) => {
  console.error('Connection rejected:', err.message);
  process.exitCode = 1;
});

req.end();
