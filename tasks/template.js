// Dependencies ---------------------------------------------------------------
var Task = require('../lib/task/Task'),
    mustache = require('mustache');


// Template Task --------------------------------------------------------------
var template = {

    mode: Task.Each,
    data: true,
    filterFiles: false,

    map: function(e, file) {
        return file;
    },

    run: function(e, done) {

        var locals;
        if (typeof e.config.data === 'function') {
            locals = e.config.data(e);

        } else {
            locals = e.config.data;
        }

        var template = mustache.compile(e.data.toString(), e.config.tags);
        done(null, template(locals));

    }

};


// Factory --------------------------------------------------------------------
module.exports = {

    task: function(pattern, data, tags) {
        return new Task('Template', pattern, template, {
            data: data,
            tags: tags || mustache.tags
        });
    }

};

