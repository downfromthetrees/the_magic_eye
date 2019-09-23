const https = require('https');
 
https.get('https://the-magic-eye.herokuapp.com/keepalive', (resp) => {
  let data = '';
 
  // A chunk of data has been recieved.
  resp.on('data', (chunk) => {
    data += chunk;
  });
 
  // The whole response has been received. Print out the result.
  resp.on('end', () => {
    console.log('keep alive status:', JSON.parse(data).status);
  });
 
}).on("error", (err) => {
  console.log("Error: " + err.message);
});