// Dependencies ---------------------------------------------------------------
var EventEmitter = require('events').EventEmitter,
    fs = require('fs.extra'),
    path = require('path'),
    FilePattern = require('../file/Pattern'),
    util = require('../util');


// Abstract Base Task ---------------------------------------------------------
function Task(name, pattern, handler, config) {
    this._name = name;
    this._pattern = pattern ? FilePattern.toPattern(pattern) : null;
    this._handler = handler || {};
    this._mode = handler.mode || Task.Each;
    this._config = config || {};
    this._silent = false;
}


// Task Modes -----------------------------------------------------------------
Task.Each = 1;
Task.All = 2;
Task.Single = 4;


// Methods --------------------------------------------------------------------
util.inherit(Task, EventEmitter, {

    matches: function(files) {
        return this._pattern === null ? true : this._pattern.matches(files);
    },

    run: function(substrat, mapper, options, files, silent) {

        this._silent = silent;

        if (files)  {
            this.log('Started for ' + files.length + ' file(s)...');

        } else {
            this.log('Started');
        }

        // Shortcuts
        var done = this.done.bind(this),
            handler = this._handler;

        // Task configuration
        var e = {
            substrat: substrat,
            config: this._config,
            options: options
        };

        // Switch out the read function with a stub in case we don't need the
        // file data for the task
        var read = this.reader(handler.data, e);

        // Run the task once for each file
        if (this._mode === Task.Each) {

            util.async(files, function(file, next) {

                read(file, function(err, data) {

                    if (err) {
                        this.error(err, next);

                    } else {
                        e.mapped = handler.map(e, file);
                        e.source = file;
                        e.data = data;
                        e.path = path.join(options.src, file);

                        mapper.update(file, e.mapped);
                        this.invoke(e, next);
                    }

                }, this);

            }, done, this);

        // Run the task once for all files at once
        } else if (this._mode === Task.All) {

            e.all = [];
            e.mapped = handler.map(e, this._config.file);

            util.async(files, function(file, next) {

                read(file, function(err, data) {

                    if (err) {
                        next(err);

                    } else {
                        e.all.push({
                            source: file,
                            path: path.join(options.src, file),
                            data: data
                        });
                        mapper.update(file, e.mapped);
                        next();
                    }

                });

            }, function(err) {
                err ? this.error(err, done) : this.invoke(e, done);

            }, this);

        // Run the task without and input file and generate mappings and output
        } else if (this._mode === Task.Single) {
            e.mapped = handler.map(e, this._config.file);
            mapper.virtual(e.mapped);
            this.invoke(e, done);

        } else {
            throw new Error('Unknown Taskmode: ' + this._mode);
        }

    },

    done: function() {
        this.emit('done');
    },

    error: function(err, done) {
        this.log('[Error]'.red + ' ' + err);
        done();
    },

    invoke: function(e, done) {

        var writes = this.writes.bind(this);
        this._handler.run(e, function(err, data) {

            if (arguments.length > 2) {
                throw new Error('Too many arguments returned by task.');

            } else if (typeof done !== 'string' && (!done instanceof Array)) {
                throw new Error('Invalid data returned by task.');
            }

            if (err) {
                done(err);

            } else if (e.mapped) {
                writes(e.options.dest, e.mapped, data, done);

            } else {
                done();
            }

        });

    },


    // IO Helpers -------------------------------------------------------------
    log: function(msg) {
        !this._silent && console.log(('[Task ' + this._name + ']').magenta, msg);
    },

    reader: function(data, e) {
        if (typeof data === 'function' ? data(e) : !!data) {
            return this.read.bind(this, e.options.src);

        } else {
            return function(file, callback, scope) {
                callback.call(scope || null, null, null);
            };
        }
    },

    read: function(src, file, done, scope) {
        fs.readFile(path.join(src, file), function(err, data) {
            done.call(scope, err, data);
        });
    },

    writes: function(dest, files, data, done) {

        files = files instanceof Array ? files : [files];
        data = data instanceof Array ? data : [data];

        util.parallel(files, function(file, index, complete) {
            this.write(dest, file, data[index], complete);

        }, done, this);

    },

    write: function(dest, file, data, done) {
        var target = path.join(dest, file);
        fs.mkdirp(path.dirname(target), function(err) {
            err ? done(err) : fs.writeFile(target, data, done);
        });
    }

});

module.exports = Task;
