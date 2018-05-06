"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var generateDHash = exports.generateDHash = function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(imagePath, logUrl) {
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        _context.prev = 0;
                        _context.next = 3;
                        return dhashGet(imagePath);

                    case 3:
                        return _context.abrupt("return", _context.sent);

                    case 6:
                        _context.prev = 6;
                        _context.t0 = _context["catch"](0);

                        log.warn('Could not generate dhash for: ', logUrl, ', ', _context.t0);
                        return _context.abrupt("return", null);

                    case 10:
                    case "end":
                        return _context.stop();
                }
            }
        }, _callee, this, [[0, 6]]);
    }));

    return function generateDHash(_x, _x2) {
        return _ref.apply(this, arguments);
    };
}();

var generatePHash = exports.generatePHash = function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(imagePath, logUrl) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        _context2.prev = 0;
                        _context2.next = 3;
                        return phashGet(imagePath);

                    case 3:
                        return _context2.abrupt("return", _context2.sent);

                    case 6:
                        _context2.prev = 6;
                        _context2.t0 = _context2["catch"](0);

                        log.warn('Could not generate phash for: ', logUrl, ', ', _context2.t0);
                        return _context2.abrupt("return", null);

                    case 10:
                    case "end":
                        return _context2.stop();
                }
            }
        }, _callee2, this, [[0, 6]]);
    }));

    return function generatePHash(_x3, _x4) {
        return _ref2.apply(this, arguments);
    };
}();

var downloadImage = exports.downloadImage = function () {
    var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(submission) {
        var options, _ref4, filename, image;

        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        _context3.next = 2;
                        return submission.url;

                    case 2:
                        _context3.t0 = _context3.sent;
                        _context3.t1 = process.env.DOWNLOAD_DIR;
                        options = {
                            url: _context3.t0,
                            dest: _context3.t1
                        };
                        _context3.prev = 5;
                        _context3.next = 8;
                        return imageDownloader.image(options);

                    case 8:
                        _ref4 = _context3.sent;
                        filename = _ref4.filename;
                        image = _ref4.image;
                        return _context3.abrupt("return", filename);

                    case 14:
                        _context3.prev = 14;
                        _context3.t2 = _context3["catch"](5);
                        return _context3.abrupt("return", null);

                    case 17:
                    case "end":
                        return _context3.stop();
                }
            }
        }, _callee3, this, [[5, 14]]);
    }));

    return function downloadImage(_x5) {
        return _ref3.apply(this, arguments);
    };
}();

var getImageDetails = function () {
    var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(submission) {
        var imagePath, imageDetails, imagePHash, trimmedPath, trimmedPHash;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
                switch (_context4.prev = _context4.next) {
                    case 0:
                        _context4.next = 2;
                        return downloadImage(submission);

                    case 2:
                        imagePath = _context4.sent;

                        if (!(imagePath == null)) {
                            _context4.next = 5;
                            break;
                        }

                        return _context4.abrupt("return", null);

                    case 5:
                        imageDetails = { dhash: null, height: null, width: null, trimmedHeight: null, trimmedWidth: null };
                        _context4.t0 = generateDHash;
                        _context4.t1 = imagePath;
                        _context4.next = 10;
                        return submission.url;

                    case 10:
                        _context4.t2 = _context4.sent;
                        _context4.next = 13;
                        return (0, _context4.t0)(_context4.t1, _context4.t2);

                    case 13:
                        imageDetails.dhash = _context4.sent;

                        if (!(imageDetails.dhash == null)) {
                            _context4.next = 16;
                            break;
                        }

                        return _context4.abrupt("return", null);

                    case 16:
                        _context4.t3 = generatePHash;
                        _context4.t4 = imagePath;
                        _context4.next = 20;
                        return submission.url;

                    case 20:
                        _context4.t5 = _context4.sent;
                        _context4.next = 23;
                        return (0, _context4.t3)(_context4.t4, _context4.t5);

                    case 23:
                        imagePHash = _context4.sent;

                        if (imagePHash != null) {
                            imageDetails.height = imagePHash.height; // there are better ways to get image dimensions but I already had phash working
                            imageDetails.width = imagePHash.width;
                        }

                        _context4.prev = 25;
                        trimmedPath = imagePath + '_trimmed';
                        _context4.next = 29;
                        return promisify(imageMagick.convert)([imagePath, '-trim', trimmedPath]);

                    case 29:
                        _context4.t6 = generatePHash;
                        _context4.t7 = imagePath;
                        _context4.next = 33;
                        return submission.url;

                    case 33:
                        _context4.t8 = _context4.sent;
                        _context4.next = 36;
                        return (0, _context4.t6)(_context4.t7, _context4.t8);

                    case 36:
                        trimmedPHash = _context4.sent;

                        if (trimmedPHash != null) {
                            imageDetails.trimmedHeight = trimmedPHash.height;
                            imageDetails.trimmedWidth = trimmedPHash.width;
                        }
                        _context4.next = 40;
                        return deleteImage(trimmedPath);

                    case 40:
                        _context4.next = 45;
                        break;

                    case 42:
                        _context4.prev = 42;
                        _context4.t9 = _context4["catch"](25);

                        log.error(chalk.red('Could not trim submission:'), submission.url, ' - imagemagick error: ', _context4.t9);

                    case 45:
                        _context4.next = 47;
                        return deleteImage(imagePath);

                    case 47:
                        return _context4.abrupt("return", imageDetails);

                    case 48:
                    case "end":
                        return _context4.stop();
                }
            }
        }, _callee4, this, [[25, 42]]);
    }));

    return function getImageDetails(_x6) {
        return _ref5.apply(this, arguments);
    };
}();

var isDuplicate = exports.isDuplicate = function () {
    var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(imagePath1, imagePath2) {
        var dhash1, dhash2, distance;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
            while (1) {
                switch (_context5.prev = _context5.next) {
                    case 0:
                        _context5.next = 2;
                        return generateDHash(imagePath1, imagePath1);

                    case 2:
                        dhash1 = _context5.sent;
                        _context5.next = 5;
                        return generateDHash(imagePath2, imagePath2);

                    case 5:
                        dhash2 = _context5.sent;
                        _context5.next = 8;
                        return hammingDistance(dhash1, dhash2);

                    case 8:
                        distance = _context5.sent;
                        return _context5.abrupt("return", [dhash1, dhash2, distance]);

                    case 10:
                    case "end":
                        return _context5.stop();
                }
            }
        }, _callee5, this);
    }));

    return function isDuplicate(_x7, _x8) {
        return _ref6.apply(this, arguments);
    };
}();

exports.deleteImage = deleteImage;

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var parseDbUrl = require("parse-database-url");
var hammingDistance = require("hamming");
var dhashLibrary = require("dhash");
var phashLibrary = require("phash-imagemagick");
var chalk = require('chalk');

var _require = require('util'),
    promisify = _require.promisify;

var phashGet = promisify(phashLibrary.get);
var dhashGet = promisify(dhashLibrary);
var fs = require('fs');
var imageDownloader = require('image-downloader');
var imageMagick = require('imagemagick');

// reddit modules

require('dotenv').config();
var log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);

function deleteImage(imagePath) {
    fs.unlink(imagePath, function (e) {
        if (e) {
            log.error(chalk.red('Failed to delete file: '), imagePath, e);
        }
    });
}

module.exports = {
    getImageDetails: getImageDetails,
    isDuplicate: isDuplicate
};
//# sourceMappingURL=image_utils.js.map