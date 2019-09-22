const gm = require('gm').subClass({
   imageMagick: true
});
const PNG = require('png-js');
const toArray = require('stream-to-array');
const DEFAULT_HASH_SIZE = 8;
const PIXEL_LENGTH = 4;

function px(pixels: any, width: any, x: any, y: any) {
   return pixels[width * PIXEL_LENGTH * y + x * PIXEL_LENGTH];
}

function binaryToHex(s: any) {
   let output = '';
   for (let i = 0; i < s.length; i += 4) {
      const bytes = s.substr(i, 4);
      const decimal = parseInt(bytes, 2);
      const hex = decimal.toString(16);
      output += hex.toUpperCase();
   }
   return output;
}
module.exports = (path: any, callback: any, hashSize: any) => {
   const height = hashSize || DEFAULT_HASH_SIZE;
   const width = height + 1; // Covert to small gray image 
   gm(path).colorspace('GRAY').resize(width, height, '!').stream('png', (err: any, stream: any) => {
      if (err) {
         if (callback) {
            callback(err);
         }
      } else { // Get pixel data 
         toArray(stream, (toArrayErr: any, arr: any) => {
            if (toArrayErr) {
               if (callback) {
                  callback(toArrayErr);
               }
            } else {
               try {
                  const png = new PNG(Buffer.concat(arr));
                  png.decode((pixels: any) => { // Compare adjacent pixels. 
                    let difference = '';
                    for (let row = 0; row < height; row++) {
                       for (let col = 0; col < height; col++) { // height is not a mistake here... 
                          const left = px(pixels, width, col, row);
                          const right = px(pixels, width, col + 1, row);
                          difference += left < right ? 1 : 0;
                       }
                    } // Convert difference to hex string 
                    if (callback) {
                       callback(false, binaryToHex(difference));
                    }
                 });
               } catch (pngErr) {
                  return callback && callback(pngErr);
               }
            }
         });
      }
   });
};