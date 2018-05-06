'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var processInbox = function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(moderators, lastChecked, reddit) {
        var replies, processedReplies, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, reply, createdDate, messages, processedMessages, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, message;

        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        _context.next = 2;
                        return reddit.getInbox({ 'filter': 'comments' });

                    case 2:
                        replies = _context.sent;
                        processedReplies = 0;
                        _iteratorNormalCompletion = true;
                        _didIteratorError = false;
                        _iteratorError = undefined;
                        _context.prev = 7;
                        _iterator = replies[Symbol.iterator]();

                    case 9:
                        if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                            _context.next = 19;
                            break;
                        }

                        reply = _step.value;
                        _context.next = 13;
                        return reply.created_utc;

                    case 13:
                        _context.t0 = _context.sent;
                        createdDate = _context.t0 * 1000;
                        // reddit dates are in seconds
                        if (createdDate > lastChecked) {
                            log.debug('Procesing reply');
                            processInboxReply(reply, moderators, reddit);
                            processedReplies++;
                        }

                    case 16:
                        _iteratorNormalCompletion = true;
                        _context.next = 9;
                        break;

                    case 19:
                        _context.next = 25;
                        break;

                    case 21:
                        _context.prev = 21;
                        _context.t1 = _context['catch'](7);
                        _didIteratorError = true;
                        _iteratorError = _context.t1;

                    case 25:
                        _context.prev = 25;
                        _context.prev = 26;

                        if (!_iteratorNormalCompletion && _iterator.return) {
                            _iterator.return();
                        }

                    case 28:
                        _context.prev = 28;

                        if (!_didIteratorError) {
                            _context.next = 31;
                            break;
                        }

                        throw _iteratorError;

                    case 31:
                        return _context.finish(28);

                    case 32:
                        return _context.finish(25);

                    case 33:
                        log.debug(chalk.blue('Processed ', processedReplies, 'replies'));

                        _context.next = 36;
                        return reddit.getInbox({ 'filter': 'messages' });

                    case 36:
                        messages = _context.sent;
                        processedMessages = 0;
                        _iteratorNormalCompletion2 = true;
                        _didIteratorError2 = false;
                        _iteratorError2 = undefined;
                        _context.prev = 41;
                        _iterator2 = messages[Symbol.iterator]();

                    case 43:
                        if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
                            _context.next = 53;
                            break;
                        }

                        message = _step2.value;
                        _context.next = 47;
                        return message.created_utc;

                    case 47:
                        _context.t2 = _context.sent;
                        createdDate = _context.t2 * 1000;
                        // reddit dates are in seconds
                        if (createdDate > lastChecked) {
                            log.debug('Procesing message');
                            processInboxMessage(message, moderators, reddit);
                            processedMessages++;
                        }

                    case 50:
                        _iteratorNormalCompletion2 = true;
                        _context.next = 43;
                        break;

                    case 53:
                        _context.next = 59;
                        break;

                    case 55:
                        _context.prev = 55;
                        _context.t3 = _context['catch'](41);
                        _didIteratorError2 = true;
                        _iteratorError2 = _context.t3;

                    case 59:
                        _context.prev = 59;
                        _context.prev = 60;

                        if (!_iteratorNormalCompletion2 && _iterator2.return) {
                            _iterator2.return();
                        }

                    case 62:
                        _context.prev = 62;

                        if (!_didIteratorError2) {
                            _context.next = 65;
                            break;
                        }

                        throw _iteratorError2;

                    case 65:
                        return _context.finish(62);

                    case 66:
                        return _context.finish(59);

                    case 67:

                        log.debug(chalk.blue('Processed ', processedMessages, 'messages'));

                    case 68:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this, [[7, 21, 25, 33], [26,, 28, 32], [41, 55, 59, 67], [60,, 62, 66]]);
    }));

    return function processInbox(_x, _x2, _x3) {
        return _ref.apply(this, arguments);
    };
}();

var processInboxReply = function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(inboxReply, moderators, reddit) {
        var isMod;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        isMod = moderators.find(function (moderator) {
                            return moderator.name === inboxReply.author.name;
                        });

                        if (isMod) {
                            if (inboxReply.body.includes('clear')) {
                                doClear(inboxReply, reddit);
                            } else if (inboxReply.body.includes('wrong')) {
                                doExactMatchOnly(inboxReply, reddit);
                            } else {
                                inboxReply.reply("Not sure what that command is. You can use `clear` and I'll forget the submission, but that's all I support right now.");
                            }
                        } else {
                            inboxReply.report({ 'reason': 'Moderator requested' });
                        }

                    case 2:
                    case 'end':
                        return _context2.stop();
                }
            }
        }, _callee2, this);
    }));

    return function processInboxReply(_x4, _x5, _x6) {
        return _ref2.apply(this, arguments);
    };
}();

var doExactMatchOnly = function () {
    var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(inboxReply, reddit) {
        var comment, submission, success, magicReply;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        _context3.next = 2;
                        return reddit.getComment(inboxReply.id);

                    case 2:
                        comment = _context3.sent;
                        _context3.next = 5;
                        return comment.fetch();

                    case 5:
                        _context3.t0 = reddit;
                        _context3.t1 = sliceSubmissionId;
                        _context3.next = 9;
                        return comment.link_id;

                    case 9:
                        _context3.t2 = _context3.sent;
                        _context3.t3 = (0, _context3.t1)(_context3.t2);
                        _context3.next = 13;
                        return _context3.t0.getSubmission.call(_context3.t0, _context3.t3);

                    case 13:
                        submission = _context3.sent;
                        _context3.next = 16;
                        return submission.fetch();

                    case 16:
                        log.debug(chalk.blue('submission: '), submission);

                        log.debug(chalk.blue('Submission for clear: '), submission);
                        _context3.next = 20;
                        return setExactMatchOnly(submission, reddit);

                    case 20:
                        success = _context3.sent;
                        _context3.next = 23;
                        return inboxReply.reply(success ? "Thanks, won't make that mistake again." : "I couldn't do that that... image deleted or something?");

                    case 23:
                        magicReply = _context3.sent;

                        magicReply.distinguish();

                    case 25:
                    case 'end':
                        return _context3.stop();
                }
            }
        }, _callee3, this);
    }));

    return function doExactMatchOnly(_x7, _x8) {
        return _ref3.apply(this, arguments);
    };
}();

var doClear = function () {
    var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(inboxReply, reddit) {
        var comment, submission, success, magicReply;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
                switch (_context4.prev = _context4.next) {
                    case 0:
                        _context4.next = 2;
                        return reddit.getComment(inboxReply.id);

                    case 2:
                        comment = _context4.sent;
                        _context4.next = 5;
                        return comment.fetch();

                    case 5:
                        _context4.t0 = reddit;
                        _context4.t1 = sliceSubmissionId;
                        _context4.next = 9;
                        return comment.link_id;

                    case 9:
                        _context4.t2 = _context4.sent;
                        _context4.t3 = (0, _context4.t1)(_context4.t2);
                        _context4.next = 13;
                        return _context4.t0.getSubmission.call(_context4.t0, _context4.t3);

                    case 13:
                        submission = _context4.sent;
                        _context4.next = 16;
                        return submission.fetch();

                    case 16:

                        log.debug(chalk.blue('Submission for clear: '), submission);
                        _context4.next = 19;
                        return clearSubmission(submission, reddit);

                    case 19:
                        success = _context4.sent;
                        _context4.next = 22;
                        return inboxReply.reply(success ? 'Thanks, all done.' : "I couldn't do that that... image deleted or something?");

                    case 22:
                        magicReply = _context4.sent;

                        magicReply.distinguish();

                    case 24:
                    case 'end':
                        return _context4.stop();
                }
            }
        }, _callee4, this);
    }));

    return function doClear(_x9, _x10) {
        return _ref4.apply(this, arguments);
    };
}();

var clearSubmission = function () {
    var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(submission, reddit) {
        var imageDetails, existingMagicSubmission;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
            while (1) {
                switch (_context5.prev = _context5.next) {
                    case 0:
                        _context5.t0 = log;
                        _context5.t1 = chalk.yellow('Starting process for clear submission by: ');
                        _context5.next = 4;
                        return submission.author.name;

                    case 4:
                        _context5.t2 = _context5.sent;
                        _context5.t3 = Date;
                        _context5.next = 8;
                        return submission.created_utc;

                    case 8:
                        _context5.t4 = _context5.sent;
                        _context5.t5 = _context5.t4 * 1000;
                        _context5.t6 = new _context5.t3(_context5.t5);

                        _context5.t0.debug.call(_context5.t0, _context5.t1, _context5.t2, ', submitted: ', _context5.t6);

                        _context5.next = 14;
                        return getImageDetails(submission);

                    case 14:
                        imageDetails = _context5.sent;

                        if (!(imageDetails == null)) {
                            _context5.next = 23;
                            break;
                        }

                        _context5.t7 = log;
                        _context5.next = 19;
                        return submission.permalink;

                    case 19:
                        _context5.t8 = _context5.sent;
                        _context5.t9 = "Could not download image for clear (probably deleted) - removing submission: https://www.reddit.com" + _context5.t8;

                        _context5.t7.debug.call(_context5.t7, _context5.t9);

                        return _context5.abrupt('return', false);

                    case 23:
                        _context5.next = 25;
                        return getMagicSubmission(imageDetails.dhash);

                    case 25:
                        existingMagicSubmission = _context5.sent;

                        log.debug('Existing submission for dhash:', chalk.blue(imageDetails.dhash), chalk.yellow(JSON.stringify(existingMagicSubmission)));

                        if (!(existingMagicSubmission == null)) {
                            _context5.next = 29;
                            break;
                        }

                        return _context5.abrupt('return', true);

                    case 29:

                        log.debug('Clearing magic submission for dhash: ', existingMagicSubmission._id);
                        _context5.next = 32;
                        return deleteMagicSubmission(existingMagicSubmission);

                    case 32:
                        return _context5.abrupt('return', true);

                    case 33:
                    case 'end':
                        return _context5.stop();
                }
            }
        }, _callee5, this);
    }));

    return function clearSubmission(_x11, _x12) {
        return _ref5.apply(this, arguments);
    };
}();

var setExactMatchOnly = function () {
    var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6(submission, reddit) {
        var imageDetails, existingMagicSubmission;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
            while (1) {
                switch (_context6.prev = _context6.next) {
                    case 0:
                        _context6.t0 = log;
                        _context6.t1 = chalk.yellow('Starting process for setExactMatchOnly for submission by: ');
                        _context6.next = 4;
                        return submission.author.name;

                    case 4:
                        _context6.t2 = _context6.sent;
                        _context6.t3 = Date;
                        _context6.next = 8;
                        return submission.created_utc;

                    case 8:
                        _context6.t4 = _context6.sent;
                        _context6.t5 = _context6.t4 * 1000;
                        _context6.t6 = new _context6.t3(_context6.t5);

                        _context6.t0.debug.call(_context6.t0, _context6.t1, _context6.t2, ', submitted: ', _context6.t6);

                        _context6.next = 14;
                        return getImageDetails(submission);

                    case 14:
                        imageDetails = _context6.sent;

                        if (!(imageDetails == null)) {
                            _context6.next = 23;
                            break;
                        }

                        _context6.t7 = log;
                        _context6.next = 19;
                        return submission.permalink;

                    case 19:
                        _context6.t8 = _context6.sent;
                        _context6.t9 = "Could not download image for setting exact match (probably deleted) - removing submission: https://www.reddit.com" + _context6.t8;

                        _context6.t7.debug.call(_context6.t7, _context6.t9);

                        return _context6.abrupt('return', false);

                    case 23:
                        _context6.next = 25;
                        return getMagicSubmission(imageDetails.dhash);

                    case 25:
                        existingMagicSubmission = _context6.sent;

                        log.debug('Existing submission for dhash:', chalk.blue(imageDetails.dhash), chalk.yellow(JSON.stringify(existingMagicSubmission)));

                        if (!(existingMagicSubmission == null)) {
                            _context6.next = 30;
                            break;
                        }

                        log.info("dhash not generated for submission", submission.id);
                        return _context6.abrupt('return', false);

                    case 30:

                        log.debug('Setting exact match only for submission with dhash: ', existingMagicSubmission._id);
                        existingMagicSubmission.exactMatchOnly = true;
                        _context6.next = 34;
                        return saveMagicSubmission(existingMagicSubmission);

                    case 34:
                        return _context6.abrupt('return', true);

                    case 35:
                    case 'end':
                        return _context6.stop();
                }
            }
        }, _callee6, this);
    }));

    return function setExactMatchOnly(_x13, _x14) {
        return _ref6.apply(this, arguments);
    };
}();

var processInboxMessage = function () {
    var _ref7 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7(inboxReply, moderators, reddit) {
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
            while (1) {
                switch (_context7.prev = _context7.next) {
                    case 0:
                        inboxReply.reply('I\'m a bot so don\'t support private messages, but contact /u/CosmicKeys for details about how I work.');

                    case 1:
                    case 'end':
                        return _context7.stop();
                }
            }
        }, _callee7, this);
    }));

    return function processInboxMessage(_x15, _x16, _x17) {
        return _ref7.apply(this, arguments);
    };
}();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

// standard modules
require('dotenv').config();
var moment = require('moment');
var outdent = require('outdent');
var chalk = require('chalk');
var log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);

var _require = require('./image_utils.js'),
    ImageDetails = _require.ImageDetails,
    getImageDetails = _require.getImageDetails;

var _require2 = require('./mongodb_data.js'),
    MagicSubmission = _require2.MagicSubmission,
    getMagicSubmission = _require2.getMagicSubmission,
    saveMagicSubmission = _require2.saveMagicSubmission,
    deleteMagicSubmission = _require2.deleteMagicSubmission;

// magic eye modules


var _require3 = require('./reddit_utils.js'),
    sliceSubmissionId = _require3.sliceSubmissionId;

module.exports = {
    processInbox: processInbox
};
//# sourceMappingURL=inbox_processor.js.map