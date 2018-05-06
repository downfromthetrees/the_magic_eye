'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var getModComment = function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(reddit, submissionId) {
        var submission, comments;
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        submission = reddit.getSubmission(submissionId);
                        _context.next = 3;
                        return submission.comments;

                    case 3:
                        comments = _context.sent;
                        return _context.abrupt('return', comments.find(function (comment) {
                            return comment.distinguished == 'moderator' && comment.removed != true;
                        }));

                    case 5:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this);
    }));

    return function getModComment(_x, _x2) {
        return _ref.apply(this, arguments);
    };
}();

var isMagicIgnore = function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(modComment) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        _context2.t0 = modComment != null;

                        if (!_context2.t0) {
                            _context2.next = 5;
                            break;
                        }

                        _context2.next = 4;
                        return modComment.body;

                    case 4:
                        _context2.t0 = _context2.sent.includes('[](#magic_ignore)');

                    case 5:
                        return _context2.abrupt('return', _context2.t0);

                    case 6:
                    case 'end':
                        return _context2.stop();
                }
            }
        }, _callee2, this);
    }));

    return function isMagicIgnore(_x3) {
        return _ref2.apply(this, arguments);
    };
}();

var isRepostOnlyByUserRemoval = function () {
    var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(modComment) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        _context3.t0 = modComment != null;

                        if (!_context3.t0) {
                            _context3.next = 5;
                            break;
                        }

                        _context3.next = 4;
                        return modComment.body;

                    case 4:
                        _context3.t0 = _context3.sent.includes('[](#repost_only_by_user)');

                    case 5:
                        return _context3.abrupt('return', _context3.t0);

                    case 6:
                    case 'end':
                        return _context3.stop();
                }
            }
        }, _callee3, this);
    }));

    return function isRepostOnlyByUserRemoval(_x4) {
        return _ref3.apply(this, arguments);
    };
}();

var isRepostRemoval = function () {
    var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(modComment) {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
                switch (_context4.prev = _context4.next) {
                    case 0:
                        _context4.t0 = modComment != null;

                        if (!_context4.t0) {
                            _context4.next = 5;
                            break;
                        }

                        _context4.next = 4;
                        return modComment.body;

                    case 4:
                        _context4.t0 = _context4.sent.includes('[](#repost)');

                    case 5:
                        return _context4.abrupt('return', _context4.t0);

                    case 6:
                    case 'end':
                        return _context4.stop();
                }
            }
        }, _callee4, this);
    }));

    return function isRepostRemoval(_x5) {
        return _ref4.apply(this, arguments);
    };
}();

var getRemovalReason = function () {
    var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(modComment) {
        var body, startRemoval, endRemoval;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
            while (1) {
                switch (_context5.prev = _context5.next) {
                    case 0:
                        _context5.next = 2;
                        return modComment.body;

                    case 2:
                        body = _context5.sent;
                        startRemoval = '[](#start_removal)';
                        endRemoval = '[](#end_removal';

                        if (!(!body.includes(startRemoval) || !body.includes(endRemoval))) {
                            _context5.next = 8;
                            break;
                        }

                        log.info(chalk.magenta("Moderator comment doesn't include correct bookend tags"));
                        return _context5.abrupt('return', null);

                    case 8:
                        return _context5.abrupt('return', body.substring(body.indexOf(startRemoval) + startRemoval.length, body.lastIndexOf(endRemoval)));

                    case 9:
                    case 'end':
                        return _context5.stop();
                }
            }
        }, _callee5, this);
    }));

    return function getRemovalReason(_x6) {
        return _ref5.apply(this, arguments);
    };
}();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

// standard modules
require('dotenv').config();
var log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);

// reddit modules
var chalk = require('chalk');

function sliceSubmissionId(submissionId) {
    return submissionId.slice(3, submissionId.length); // id is prefixed with "id_"
}

module.exports = {
    getModComment: getModComment,
    isRepostOnlyByUserRemoval: isRepostOnlyByUserRemoval,
    isMagicIgnore: isMagicIgnore,
    isRepostRemoval: isRepostRemoval,
    getRemovalReason: getRemovalReason,
    sliceSubmissionId: sliceSubmissionId
};
//# sourceMappingURL=reddit_utils.js.map