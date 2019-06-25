let util = require('util'),
  winston = require('winston'),
  _ = require('lodash');

const Raven = require('@sentry/node');

let onError = function (error) {
  var message = "Cannot talk to sentry.";
  if (error && error.reason) {
    message += " Reason: " + error.reason;
  }
  console.log(message);
}

let Sentry = winston.transports.Sentry = function (options) {
  winston.Transport.call(this, _.pick(options, "level"));

  // Default options
  this.defaults = {
    dsn: '',
    logger: 'root',
    levelsMap: {
      silly: 'debug',
      verbose: 'debug',
      info: 'info',
      debug: 'debug',
      warn: 'warning',
      error: 'error'
    },
    environment: process.env.NODE_ENV,
    tags: {},
    extra: {}
  }

  // For backward compatibility with deprecated `globalTags` option
  options.tags = options.tags || options.globalTags;

  this.options = _.defaultsDeep(options, this.defaults);

  Raven.init(this.options);

};

//
// Inherit from `winston.Transport` so you can take advantage
// of the base functionality and `.handleExceptions()`.
//
util.inherits(Sentry, winston.Transport);

//
// Expose the name of this Transport on the prototype
Sentry.prototype.name = 'sentry';
//


Sentry.prototype.log = function (oldLevel, msg, meta, callback) {
  const level = this.options.levelsMap[oldLevel];

  meta = meta || {};

  let extraData = _.extend({}, meta),
    tags = extraData.tags;
  delete extraData.tags;

  let extra = {
    'level': level,
    'extra': extraData,
    'tags': tags
  };

  if (extraData.request) {
    extra.request = extraData.request;
    delete extraData.request;
  }

  if (extraData.user) {
    extra.user = extraData.user;
    delete extraData.user;
  }

  try {
    if (level == 'error') {
      // Support exceptions logging
      if (meta instanceof Error) {
        if (msg == '') {
          msg = meta;
        } else {
          meta.message = msg + ". cause: " + meta.message;
          msg = meta;
        }
      }

      Raven.configureScope(scope => {
        if (extra.extra) {
          for (let prop in extra.extra) {
            scope.setExtra(prop, extra.extra[prop]);
          }
          delete extra.extra
        }

        if (extra.tags) {
          const tagKeys = extra.tags.keys()
          tagKeys.forEach((k) => {
            scope.setTag(k, extra.tags[k]);
          })
          delete extra.tags

        }

        if (extra.user) {
          scope.setUser(extra.user);
          delete extra.user
        }

        if (extra.level) {
          scope.setLevel(extra.level);
        }

        if (extra.request) {
          const httpRequest = extra.request
          const method = httpRequest.method
          const path = httpRequest.path
          scope.setFingerprint([method, path]);
        }

        Raven.captureException(new Error(msg), function (err, res) {
          if (err) {
            onError(err)
          }
          callback(null, true);
        });
        scope.clear();

      });


    } else {

      Raven.configureScope(scope => {
        if (extra.extra) {
          for (let prop in extra.extra) {
            scope.setExtra(prop, extra.extra[prop]);
          }
          delete extra.extra
        }

        if (extra.tags) {
          const tagKeys = extra.tags.keys()
          tagKeys.forEach((k) => {
            scope.setTag(k, extra.tags[k]);
          })
          delete extra.tags

        }

        if (extra.user) {
          scope.setUser(extra.user);
          delete extra.user
        }

        if (extra.level) {
          scope.setLevel(extra.level);

        }

        Raven.captureMessage(msg, function (err, res) {
          if (err) {
            onError(err)
          }

          callback(null, true);
        });
        scope.clear();

      });
    }


  } catch (err) {
    console.error(err);
  }
};

module.exports = Sentry;
