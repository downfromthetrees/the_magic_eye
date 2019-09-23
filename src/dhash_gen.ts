'use strict';

var gm = require('gm').subClass({
	imageMagick: true
});
var PNG = require('png-js');
var toArray = require('stream-to-array');

var DEFAULT_HASH_SIZE = 8;
var PIXEL_LENGTH = 4;

function px(pixels, width, x, y) {
	return pixels[width * PIXEL_LENGTH * y + x * PIXEL_LENGTH];
}

function binaryToHex(s) {
	var output = '';
	for (var i = 0; i < s.length; i += 4) {
		var bytes = s.substr(i, 4);
		var decimal = parseInt(bytes, 2);
		var hex = decimal.toString(16);
		output += hex.toUpperCase();
	}
	return output;
}

module.exports = function(path, callback, hashSize) {
	var height = hashSize || DEFAULT_HASH_SIZE;
	var width = height + 1;
	// Covert to small gray image
	gm(path)
		.colorspace('GRAY')
		.resize(width, height, '!')
		.stream('png', function(err, stream) {
			if (err) {
				if (callback) {
					callback(err);
				}
			} else {
				// Get pixel data
				toArray(stream, function(toArrayErr, arr) {
					if (toArrayErr) {
						if (callback) {
							callback(toArrayErr);
						}
					} else {
						try {
							var png = new PNG(Buffer.concat(arr));
						} catch (pngErr) {
							return callback && callback(pngErr);
						}
						png.decode(function(pixels) {
							// Compare adjacent pixels.
							var difference = '';
							for (var row = 0; row < height; row++) {
								for (var col = 0; col < height; col++) { // height is not a mistake here...
									var left = px(pixels, width, col, row);
									var right = px(pixels, width, col + 1, row);
									difference += left < right ? 1 : 0;
								}
							}
							// Convert difference to hex string
							if (callback) {
								callback(false, binaryToHex(difference));
							}
						});
					}
				});

			}
		});
};
