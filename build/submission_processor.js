'use strict';

var processOldSubmissions = function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(submissions, alreadyProcessed, name) {
        var submissionsToProcess, progressBar, processedCount, startTime, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, submission, endTime;

        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        submissionsToProcess = submissions.filter(function (submission) {
                            return !alreadyProcessed.includes(submission.id);
                        });

                        log.info('Retrived', submissions.length, name, 'posts.', submissionsToProcess.length, ' are new posts. Beginning processing.');
                        progressBar = new cliProgress.Bar({}, cliProgress.Presets.shades_classic);

                        progressBar.start(submissionsToProcess.length, 0);
                        processedCount = 0;
                        startTime = new Date().getTime();
                        _iteratorNormalCompletion = true;
                        _didIteratorError = false;
                        _iteratorError = undefined;
                        _context.prev = 9;
                        _iterator = submissionsToProcess[Symbol.iterator]();

                    case 11:
                        if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                            _context.next = 21;
                            break;
                        }

                        submission = _step.value;
                        _context.next = 15;
                        return processOldSubmission(submission);

                    case 15:
                        processedCount++;
                        progressBar.update(processedCount);
                        alreadyProcessed.push(submission.id);

                    case 18:
                        _iteratorNormalCompletion = true;
                        _context.next = 11;
                        break;

                    case 21:
                        _context.next = 27;
                        break;

                    case 23:
                        _context.prev = 23;
                        _context.t0 = _context['catch'](9);
                        _didIteratorError = true;
                        _iteratorError = _context.t0;

                    case 27:
                        _context.prev = 27;
                        _context.prev = 28;

                        if (!_iteratorNormalCompletion && _iterator.return) {
                            _iterator.return();
                        }

                    case 30:
                        _context.prev = 30;

                        if (!_didIteratorError) {
                            _context.next = 33;
                            break;
                        }

                        throw _iteratorError;

                    case 33:
                        return _context.finish(30);

                    case 34:
                        return _context.finish(27);

                    case 35:
                        endTime = new Date().getTime();


                        progressBar.stop();
                        log.info(chalk.blue('Processed', processedCount, name, ' submissions.'), ' Took: ', (endTime - startTime) / 1000, 's.');

                    case 38:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this, [[9, 23, 27, 35], [28,, 30, 34]]);
    }));

    return function processOldSubmissions(_x, _x2, _x3) {
        return _ref.apply(this, arguments);
    };
}();

var processOldSubmission = function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(submission) {
        var imageDetails, existingMagicSubmission;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        _context2.t0 = log;
                        _context2.t1 = chalk.yellow('Starting process for old submission by: ');
                        _context2.next = 4;
                        return submission.author.name;

                    case 4:
                        _context2.t2 = _context2.sent;
                        _context2.t3 = Date;
                        _context2.next = 8;
                        return submission.created_utc;

                    case 8:
                        _context2.t4 = _context2.sent;
                        _context2.t5 = _context2.t4 * 1000;
                        _context2.t6 = new _context2.t3(_context2.t5);

                        _context2.t0.debug.call(_context2.t0, _context2.t1, _context2.t2, ', submitted: ', _context2.t6);

                        _context2.next = 14;
                        return submission.url.endsWith('.jpg');

                    case 14:
                        _context2.t7 = !_context2.sent;

                        if (!_context2.t7) {
                            _context2.next = 19;
                            break;
                        }

                        _context2.next = 18;
                        return submission.url.endsWith('.png');

                    case 18:
                        _context2.t7 = !_context2.sent;

                    case 19:
                        if (!_context2.t7) {
                            _context2.next = 27;
                            break;
                        }

                        _context2.t8 = log;
                        _context2.next = 23;
                        return submission.permalink;

                    case 23:
                        _context2.t9 = _context2.sent;
                        _context2.t10 = "Image was not a jpg/png - ignoring submission: https://www.reddit.com" + _context2.t9;

                        _context2.t8.debug.call(_context2.t8, _context2.t10);

                        return _context2.abrupt('return', null);

                    case 27:
                        _context2.next = 29;
                        return getImageDetails(submission);

                    case 29:
                        imageDetails = _context2.sent;

                        if (!(imageDetails == null)) {
                            _context2.next = 38;
                            break;
                        }

                        _context2.t11 = log;
                        _context2.next = 34;
                        return submission.permalink;

                    case 34:
                        _context2.t12 = _context2.sent;
                        _context2.t13 = "Could not download image (probably deleted) - submission: https://www.reddit.com" + _context2.t12;

                        _context2.t11.debug.call(_context2.t11, _context2.t13);

                        return _context2.abrupt('return');

                    case 38:
                        _context2.next = 40;
                        return getMagicSubmission(imageDetails.dhash);

                    case 40:
                        existingMagicSubmission = _context2.sent;

                        log.debug('Existing old submission for dhash:', chalk.blue(imageDetails.dhash), chalk.yellow(JSON.stringify(existingMagicSubmission)));

                        if (!(existingMagicSubmission == null)) {
                            _context2.next = 45;
                            break;
                        }

                        _context2.next = 45;
                        return processNewSubmission(submission, imageDetails);

                    case 45:
                    case 'end':
                        return _context2.stop();
                }
            }
        }, _callee2, this);
    }));

    return function processOldSubmission(_x4) {
        return _ref2.apply(this, arguments);
    };
}();

var processNewSubmissions = function () {
    var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(submissions, lastChecked, reddit) {
        var processedCount, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, submission, submissionDate;

        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        processedCount = 0;
                        _iteratorNormalCompletion2 = true;
                        _didIteratorError2 = false;
                        _iteratorError2 = undefined;
                        _context3.prev = 4;
                        _iterator2 = submissions[Symbol.iterator]();

                    case 6:
                        if (_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done) {
                            _context3.next = 20;
                            break;
                        }

                        submission = _step2.value;
                        _context3.next = 10;
                        return submission.created_utc;

                    case 10:
                        _context3.t0 = _context3.sent;
                        submissionDate = _context3.t0 * 1000;
                        // reddit dates are in seconds
                        log.debug('submitted:', new Date(submissionDate), ', processing: ', submissionDate > lastChecked ? chalk.green(submissionDate > lastChecked) : chalk.yellow(submissionDate > lastChecked));

                        if (!(submissionDate > lastChecked)) {
                            _context3.next = 17;
                            break;
                        }

                        _context3.next = 16;
                        return processSubmission(submission, reddit);

                    case 16:
                        processedCount++;

                    case 17:
                        _iteratorNormalCompletion2 = true;
                        _context3.next = 6;
                        break;

                    case 20:
                        _context3.next = 26;
                        break;

                    case 22:
                        _context3.prev = 22;
                        _context3.t1 = _context3['catch'](4);
                        _didIteratorError2 = true;
                        _iteratorError2 = _context3.t1;

                    case 26:
                        _context3.prev = 26;
                        _context3.prev = 27;

                        if (!_iteratorNormalCompletion2 && _iterator2.return) {
                            _iterator2.return();
                        }

                    case 29:
                        _context3.prev = 29;

                        if (!_didIteratorError2) {
                            _context3.next = 32;
                            break;
                        }

                        throw _iteratorError2;

                    case 32:
                        return _context3.finish(29);

                    case 33:
                        return _context3.finish(26);

                    case 34:

                        log.debug(chalk.blue('Processed ', processedCount, ' new submissions.'));

                    case 35:
                    case 'end':
                        return _context3.stop();
                }
            }
        }, _callee3, this, [[4, 22, 26, 34], [27,, 29, 33]]);
    }));

    return function processNewSubmissions(_x5, _x6, _x7) {
        return _ref3.apply(this, arguments);
    };
}();

var processSubmission = function () {
    var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(submission, reddit) {
        var imageDetails, existingMagicSubmission;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
                switch (_context4.prev = _context4.next) {
                    case 0:
                        _context4.next = 2;
                        return submission.approved;

                    case 2:
                        if (!_context4.sent) {
                            _context4.next = 10;
                            break;
                        }

                        _context4.t0 = log;
                        _context4.next = 6;
                        return submission.permalink;

                    case 6:
                        _context4.t1 = _context4.sent;
                        _context4.t2 = "Submission is already approved, - ignoring submission: https://www.reddit.com" + _context4.t1;

                        _context4.t0.debug.call(_context4.t0, _context4.t2);

                        return _context4.abrupt('return');

                    case 10:
                        _context4.t3 = log;
                        _context4.t4 = chalk.yellow('Starting process for submission by: ');
                        _context4.next = 14;
                        return submission.author.name;

                    case 14:
                        _context4.t5 = _context4.sent;
                        _context4.t6 = Date;
                        _context4.next = 18;
                        return submission.created_utc;

                    case 18:
                        _context4.t7 = _context4.sent;
                        _context4.t8 = _context4.t7 * 1000;
                        _context4.t9 = new _context4.t6(_context4.t8);

                        _context4.t3.debug.call(_context4.t3, _context4.t4, _context4.t5, ', submitted: ', _context4.t9);

                        _context4.next = 24;
                        return submission.url.endsWith('.jpg');

                    case 24:
                        _context4.t10 = !_context4.sent;

                        if (!_context4.t10) {
                            _context4.next = 29;
                            break;
                        }

                        _context4.next = 28;
                        return submission.url.endsWith('.png');

                    case 28:
                        _context4.t10 = !_context4.sent;

                    case 29:
                        if (!_context4.t10) {
                            _context4.next = 37;
                            break;
                        }

                        _context4.t11 = log;
                        _context4.next = 33;
                        return submission.permalink;

                    case 33:
                        _context4.t12 = _context4.sent;
                        _context4.t13 = "Image was not a jpg/png - ignoring submission: https://www.reddit.com" + _context4.t12;

                        _context4.t11.debug.call(_context4.t11, _context4.t13);

                        return _context4.abrupt('return', null);

                    case 37:
                        _context4.next = 39;
                        return getImageDetails(submission);

                    case 39:
                        imageDetails = _context4.sent;

                        if (!(imageDetails == null)) {
                            _context4.next = 48;
                            break;
                        }

                        _context4.t14 = log;
                        _context4.next = 44;
                        return submission.permalink;

                    case 44:
                        _context4.t15 = _context4.sent;
                        _context4.t16 = "Could not download image (probably deleted) - removing submission: https://www.reddit.com" + _context4.t15;

                        _context4.t14.debug.call(_context4.t14, _context4.t16);

                        removeAsBroken(reddit, submission);

                    case 48:
                        if (!isImageTooSmall(imageDetails)) {
                            _context4.next = 57;
                            break;
                        }

                        _context4.t17 = log;
                        _context4.next = 52;
                        return submission.permalink;

                    case 52:
                        _context4.t18 = _context4.sent;
                        _context4.t19 = "Image is too small, removing - removing submission: https://www.reddit.com" + _context4.t18;

                        _context4.t17.debug.call(_context4.t17, _context4.t19);

                        removeAsTooSmall(reddit, submission);
                        return _context4.abrupt('return');

                    case 57:
                        if (!isImageUncropped(imageDetails)) {
                            _context4.next = 66;
                            break;
                        }

                        _context4.t20 = log;
                        _context4.next = 61;
                        return submission.permalink;

                    case 61:
                        _context4.t21 = _context4.sent;
                        _context4.t22 = "Image is uncropped, removing - removing submission: https://www.reddit.com" + _context4.t21;

                        _context4.t20.debug.call(_context4.t20, _context4.t22);

                        removeAsUncropped(reddit, submission);
                        return _context4.abrupt('return');

                    case 66:
                        _context4.next = 68;
                        return getMagicSubmission(imageDetails.dhash);

                    case 68:
                        existingMagicSubmission = _context4.sent;

                        log.debug('Existing submission for dhash:', chalk.blue(imageDetails.dhash), chalk.yellow(JSON.stringify(existingMagicSubmission)));

                        if (!(existingMagicSubmission != null)) {
                            _context4.next = 75;
                            break;
                        }

                        _context4.next = 73;
                        return processExistingSubmission(submission, existingMagicSubmission, reddit);

                    case 73:
                        _context4.next = 77;
                        break;

                    case 75:
                        _context4.next = 77;
                        return processNewSubmission(submission, imageDetails);

                    case 77:
                    case 'end':
                        return _context4.stop();
                }
            }
        }, _callee4, this);
    }));

    return function processSubmission(_x8, _x9) {
        return _ref4.apply(this, arguments);
    };
}();

var processExistingSubmission = function () {
    var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(submission, existingMagicSubmission, reddit) {
        var lastSubmission, lastSubmissionRemoved, modComment, magicIgnore, lastIsRepostOnlyByUser, lastIsRemovedAsRepost, isRepost, doneRemove, sameUserForBothSubmissions, imageIsBlacklisted, removalReason;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
            while (1) {
                switch (_context5.prev = _context5.next) {
                    case 0:
                        log.debug(chalk.yellow('Found existing submission for dhash, matched: ' + existingMagicSubmission._id));
                        _context5.next = 3;
                        return reddit.getSubmission(existingMagicSubmission.reddit_id);

                    case 3:
                        lastSubmission = _context5.sent;
                        _context5.next = 6;
                        return lastSubmission.removed;

                    case 6:
                        lastSubmissionRemoved = _context5.sent;


                        existingMagicSubmission.highest_score = Math.max(existingMagicSubmission.highest_score, lastSubmission.score);
                        existingMagicSubmission.duplicates.push(submission.id);

                        log.debug('Existing submission found.');
                        modComment = void 0;

                        if (!lastSubmissionRemoved) {
                            _context5.next = 23;
                            break;
                        }

                        log.debug('Last submission removed, getting mod comment');
                        _context5.next = 15;
                        return getModComment(reddit, existingMagicSubmission.reddit_id);

                    case 15:
                        modComment = _context5.sent;
                        _context5.next = 18;
                        return isMagicIgnore(modComment);

                    case 18:
                        magicIgnore = _context5.sent;

                        if (!(modComment == null || magicIgnore)) {
                            _context5.next = 23;
                            break;
                        }

                        log.info('Found repost of removed submission, but no relevant removal message exists. Ignoring submission: ', submission.id);
                        saveMagicSubmission(existingMagicSubmission);
                        return _context5.abrupt('return');

                    case 23:
                        _context5.next = 25;
                        return isRepostOnlyByUserRemoval(modComment);

                    case 25:
                        lastIsRepostOnlyByUser = _context5.sent;
                        _context5.next = 28;
                        return isRepostRemoval(modComment);

                    case 28:
                        lastIsRemovedAsRepost = _context5.sent;
                        _context5.next = 31;
                        return isRecentRepost(submission, lastSubmission, existingMagicSubmission.highest_score);

                    case 31:
                        _context5.t0 = _context5.sent;

                        if (_context5.t0) {
                            _context5.next = 34;
                            break;
                        }

                        _context5.t0 = isTopRepost(existingMagicSubmission.highest_score);

                    case 34:
                        isRepost = _context5.t0;
                        doneRemove = false;
                        _context5.next = 38;
                        return lastSubmission.author.name;

                    case 38:
                        _context5.t1 = _context5.sent;
                        _context5.next = 41;
                        return submission.author.name;

                    case 41:
                        _context5.t2 = _context5.sent;
                        sameUserForBothSubmissions = _context5.t1 == _context5.t2;
                        imageIsBlacklisted = lastSubmissionRemoved && !lastIsRemovedAsRepost;

                        if (!(lastIsRepostOnlyByUser && sameUserForBothSubmissions)) {
                            _context5.next = 50;
                            break;
                        }

                        log.info('Found matching hash for submission', submission.id, ', but approving as special user only repost.');
                        existingMagicSubmission.approve = true; // just auto-approve as this is almost certainly the needed action
                        submission.approve();
                        _context5.next = 62;
                        break;

                    case 50:
                        if (!imageIsBlacklisted) {
                            _context5.next = 61;
                            break;
                        }

                        _context5.next = 53;
                        return getRemovalReason(modComment);

                    case 53:
                        removalReason = _context5.sent;

                        if (!(removalReason == null)) {
                            _context5.next = 57;
                            break;
                        }

                        log.info(chalk.red("Ignoring submission because couldn't read the last removal message. Submission: ", submission.id, ", removal message thread: ", existingMagicSubmission.reddit_id));
                        return _context5.abrupt('return');

                    case 57:
                        removeAsBlacklisted(reddit, submission, lastSubmission, removalReason);
                        doneRemove = true;
                        _context5.next = 62;
                        break;

                    case 61:
                        if (isRepost) {
                            removeAsRepost(reddit, submission, lastSubmission, lastIsRemovedAsRepost);
                            doneRemove = true;
                        } else if (!lastSubmissionRemoved) {
                            log.info('Found matching hash for submission ', submission.id, ', re-approving as it is over the repost limit.');
                            submission.approve();
                        } else {
                            log.error('Could not process submission - old unnapproved link? Ignoring submission:', submission.id);
                        }

                    case 62:
                        if (doneRemove) {
                            _context5.next = 66;
                            break;
                        }

                        _context5.next = 65;
                        return submission.id;

                    case 65:
                        existingMagicSubmission.reddit_id = _context5.sent;

                    case 66:
                        _context5.next = 68;
                        return saveMagicSubmission(existingMagicSubmission);

                    case 68:
                    case 'end':
                        return _context5.stop();
                }
            }
        }, _callee5, this);
    }));

    return function processExistingSubmission(_x10, _x11, _x12) {
        return _ref5.apply(this, arguments);
    };
}();

var processNewSubmission = function () {
    var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6(submission, imageDetails) {
        var newMagicSubmission;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
            while (1) {
                switch (_context6.prev = _context6.next) {
                    case 0:
                        log.debug(chalk.green('Processing new submission: ' + submission.id));
                        newMagicSubmission = new MagicSubmission(imageDetails.dhash, submission, submission.score);
                        _context6.next = 4;
                        return saveMagicSubmission(newMagicSubmission, true);

                    case 4:
                    case 'end':
                        return _context6.stop();
                }
            }
        }, _callee6, this);
    }));

    return function processNewSubmission(_x13, _x14) {
        return _ref6.apply(this, arguments);
    };
}();

var isRecentRepost = function () {
    var _ref7 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7(currentSubmission, lastSubmission, highest_score) {
        var currentDate, lastPosted, daysLimit, score, daysSincePosted;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
            while (1) {
                switch (_context7.prev = _context7.next) {
                    case 0:
                        _context7.t0 = moment;
                        _context7.next = 3;
                        return currentSubmission.created_utc;

                    case 3:
                        _context7.t1 = _context7.sent;
                        _context7.t2 = _context7.t1 * 1000;
                        currentDate = (0, _context7.t0)(_context7.t2);
                        _context7.t3 = moment;
                        _context7.next = 9;
                        return lastSubmission.created_utc;

                    case 9:
                        _context7.t4 = _context7.sent;
                        _context7.t5 = _context7.t4 * 1000;
                        lastPosted = (0, _context7.t3)(_context7.t5);
                        daysLimit = process.env.REPOST_DAYS;
                        _context7.t6 = Math;
                        _context7.next = 16;
                        return lastSubmission.score;

                    case 16:
                        _context7.t7 = _context7.sent;
                        _context7.t8 = highest_score;
                        score = _context7.t6.max.call(_context7.t6, _context7.t7, _context7.t8);

                        if (score > +process.env.LARGE_SCORE) {
                            daysLimit = process.env.LARGE_SCORE_REPOST_DAYS;
                        }

                        daysSincePosted = currentDate.diff(lastPosted, 'days');
                        return _context7.abrupt('return', daysSincePosted < daysLimit);

                    case 22:
                    case 'end':
                        return _context7.stop();
                }
            }
        }, _callee7, this);
    }));

    return function isRecentRepost(_x15, _x16, _x17) {
        return _ref7.apply(this, arguments);
    };
}();

var removePost = function () {
    var _ref8 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8(reddit, submission, removalReason) {
        var replyable;
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
            while (1) {
                switch (_context8.prev = _context8.next) {
                    case 0:
                        submission.remove();
                        _context8.next = 3;
                        return submission.reply(removalReason);

                    case 3:
                        replyable = _context8.sent;

                        replyable.distinguish();

                    case 5:
                    case 'end':
                        return _context8.stop();
                }
            }
        }, _callee8, this);
    }));

    return function removePost(_x18, _x19, _x20) {
        return _ref8.apply(this, arguments);
    };
}();

// ==================================== Removal messages =====================================

var removeAsBroken = function () {
    var _ref9 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee9(reddit, submission) {
        var removalReason;
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
            while (1) {
                switch (_context9.prev = _context9.next) {
                    case 0:
                        removalReason = 'It looks like your link is broken or deleted? I\'ve removed it so you will need to fix it and resubmit.';

                        removePost(reddit, submission, removalReason + removalFooter);

                    case 2:
                    case 'end':
                        return _context9.stop();
                }
            }
        }, _callee9, this);
    }));

    return function removeAsBroken(_x21, _x22) {
        return _ref9.apply(this, arguments);
    };
}();

var removeAsUncropped = function () {
    var _ref10 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee10(reddit, submission) {
        var removalReason;
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
            while (1) {
                switch (_context10.prev = _context10.next) {
                    case 0:
                        removalReason = 'This image appears to be uncropped (i.e. black bars at the top and bottom). Black bars must be cropped out before posting (or post the original).';

                        removePost(reddit, submission, removalReason + removalFooter);

                    case 2:
                    case 'end':
                        return _context10.stop();
                }
            }
        }, _callee10, this);
    }));

    return function removeAsUncropped(_x23, _x24) {
        return _ref10.apply(this, arguments);
    };
}();

var removeAsTooSmall = function () {
    var _ref11 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee11(reddit, submission) {
        var removalReason;
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
            while (1) {
                switch (_context11.prev = _context11.next) {
                    case 0:
                        removalReason = 'This image is too small (images must be larger than 270px*270px). Try drag the image into [google image search](https://www.google.com/imghp?sbi=1) and look for a bigger version.';

                        removePost(reddit, submission, removalReason + removalFooter);

                    case 2:
                    case 'end':
                        return _context11.stop();
                }
            }
        }, _callee11, this);
    }));

    return function removeAsTooSmall(_x25, _x26) {
        return _ref11.apply(this, arguments);
    };
}();

var removeAsRepost = function () {
    var _ref12 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee12(reddit, submission, lastSubmission, noOriginalSubmission) {
        var permalink, removalReason;
        return regeneratorRuntime.wrap(function _callee12$(_context12) {
            while (1) {
                switch (_context12.prev = _context12.next) {
                    case 0:
                        _context12.t0 = log;
                        _context12.t1 = submission.id;
                        _context12.next = 4;
                        return lastSubmission.id;

                    case 4:
                        _context12.t2 = _context12.sent;

                        _context12.t0.info.call(_context12.t0, 'Found matching hash for submission: ', _context12.t1, ', removing as repost of:', _context12.t2);

                        _context12.next = 8;
                        return lastSubmission.permalink;

                    case 8:
                        _context12.t3 = _context12.sent;
                        permalink = 'https://www.reddit.com/' + _context12.t3;
                        _context12.t4 = 'Good hmmm but unfortunately your post has been removed because it has been posted recently [here](' + permalink + ') by another user. ([direct link](';
                        _context12.next = 13;
                        return lastSubmission.url;

                    case 13:
                        _context12.t5 = _context12.sent;
                        _context12.t6 = _context12.t4 + _context12.t5;
                        removalReason = _context12.t6 + ')).';


                        if (noOriginalSubmission) {
                            removalReason += outdent(_templateObject2);
                        }
                        removePost(reddit, submission, removalReason + removalFooter);

                    case 18:
                    case 'end':
                        return _context12.stop();
                }
            }
        }, _callee12, this);
    }));

    return function removeAsRepost(_x27, _x28, _x29, _x30) {
        return _ref12.apply(this, arguments);
    };
}();

var removeAsBlacklisted = function () {
    var _ref13 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee13(reddit, submission, lastSubmission, blacklistReason) {
        var permalink, removalReason;
        return regeneratorRuntime.wrap(function _callee13$(_context13) {
            while (1) {
                switch (_context13.prev = _context13.next) {
                    case 0:
                        _context13.t0 = log;
                        _context13.t1 = submission.id;
                        _context13.next = 4;
                        return lastSubmission.id;

                    case 4:
                        _context13.t2 = _context13.sent;

                        _context13.t0.info.call(_context13.t0, 'Removing ', _context13.t1, ', as blacklisted. Root blacklisted submission: ', _context13.t2);

                        _context13.next = 8;
                        return lastSubmission.permalink;

                    case 8:
                        _context13.t3 = _context13.sent;
                        permalink = 'https://www.reddit.com/' + _context13.t3;
                        _context13.t4 = outdent;
                        _context13.t5 = _templateObject3;
                        _context13.next = 14;
                        return lastSubmission.url;

                    case 14:
                        _context13.t6 = _context13.sent;
                        _context13.t7 = permalink;
                        _context13.t8 = blacklistReason;
                        removalReason = (0, _context13.t4)(_context13.t5, _context13.t6, _context13.t7, _context13.t8);

                        removePost(reddit, submission, removalReason + removalFooter);

                    case 19:
                    case 'end':
                        return _context13.stop();
                }
            }
        }, _callee13, this);
    }));

    return function removeAsBlacklisted(_x31, _x32, _x33, _x34) {
        return _ref13.apply(this, arguments);
    };
}();

var _templateObject = _taggedTemplateLiteral(['\n    \n\n    -----------------------\n\n    *I\'m a bot so if I was wrong, reply to me and a moderator will check it. ([rules faq](https://www.reddit.com/r/', '/wiki/rules))*'], ['\n    \n\n    -----------------------\n\n    *I\'m a bot so if I was wrong, reply to me and a moderator will check it. ([rules faq](https://www.reddit.com/r/', '/wiki/rules))*']),
    _templateObject2 = _taggedTemplateLiteral(['\n        \n\n        That submission image was also removed as a repost, but I couldn\'t programatically find the original.\n        '], ['\n        \n\n        That submission image was also removed as a repost, but I couldn\'t programatically find the original.\n        ']),
    _templateObject3 = _taggedTemplateLiteral(['Your post has been removed because it is a repost of [this image](', ') posted [here](', '), and that post was removed because:\n\n        ', ''], ['Your post has been removed because it is a repost of [this image](', ') posted [here](', '), and that post was removed because:\n\n        ', '']);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

// standard modules
require('dotenv').config();
var moment = require('moment');
var outdent = require('outdent');
var chalk = require('chalk');
var log = require('loglevel');
var cliProgress = require('cli-progress');
log.setLevel(process.env.LOG_LEVEL);

// magic eye modules

var _require = require('./image_utils.js'),
    getImageDetails = _require.getImageDetails;

var _require2 = require('./mongodb_data.js'),
    MagicSubmission = _require2.MagicSubmission,
    getMagicSubmission = _require2.getMagicSubmission,
    saveMagicSubmission = _require2.saveMagicSubmission,
    deleteMagicSubmission = _require2.deleteMagicSubmission;

var _require3 = require('./reddit_utils.js'),
    getModComment = _require3.getModComment,
    isRepostOnlyByUserRemoval = _require3.isRepostOnlyByUserRemoval,
    isRepostRemoval = _require3.isRepostRemoval,
    getRemovalReason = _require3.getRemovalReason,
    sliceSubmissionId = _require3.sliceSubmissionId,
    isMagicIgnore = _require3.isMagicIgnore;

function isImageTooSmall(imageDetails) {
    if (imageDetails.height == null || imageDetails.width == null) {
        return false;
    }

    return imageDetails.height * imageDetails.width < 270 * 270; // https://i.imgur.com/xLRZOF5.png
}

function isImageUncropped(imageDetails) {
    if (imageDetails.trimmedHeight == null || imageDetails.trimmedHeight == null) {
        return false;
    }

    log.debug(chalk.blue('(imageDetails.trimmedHeight / imageDetails.height) < 0.75', imageDetails.trimmedHeight / imageDetails.height));
    log.debug(chalk.blue('imageDetails.trimmedHeight', imageDetails.trimmedHeight));
    log.debug(chalk.blue('imageDetails.height', imageDetails.height));
    return imageDetails.trimmedHeight / imageDetails.height < 0.81; // https://i.imgur.com/tfDO06G.png
}

function isTopRepost(highestScore) {
    return highestScore > +process.env.TOP_SCORE_THRESHOLD;
}

var removalFooter = outdent(_templateObject, process.env.SUBREDDIT_NAME);

module.exports = {
    processOldSubmissions: processOldSubmissions,
    processNewSubmissions: processNewSubmissions
};
//# sourceMappingURL=submission_processor.js.map