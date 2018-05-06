'use strict';

var main = function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var subreddit, lastChecked, submissions, moderators;
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        log.debug(chalk.blue("Starting Magic processing cycle"));

                        // get everything up from to attempt to match checked time
                        _context.next = 3;
                        return reddit.getSubreddit(process.env.SUBREDDIT_NAME);

                    case 3:
                        subreddit = _context.sent;
                        _context.next = 6;
                        return getLastChecked();

                    case 6:
                        lastChecked = _context.sent;

                        log.debug('lastChecked: ', chalk.yellow(new Date(lastChecked)));

                        _context.next = 10;
                        return subreddit.getNew();

                    case 10:
                        submissions = _context.sent;
                        _context.next = 13;
                        return subreddit.getModerators();

                    case 13:
                        moderators = _context.sent;

                        if (!(!submissions || !moderators)) {
                            _context.next = 18;
                            break;
                        }

                        log.error(chalk.red('Cannot contact reddit - api is probably down for maintenance.'));
                        setTimeout(main, 30 * 1000); // run again in 30 seconds
                        return _context.abrupt('return');

                    case 18:
                        _context.next = 20;
                        return setLastCheckedNow();

                    case 20:

                        submissions.sort(function (a, b) {
                            return a.created_utc - b.created_utc;
                        });
                        _context.next = 23;
                        return processNewSubmissions(submissions, lastChecked, reddit);

                    case 23:
                        _context.next = 25;
                        return processInbox(moderators, lastChecked, reddit);

                    case 25:

                        log.debug(chalk.green('Finished processing, running again soon.'));
                        setTimeout(main, 30 * 1000); // run again in 30 seconds

                    case 27:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this);
    }));

    return function main() {
        return _ref.apply(this, arguments);
    };
}();

var firstTimeInit = function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        var topPostsProcessed, subredditName, postAmount, alreadyProcessed, topSubmissionsAll, topSubmissionsYear, topSubmissionsMonth, topSubmissionsWeek, newSubmissions;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        _context2.next = 2;
                        return getMagicProperty('top_posts_processed');

                    case 2:
                        topPostsProcessed = _context2.sent;

                        if (!topPostsProcessed) {
                            _context2.next = 5;
                            break;
                        }

                        return _context2.abrupt('return');

                    case 5:
                        subredditName = process.env.SUBREDDIT_NAME;
                        postAmount = 1000; // not sure if required, but it's reddits current limit

                        alreadyProcessed = [];


                        log.info(chalk.blue('Beginning first time initialisation. Retrieving top posts...'));
                        _context2.next = 11;
                        return reddit.getSubreddit(subredditName).getTop({ time: 'all' }).fetchAll({ amount: postAmount });

                    case 11:
                        topSubmissionsAll = _context2.sent;
                        _context2.next = 14;
                        return processOldSubmissions(topSubmissionsAll, alreadyProcessed, 'all time top');

                    case 14:
                        _context2.next = 16;
                        return reddit.getSubreddit(subredditName).getTop({ time: 'year' }).fetchAll({ amount: postAmount });

                    case 16:
                        topSubmissionsYear = _context2.sent;
                        _context2.next = 19;
                        return processOldSubmissions(topSubmissionsYear, alreadyProcessed, 'year top');

                    case 19:
                        _context2.next = 21;
                        return reddit.getSubreddit(subredditName).getTop({ time: 'month' }).fetchAll({ amount: postAmount });

                    case 21:
                        topSubmissionsMonth = _context2.sent;
                        _context2.next = 24;
                        return processOldSubmissions(topSubmissionsMonth, alreadyProcessed, 'month top');

                    case 24:
                        _context2.next = 26;
                        return reddit.getSubreddit(subredditName).getTop({ time: 'week' }).fetchAll({ amount: postAmount });

                    case 26:
                        topSubmissionsWeek = _context2.sent;
                        _context2.next = 29;
                        return processOldSubmissions(topSubmissionsWeek, alreadyProcessed, 'week top');

                    case 29:
                        _context2.next = 31;
                        return reddit.getSubreddit(subredditName).getNew().fetchAll({ amount: postAmount });

                    case 31:
                        newSubmissions = _context2.sent;
                        _context2.next = 34;
                        return setLastCheckedNow();

                    case 34:
                        _context2.next = 36;
                        return processOldSubmissions(newSubmissions, alreadyProcessed, 'new');

                    case 36:
                        _context2.next = 38;
                        return setMagicProperty('top_posts_processed', true);

                    case 38:
                        log.info(chalk.green('Initialisation processing complete.'));

                    case 39:
                    case 'end':
                        return _context2.stop();
                }
            }
        }, _callee2, this);
    }));

    return function firstTimeInit() {
        return _ref2.apply(this, arguments);
    };
}();

// server


var startServer = function () {
    var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        _context3.prev = 0;

                        app.listen(3000, function () {
                            return log.info(chalk.bgGreenBright('Magic Eye listening on port 3000'));
                        });

                        if (!(process.env.DEPLOY_TEST == 'false')) {
                            _context3.next = 6;
                            break;
                        }

                        _context3.next = 5;
                        return firstTimeInit();

                    case 5:

                        main();

                    case 6:
                        _context3.next = 11;
                        break;

                    case 8:
                        _context3.prev = 8;
                        _context3.t0 = _context3['catch'](0);

                        log.error(chalk.red(_context3.t0));

                    case 11:
                    case 'end':
                        return _context3.stop();
                }
            }
        }, _callee3, this, [[0, 8]]);
    }));

    return function startServer() {
        return _ref3.apply(this, arguments);
    };
}();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

// standard server modules
var babel = require("babel-core/register");
var express = require('express');
var app = express();
var favicon = require('serve-favicon');
var chalk = require('chalk');
require('dotenv').config();

var log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);

// webpack middleware to serve react files
var webpack = require('webpack');
var webpackMiddleware = require('webpack-dev-middleware');
var webpackConfig = require('../webpack.config.js');
app.use(webpackMiddleware(webpack(webpackConfig), { noInfo: true, publicPath: '/' }));
app.use(favicon('./src/img/favicon.ico'));

// reddit modules
var snoowrap = require('snoowrap');

// magic eye modules

var _require = require('./mongodb_data.js'),
    getLastChecked = _require.getLastChecked,
    setLastCheckedNow = _require.setLastCheckedNow,
    setMagicProperty = _require.setMagicProperty,
    getMagicProperty = _require.getMagicProperty,
    initDb = _require.initDb;

var _require2 = require('./submission_processor.js'),
    processOldSubmissions = _require2.processOldSubmissions,
    processNewSubmissions = _require2.processNewSubmissions;

var _require3 = require('./inbox_processor.js'),
    processInbox = _require3.processInbox;

var _require4 = require('./image_utils.js'),
    generateDHash = _require4.generateDHash,
    isDuplicate = _require4.isDuplicate;

// Create a new snoowrap requester with OAuth credentials
// See here: https://github.com/not-an-aardvark/reddit-oauth-helper


var reddit = new snoowrap({
    userAgent: 'THE_MAGIC_EYE:v1.0.0',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN
});

if (process.env.LOG_LEVEL == 'debug') {
    reddit.config({ debug: true });
}

initDb(startServer); // requires callback


// ===================== temp helper functions =====================
app.get('/dhash/:filename', function () {
    var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(req, res) {
        var dhash;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
                switch (_context4.prev = _context4.next) {
                    case 0:
                        _context4.next = 2;
                        return generateDHash(process.env.DOWNLOAD_DIR + req.params.filename);

                    case 2:
                        dhash = _context4.sent;

                        res.send("dhash for image in download_dir is: " + dhash);

                    case 4:
                    case 'end':
                        return _context4.stop();
                }
            }
        }, _callee4, this);
    }));

    return function (_x, _x2) {
        return _ref4.apply(this, arguments);
    };
}());

app.get('/hamming/:dhash1/:dhash2', function () {
    var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(req, res) {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
            while (1) {
                switch (_context5.prev = _context5.next) {
                    case 0:
                        _context5.t0 = res;
                        _context5.next = 3;
                        return isDuplicate(process.env.DOWNLOAD_DIR + req.params.dhash1, process.env.DOWNLOAD_DIR + req.params.dhash2);

                    case 3:
                        _context5.t1 = _context5.sent;
                        _context5.t2 = "Id duplicate: " + _context5.t1;

                        _context5.t0.send.call(_context5.t0, _context5.t2);

                    case 6:
                    case 'end':
                        return _context5.stop();
                }
            }
        }, _callee5, this);
    }));

    return function (_x3, _x4) {
        return _ref5.apply(this, arguments);
    };
}());

app.get('/resetchecked', function () {
    var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6(req, res) {
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
            while (1) {
                switch (_context6.prev = _context6.next) {
                    case 0:
                        setMagicProperty('last_checked', 1525079006000);
                        res.send('Done');

                    case 2:
                    case 'end':
                        return _context6.stop();
                }
            }
        }, _callee6, this);
    }));

    return function (_x5, _x6) {
        return _ref6.apply(this, arguments);
    };
}());
//# sourceMappingURL=server.js.map