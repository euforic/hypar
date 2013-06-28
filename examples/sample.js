
var Hypar = require('..')
  , fs = require('fs')
  , path = require('path')
  , join = path.join;

var tags = {};

var parser = Hypar();

parser._onopentag = function (e) {

  ((tags[e.name]) || (tags[e.name] = [])).push(e);

  var elType = e.name.charAt(0).toUpperCase() + e.name.substr(1).toLowerCase();
  var elID = (e.attributes.ID || ('' + elType + (tags[e.name].length)));
  var elAttrs = JSON.stringify(e.attributes).toLowerCase();

  var output = '' +
    'var ' + elID + ' = UI.'+ elType + '(' + elAttrs + ');\n' +
    'var ' + elID + 'xModel = {};\n\n';

  this.push(output);
};

fs.createReadStream(join(__dirname,'../test/fixtures/sample.html'))
  .pipe(parser)
  .pipe(process.stdout);