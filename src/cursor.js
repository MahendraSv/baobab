/**
 * Baobab Cursor Abstraction
 * ==========================
 *
 * Nested selection into a baobab tree.
 */
var EventEmitter = require('emmett'),
    mixins = require('./mixins.js'),
    helpers = require('./helpers.js'),
    types = require('./typology.js');

/**
 * Main Class
 */
function Cursor(root, path) {
  var self = this;

  // Extending event emitter
  EventEmitter.call(this);

  // Enforcing array
  path = path || [];

  // Properties
  this.root = root;
  this.path = path;
  this.relevant = this.reference() !== undefined;

  // Root listeners
  this.root.on('update', function(e) {
    var log = e.data.log,
        shouldFire = false,
        c, p, l, m, i, j;

    // If selector listens at root, we fire
    if (!self.path.length)
      return self.emit('update');

    // Checking update log to see whether the cursor should update.
    root:
    for (i = 0, l = log.length; i < l; i++) {
      c = log[i];

      for (j = 0, m = c.length; j < m; j++) {
        p = c[j];

        // If path is not relevant to us, we break
        if (p !== self.path[j])
          break;

        // If we reached last item and we are relevant, we fire
        if (j + 1 === m || j + 1 === self.path.length) {
          shouldFire = true;
          break root;
        }
      }
    }

    // Handling relevancy
    var data = self.reference() !== undefined;

    if (self.relevant) {
      if (data && shouldFire) {
        self.emit('update');
      }
      else {
        self.emit('irrelevant');
        self.relevant = false;
      }
    }
    else {
      if (data && shouldFire) {
        self.emit('relevant');
        self.emit('update');
        self.relevant = true;
      }
    }
  });

  // Making mixin
  this.mixin = mixins.cursor(this);
}

helpers.inherits(Cursor, EventEmitter);

/**
 * Private prototype
 */
Cursor.prototype._stack = function(spec) {
  this.root._stack(helpers.pathObject(this.path, spec));
  return this;
};

/**
 * Prototype
 */
Cursor.prototype.select = function(path) {
  if (arguments.length > 1)
    path = helpers.arrayOf(arguments);

  if (!types.check(path, 'path'))
    throw Error('baobab.Cursor.select: invalid path.');
  return this.root.select(this.path.concat(path));
};

Cursor.prototype.up = function() {
  if (this.path.length)
    return this.root.select(this.path.slice(0, -1));
  else
    return this.root.select([]);
};

Cursor.prototype.left = function() {
  var last = +this.path[this.path.length - 1];

  if (isNaN(last))
    throw Error('baobab.Cursor.left: cannot go left on a non-list type.');

  return this.root.select(this.path.slice(0, -1).concat(last - 1));
};

Cursor.prototype.leftmost = function() {
  var last = +this.path[this.path.length - 1];

  if (isNaN(last))
    throw Error('baobab.Cursor.leftmost: cannot go left on a non-list type.');

  return this.root.select(this.path.slice(0, -1).concat(0));
};

Cursor.prototype.right = function() {
  var last = +this.path[this.path.length - 1];

  if (isNaN(last))
    throw Error('baobab.Cursor.right: cannot go right on a non-list type.');

  return this.root.select(this.path.slice(0, -1).concat(last + 1));
};

Cursor.prototype.rightmost = function() {
  var last = +this.path[this.path.length - 1];

  if (isNaN(last))
    throw Error('baobab.Cursor.right: cannot go right on a non-list type.');

  var list = this.up().reference();

  return this.root.select(this.path.slice(0, -1).concat(list.length - 1));
};

Cursor.prototype.down = function() {
  var last = +this.path[this.path.length - 1];

  if (!(this.reference() instanceof Array))
    throw Error('baobab.Cursor.down: cannot descend on a non-list type.');

  return this.root.select(this.path.concat(0));
};

Cursor.prototype.get = function(path) {
  if (arguments.length > 1)
    path = helpers.arrayOf(arguments);

  if (types.check(path, 'string|number|array'))
    return this.root.get(this.path.concat(path));
  else
    return this.root.get(this.path);
};

Cursor.prototype.reference = function(path) {
  if (arguments.length > 1)
    path = helpers.arrayOf(arguments);

  if (types.check(path, 'string|number|array'))
    return this.root.reference(this.path.concat(path));
  else
    return this.root.reference(this.path);
};

Cursor.prototype.clone = function(path) {
  if (arguments.length > 1)
    path = helpers.arrayOf(arguments);

  if (types.check(path, 'string|number|array'))
    return this.root.clone(this.path.concat(path));
  else
    return this.root.clone(this.path);
};

Cursor.prototype.set = function(key, value) {
  if (arguments.length < 2)
    throw Error('baobab.Cursor.set: expecting at least key/value.');

  var spec = {};
  spec[key] = {$set: value};
  return this.update(spec);
};

Cursor.prototype.edit = function(value) {
  return this.update({$set: value});
};

Cursor.prototype.apply = function(fn) {
  if (typeof fn !== 'function')
    throw Error('baobab.Cursor.apply: argument is not a function.');

  return this.update({$apply: fn});
};

// TODO: maybe composing should be done here rather than in the merge
Cursor.prototype.thread = function(fn) {
  if (typeof fn !== 'function')
    throw Error('baobab.Cursor.thread: argument is not a function.');

  return this.update({$thread: fn});
};

// TODO: consider dropping the ahead testing
Cursor.prototype.push = function(value) {
  if (!(this.reference() instanceof Array))
    throw Error('baobab.Cursor.push: trying to push to non-array value.');

  if (arguments.length > 1)
    return this.update({$push: helpers.arrayOf(arguments)});
  else
    return this.update({$push: value});
};

Cursor.prototype.unshift = function(value) {
  if (!(this.reference() instanceof Array))
    throw Error('baobab.Cursor.push: trying to push to non-array value.');

  if (arguments.length > 1)
    return this.update({$unshift: helpers.arrayOf(arguments)});
  else
    return this.update({$unshift: value});
};

Cursor.prototype.update = function(spec) {
  return this._stack(spec);
};

/**
 * Type definition
 */
types.add('cursor', function(v) {
  return v instanceof Cursor;
});

/**
 * Output
 */
Cursor.prototype.toJSON = function() {
  return this.get();
};

/**
 * Export
 */
module.exports = Cursor;
