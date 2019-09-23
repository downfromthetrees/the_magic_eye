import {get} from 'https';

get('https://the-magic-eye.herokuapp.com/keepalive', (resp: any) => {
   let data = '';
   // A chunk of data has been recieved. 
   resp.on('data', (chunk: any) => {
      data += chunk;
   });
   // The whole response has been received. Print out the result. 
   resp.on('end', () => {
      console.log('keep alive status:', JSON.parse(data).status);
   });
}).on("error", (err: any) => {
   console.log("Error: " + err.message);
});