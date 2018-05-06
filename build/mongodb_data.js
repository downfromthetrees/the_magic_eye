"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

// entire database of dhashes in array

var initDb = function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(cb) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        _context2.prev = 0;
                        _context2.next = 3;
                        return MongoClient.connect(process.env.MONGODB_URI, function () {
                            var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(err, client) {
                                var lastChecked, startTime, magicCollection, endTime;
                                return regeneratorRuntime.wrap(function _callee$(_context) {
                                    while (1) {
                                        switch (_context.prev = _context.next) {
                                            case 0:
                                                if (!err) {
                                                    _context.next = 3;
                                                    break;
                                                }

                                                log.error(chalk.red('Fatal MongoDb connection error: '), err);
                                                throw err;

                                            case 3:
                                                _context.next = 5;
                                                return client.db();

                                            case 5:
                                                database = _context.sent;
                                                _context.next = 8;
                                                return database.collection(magicPropertyName).findOne({ '_id': 'last_checked' });

                                            case 8:
                                                lastChecked = _context.sent;

                                                if (lastChecked == undefined) {
                                                    log.error(chalk.yellow('last_checked has never been set: assuming first time setup.'));
                                                    database.collection(magicPropertyName).save(new MagicProperty('last_checked', new Date().getTime()));
                                                }

                                                log.info(chalk.blue('Loading database cache...'));
                                                startTime = new Date().getTime();
                                                _context.next = 14;
                                                return database.collection(magicSubmissionName);

                                            case 14:
                                                magicCollection = _context.sent;

                                                magicCollection.ensureIndex({ "creationDate": 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 5 }); // expire after 5 years. 
                                                _context.next = 18;
                                                return magicCollection.find().project({ _id: 1 }).map(function (x) {
                                                    return x._id;
                                                }).toArray();

                                            case 18:
                                                database_cache = _context.sent;
                                                endTime = new Date().getTime();

                                                log.info(chalk.green('Database cache loaded, took: '), (endTime - startTime) / 1000, 's to load ', database_cache.length, 'entries');
                                                //log.debug('Database database_cache: ', database_cache);

                                                cb();

                                            case 22:
                                            case "end":
                                                return _context.stop();
                                        }
                                    }
                                }, _callee, this);
                            }));

                            return function (_x2, _x3) {
                                return _ref2.apply(this, arguments);
                            };
                        }());

                    case 3:
                        _context2.next = 9;
                        break;

                    case 5:
                        _context2.prev = 5;
                        _context2.t0 = _context2["catch"](0);

                        log.error(chalk.red('Fatal MongoDb connection error: '), _context2.t0);
                        throw _context2.t0;

                    case 9:
                    case "end":
                        return _context2.stop();
                }
            }
        }, _callee2, this, [[0, 5]]);
    }));

    return function initDb(_x) {
        return _ref.apply(this, arguments);
    };
}();

var getSubmissionCollection = function () {
    var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        return _context3.abrupt("return", database.collection(magicSubmissionName));

                    case 1:
                    case "end":
                        return _context3.stop();
                }
            }
        }, _callee3, this);
    }));

    return function getSubmissionCollection() {
        return _ref3.apply(this, arguments);
    };
}();

var getPropertyCollection = function () {
    var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
                switch (_context4.prev = _context4.next) {
                    case 0:
                        return _context4.abrupt("return", database.collection(magicPropertyName));

                    case 1:
                    case "end":
                        return _context4.stop();
                }
            }
        }, _callee4, this);
    }));

    return function getPropertyCollection() {
        return _ref4.apply(this, arguments);
    };
}();

var saveMagicSubmission = function () {
    var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(submission, addToCache) {
        var collection;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
            while (1) {
                switch (_context5.prev = _context5.next) {
                    case 0:
                        if (!(submission._id == null)) {
                            _context5.next = 2;
                            break;
                        }

                        throw new Error('Cannot create magic submission with null _id');

                    case 2:
                        _context5.prev = 2;

                        log.debug(chalk.yellow("INSERTING submission:" + JSON.stringify(submission)));
                        _context5.next = 6;
                        return getSubmissionCollection();

                    case 6:
                        collection = _context5.sent;
                        _context5.next = 9;
                        return collection.save(submission);

                    case 9:
                        if (addToCache) {
                            database_cache.push(submission._id);
                        }
                        _context5.next = 15;
                        break;

                    case 12:
                        _context5.prev = 12;
                        _context5.t0 = _context5["catch"](2);

                        log.error(chalk.red('MongoDb error:'), _context5.t0);

                    case 15:
                    case "end":
                        return _context5.stop();
                }
            }
        }, _callee5, this, [[2, 12]]);
    }));

    return function saveMagicSubmission(_x4, _x5) {
        return _ref5.apply(this, arguments);
    };
}();

var getMagicSubmission = function () {
    var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6(inputDHash) {
        var isMatch, canonicalHashKey, collection, magicSubmission;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
            while (1) {
                switch (_context6.prev = _context6.next) {
                    case 0:
                        isMatch = function isMatch(cachedHashKey) {
                            return hammingDistance(cachedHashKey, inputDHash) < process.env.HAMMING_THRESHOLD;
                        };

                        canonicalHashKey = database_cache.find(isMatch);

                        if (!(canonicalHashKey == undefined)) {
                            _context6.next = 5;
                            break;
                        }

                        log.debug('No cache hit for hashKey:', inputDHash);
                        return _context6.abrupt("return", null);

                    case 5:

                        log.debug(chalk.blue('Cached hamming match, hamming distance is: ', hammingDistance(canonicalHashKey, inputDHash)));

                        _context6.prev = 6;
                        _context6.next = 9;
                        return getSubmissionCollection();

                    case 9:
                        collection = _context6.sent;
                        _context6.next = 12;
                        return collection.findOne({ '_id': canonicalHashKey });

                    case 12:
                        magicSubmission = _context6.sent;

                        chalk.yellow('hashKey:', canonicalHashKey, 'value:', JSON.stringify(magicSubmission));
                        chalk.yellow(magicSubmission);

                        if (!(magicSubmission.exactMatchOnly == true && magicSubmission.dhash != inputDHash)) {
                            _context6.next = 18;
                            break;
                        }

                        log.debug('cache hit, but ignoring because exactMatchOnly is set for image');
                        return _context6.abrupt("return", null);

                    case 18:
                        return _context6.abrupt("return", magicSubmission);

                    case 21:
                        _context6.prev = 21;
                        _context6.t0 = _context6["catch"](6);

                        log.error(chalk.red('MongoDb error:'), _context6.t0);
                        return _context6.abrupt("return", null);

                    case 25:
                    case "end":
                        return _context6.stop();
                }
            }
        }, _callee6, this, [[6, 21]]);
    }));

    return function getMagicSubmission(_x6) {
        return _ref6.apply(this, arguments);
    };
}();

var getMagicSubmissionById = function () {
    var _ref7 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7(submission_id) {
        var collection;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
            while (1) {
                switch (_context7.prev = _context7.next) {
                    case 0:
                        _context7.prev = 0;
                        _context7.next = 3;
                        return getSubmissionCollection();

                    case 3:
                        collection = _context7.sent;
                        _context7.next = 6;
                        return collection.findOne({ 'reddit_id': submission_id });

                    case 6:
                        return _context7.abrupt("return", _context7.sent);

                    case 9:
                        _context7.prev = 9;
                        _context7.t0 = _context7["catch"](0);

                        log.error(chalk.red('MongoDb error:'), _context7.t0);
                        return _context7.abrupt("return", null);

                    case 13:
                    case "end":
                        return _context7.stop();
                }
            }
        }, _callee7, this, [[0, 9]]);
    }));

    return function getMagicSubmissionById(_x7) {
        return _ref7.apply(this, arguments);
    };
}();

var deleteMagicSubmission = function () {
    var _ref8 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8(submission) {
        var collection, index;
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
            while (1) {
                switch (_context8.prev = _context8.next) {
                    case 0:
                        _context8.prev = 0;

                        log.debug(chalk.yellow("DELETING:" + submission));
                        _context8.next = 4;
                        return getSubmissionCollection();

                    case 4:
                        collection = _context8.sent;
                        _context8.next = 7;
                        return collection.remove({ '_id': submission._id });

                    case 7:
                        index = database_cache.indexOf(submission._id);

                        if (index > -1) {
                            database_cache.splice(index, 1);
                        }
                        _context8.next = 14;
                        break;

                    case 11:
                        _context8.prev = 11;
                        _context8.t0 = _context8["catch"](0);

                        log.error(chalk.red('MongoDb error:'), _context8.t0);

                    case 14:
                    case "end":
                        return _context8.stop();
                }
            }
        }, _callee8, this, [[0, 11]]);
    }));

    return function deleteMagicSubmission(_x8) {
        return _ref8.apply(this, arguments);
    };
}();

var setLastCheckedNow = exports.setLastCheckedNow = function () {
    var _ref9 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee9() {
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
            while (1) {
                switch (_context9.prev = _context9.next) {
                    case 0:
                        _context9.next = 2;
                        return setMagicProperty('last_checked', new Date().getTime());

                    case 2:
                    case "end":
                        return _context9.stop();
                }
            }
        }, _callee9, this);
    }));

    return function setLastCheckedNow() {
        return _ref9.apply(this, arguments);
    };
}();

var getLastChecked = exports.getLastChecked = function () {
    var _ref10 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee10() {
        var collection, lastChecked;
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
            while (1) {
                switch (_context10.prev = _context10.next) {
                    case 0:
                        _context10.prev = 0;
                        _context10.next = 3;
                        return getPropertyCollection();

                    case 3:
                        collection = _context10.sent;
                        _context10.next = 6;
                        return collection.findOne({ '_id': 'last_checked' });

                    case 6:
                        lastChecked = _context10.sent;

                        if (!(lastChecked != null)) {
                            _context10.next = 9;
                            break;
                        }

                        return _context10.abrupt("return", lastChecked.value);

                    case 9:
                        _context10.next = 14;
                        break;

                    case 11:
                        _context10.prev = 11;
                        _context10.t0 = _context10["catch"](0);

                        log.error(chalk.red('MongoDb error:'), _context10.t0);

                    case 14:
                        return _context10.abrupt("return", null);

                    case 15:
                    case "end":
                        return _context10.stop();
                }
            }
        }, _callee10, this, [[0, 11]]);
    }));

    return function getLastChecked() {
        return _ref10.apply(this, arguments);
    };
}();

var setMagicProperty = exports.setMagicProperty = function () {
    var _ref11 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee11(key, value) {
        var collection;
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
            while (1) {
                switch (_context11.prev = _context11.next) {
                    case 0:
                        _context11.prev = 0;

                        log.debug(chalk.yellow("inserting property. key:"), key, chalk.yellow('value:'), value);
                        _context11.next = 4;
                        return getPropertyCollection();

                    case 4:
                        collection = _context11.sent;
                        _context11.next = 7;
                        return collection.save(new MagicProperty(key, value));

                    case 7:
                        _context11.next = 13;
                        break;

                    case 9:
                        _context11.prev = 9;
                        _context11.t0 = _context11["catch"](0);

                        log.error(chalk.red('MongoDb error:'), _context11.t0);
                        return _context11.abrupt("return", null);

                    case 13:
                    case "end":
                        return _context11.stop();
                }
            }
        }, _callee11, this, [[0, 9]]);
    }));

    return function setMagicProperty(_x9, _x10) {
        return _ref11.apply(this, arguments);
    };
}();

var getMagicProperty = exports.getMagicProperty = function () {
    var _ref12 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee12(key) {
        var collection, property;
        return regeneratorRuntime.wrap(function _callee12$(_context12) {
            while (1) {
                switch (_context12.prev = _context12.next) {
                    case 0:
                        _context12.prev = 0;
                        _context12.next = 3;
                        return getPropertyCollection();

                    case 3:
                        collection = _context12.sent;
                        _context12.next = 6;
                        return collection.findOne({ '_id': key });

                    case 6:
                        property = _context12.sent;

                        if (!(property != null)) {
                            _context12.next = 9;
                            break;
                        }

                        return _context12.abrupt("return", property.value);

                    case 9:
                        _context12.next = 14;
                        break;

                    case 11:
                        _context12.prev = 11;
                        _context12.t0 = _context12["catch"](0);

                        log.error(chalk.red('MongoDb error:'), _context12.t0);

                    case 14:
                        return _context12.abrupt("return", null);

                    case 15:
                    case "end":
                        return _context12.stop();
                }
            }
        }, _callee12, this, [[0, 11]]);
    }));

    return function getMagicProperty(_x11) {
        return _ref12.apply(this, arguments);
    };
}();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var parseDbUrl = require("parse-database-url");
var redis = require("redis");

var _require = require('util'),
    promisify = _require.promisify;

require('dotenv').config();
var parseDbUrl = require("parse-database-url");
var chalk = require('chalk');
var MongoClient = require('mongodb').MongoClient;
var hammingDistance = require("hamming");
var log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);

var collectionPrefix = (process.env.NODE_ENV == 'production' ? '' : process.env.NODE_ENV + ':') + process.env.SUBREDDIT_NAME + ':';
var magicPropertyName = collectionPrefix + 'properties';

var MagicProperty = function MagicProperty(name, value) {
    _classCallCheck(this, MagicProperty);

    this._id = name;
    this.value = value;
};

var magicSubmissionName = collectionPrefix + 'submissions';

var MagicSubmission = // number

// array of reddit ids, includes removed and approved posts
// dhash of the original
function MagicSubmission(dhash, redditSubmission, highestScore) {
    _classCallCheck(this, MagicSubmission);

    this._id = dhash;
    this.reddit_id = redditSubmission.id;
    this.duplicates = [];
    this.exactMatchOnly = null;
    this.highest_score = highestScore;
} // boolean value
// the last reddit id that matched the dhash (dhash within hamming distance)
;

var database = null; // access object
var database_cache = null;

module.exports = {
    MagicSubmission: MagicSubmission,
    getMagicSubmission: getMagicSubmission,
    saveMagicSubmission: saveMagicSubmission,
    deleteMagicSubmission: deleteMagicSubmission,
    getLastChecked: getLastChecked,
    setLastCheckedNow: setLastCheckedNow,
    getMagicSubmissionById: getMagicSubmissionById,
    initDb: initDb,
    setMagicProperty: setMagicProperty,
    getMagicProperty: getMagicProperty
};
//# sourceMappingURL=mongodb_data.js.map