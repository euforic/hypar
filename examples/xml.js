
var Hypar = require('..')
  , fs = require('fs')
  , path = require('path')
  , join = path.join;

var tags = {};

var parser = Hypar();

parser.on('tag', function (e) {
  if(e.name !== 'string') {
    console.log();
    console.log(tags);
    console.log();
    return;
  }
  tags[e.attr.name] = this._text;
});

fs.createReadStream(join(__dirname,'../test/fixtures/sample.xml'))
  .pipe(parser)
  .pipe(process.stdout);