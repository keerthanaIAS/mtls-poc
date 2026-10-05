const https = require('https');
const fs = require('fs');

const options = {
  hostname: 'mtls-server',
  port: 3001,
  path: '/',
  ca: fs.readFileSync('/certs/ca.crt'),
  rejectUnauthorized: true
};

if (process.env.USE_CLIENT_CERT === 'true') {
  options.key = fs.readFileSync('/certs/client.key');
  options.cert = fs.readFileSync('/certs/client.crt');
  console.log('Client certificate: ENABLED');
} else {
  console.log('Client certificate: DISABLED');
}

const req = https.get(options, (res) => {
  let data = '';

  res.on('data', chunk => data += chunk);

  res.on('end', () => {
    console.log('HTTP status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (err) => {
  console.error('mTLS request failed:', err.message);
  process.exit(1);
});
