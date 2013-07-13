
/*!
 * html parser
 */

/**
 * module deps
 */

var Stream = require('stream').Transform
  , debug = require('debug')('hypar');

/**
 * expose Hypar
 */

module.exports = Hypar;

/**
 * [Hypar description]
 * @param {[type]} options [description]
 */

function Hypar() {
  if (!(this instanceof Hypar)) { return new Hypar(); }
  Stream.call(this);
  this._tagname = '';
  this._attribname = '';
  this._attribs = null;
  this._stack = [];
  this._done = false;
  this._state = TEXT;
  this._buffer = '';
  this._sectionStart = 0;
  this._index = 0;
  this._special = 0; // 1 for script, 2 for style
  this._text = this.text = '';
}

/**
 * inherit from Transform Stream
 */

Hypar.prototype.__proto__ = Stream.prototype;

/**
 * [ description]
 * @param  {[type]}   chunk    [description]
 * @param  {[type]}   encoding [description]
 * @param  {Function} done     [description]
 * @return {[type]}            [description]
 */

Hypar.prototype._transform = function(chunk, encoding, done) {
  this._buffer += chunk;

  for (var i = 0; this._index < this._buffer.length; i++) {
    var c = this._buffer.charAt(this._index);
    if (this._state === TEXT) {
      if (c === '<') {
        this._emitIfToken('ontext');
        this._state = BEFORE_TAG_NAME;
        this._sectionStart = this._index;
      }
    } else if (this._state === BEFORE_TAG_NAME) {
      if (c === '/') {
        this._state = BEFORE_CLOSING_TAG_NAME;
      } else if (c === '>' || this._special > 0) {
        this._state = TEXT;
      } else {
        if (whitespace(c));
        else if (c === '!') {
          this._state = BEFORE_DECLARATION;
          this._sectionStart = this._index + 1;
        } else if (c === '?') {
          this._state = IN_PROCESSING_INSTRUCTION;
          this._sectionStart = this._index + 1;
        } else if (c === 's' || c === 'S') {
          this._state = BEFORE_SPECIAL;
          this._sectionStart = this._index;
        } else {
          this._state = IN_TAG_NAME;
          this._sectionStart = this._index;
        }
      }
    } else if (this._state === IN_TAG_NAME) {
      if (c === '/') {
        this._emitToken('≈≈');
        this.onselfclosingtag();
        this._state = AFTER_CLOSING_TAG_NAME;
      } else if (c === '>') {
        this._emitToken('onopentagname');
        this.onopentagend();
        this._state = TEXT;
        this._sectionStart = this._index + 1;
      } else if (whitespace(c)) {
        this._emitToken('onopentagname');
        this._state = BEFORE_ATTRIBUTE_NAME;
      }
    } else if (this._state === BEFORE_CLOSING_TAG_NAME) {
      if (whitespace(c));
      else if (c === '>') {
        this._state = TEXT;
      } else if (this._special > 0) {
        if (c === 's' || c === 'S') {
          this._state = BEFORE_SPECIAL_END;
        } else {
          this._state = TEXT;
          continue;
        }
      } else {
        this._state = IN_CLOSING_TAG_NAME;
        this._sectionStart = this._index;
      }
    } else if (this._state === IN_CLOSING_TAG_NAME) {
      if (c === '>') {
        this._emitToken('onclosetag');
        this._state = TEXT;
        this._sectionStart = this._index + 1;
        this._special = 0;
      } else if (whitespace(c)) {
        this._emitToken('onclosetag');
        this._state = AFTER_CLOSING_TAG_NAME;
        this._special = 0;
      }
    } else if (this._state === AFTER_CLOSING_TAG_NAME) {
      //skip everything until '>'
      if (c === '>') {
        this._state = TEXT;
        this._sectionStart = this._index + 1;
      }
    }

    /*
     *  attributes
     */
    else if (this._state === BEFORE_ATTRIBUTE_NAME) {
      if (c === '>') {
        this._state = TEXT;
        this.onopentagend();
        this._sectionStart = this._index + 1;
      } else if (c === '/') {
        this.onselfclosingtag();
        this._state = AFTER_CLOSING_TAG_NAME;
      } else if (!whitespace(c)) {
        this._state = IN_ATTRIBUTE_NAME;
        this._sectionStart = this._index;
      }
    } else if (this._state === IN_ATTRIBUTE_NAME) {
      if (c === '=') {
        this._emitIfToken('onattribname');
        this._state = BEFORE_ATTRIBUTE_VALUE;
      } else if (whitespace(c)) {
        this._emitIfToken('onattribname');
        this._state = AFTER_ATTRIBUTE_NAME;
      } else if (c === '/' || c === '>') {
        this._emitIfToken('onattribname');
        this._state = BEFORE_ATTRIBUTE_NAME;
        continue;
      }
    } else if (this._state === AFTER_ATTRIBUTE_NAME) {
      if (c === '=') {
        this._state = BEFORE_ATTRIBUTE_VALUE;
      } else if (c === '/' || c === '>') {
        this._state = BEFORE_ATTRIBUTE_NAME;
        continue;
      } else if (!whitespace(c)) {
        this._state = IN_ATTRIBUTE_NAME;
        this._sectionStart = this._index;
      }
    } else if (this._state === BEFORE_ATTRIBUTE_VALUE) {
      if (c === '\"') {
        this._state = IN_ATTRIBUTE_VALUE_DOUBLE_QUOTES;
        this._sectionStart = this._index + 1;
      } else if (c === '\'') {
        this._state = IN_ATTRIBUTE_VALUE_SINGLE_QUOTES;
        this._sectionStart = this._index + 1;
      } else if (!whitespace(c)) {
        this._state = IN_ATTRIBUTE_VALUE_NO_QUOTES;
        this._sectionStart = this._index;
      }
    } else if (this._state === IN_ATTRIBUTE_VALUE_DOUBLE_QUOTES) {
      if (c === '"') {
        this._emitToken('onattribvalue');
        this._state = BEFORE_ATTRIBUTE_NAME;
      }
    } else if (this._state === IN_ATTRIBUTE_VALUE_SINGLE_QUOTES) {
      if (c === '\'') {
        this._state = BEFORE_ATTRIBUTE_NAME;
        this._emitToken('onattribvalue');
      }
    } else if (this._state === IN_ATTRIBUTE_VALUE_NO_QUOTES) {
      if (c === '>') {
        this._emitToken('onattribvalue');
        this._state = TEXT;
        this.onopentagend();
        this._sectionStart = this._index + 1;
      } else if (whitespace(c)) {
        this._emitToken('onattribvalue');
        this._state = BEFORE_ATTRIBUTE_NAME;
      }
    }

    /*
     *  declarations
     */
    else if (this._state === BEFORE_DECLARATION) {
      if (c === '[') this._state = BEFORE_CDATA_1;
      else if (c === '-') this._state = BEFORE_COMMENT;
      else this._state = IN_DECLARATION;
    } else if (this._state === IN_DECLARATION) {
      if (c === '>') {
        this._emitToken('ondeclaration');
        this._state = TEXT;
        this._sectionStart = this._index + 1;
      }
    }

    /*
     *  processing instructions
     */
    else if (this._state === IN_PROCESSING_INSTRUCTION) {
      if (c === '>') {
        this._emitToken('onprocessinginstruction');
        this._state = TEXT;
        this._sectionStart = this._index + 1;
      }
    }

    /*
     *  comments
     */
    else if (this._state === BEFORE_COMMENT) {
      if (c === '-') {
        this._state = IN_COMMENT;
        this._sectionStart = this._index + 1;
      } else {
        this._state = IN_DECLARATION;
      }
    } else if (this._state === IN_COMMENT) {
      if (c === '-') this._state = AFTER_COMMENT_1;
    } else if (this._state === AFTER_COMMENT_1) {
      if (c === '-') this._state = AFTER_COMMENT_2;
      else this._state = IN_COMMENT;
    } else if (this._state === AFTER_COMMENT_2) {
      if (c === '>') {
        //remove 2 trailing chars
        this.oncomment(this._buffer.substring(this._sectionStart, this._index - 2));
        this._state = TEXT;
        this._sectionStart = this._index + 1;
      } else if (c !== '-') {
        this._state = IN_COMMENT;
      }
      // else: stay in AFTER_COMMENT_2 (`--->`)
    }

    /*
     *  cdata
     */
    else if (this._state === BEFORE_CDATA_1) {
      if (c === 'C') this._state = BEFORE_CDATA_2;
      else this._state = IN_DECLARATION;
    } else if (this._state === BEFORE_CDATA_2) {
      if (c === 'D') this._state = BEFORE_CDATA_3;
      else this._state = IN_DECLARATION;
    } else if (this._state === BEFORE_CDATA_3) {
      if (c === 'A') this._state = BEFORE_CDATA_4;
      else this._state = IN_DECLARATION;
    } else if (this._state === BEFORE_CDATA_4) {
      if (c === 'T') this._state = BEFORE_CDATA_5;
      else this._state = IN_DECLARATION;
    } else if (this._state === BEFORE_CDATA_5) {
      if (c === 'A') this._state = BEFORE_CDATA_6;
      else this._state = IN_DECLARATION;
    } else if (this._state === BEFORE_CDATA_6) {
      if (c === '[') {
        this._state = IN_CDATA;
        this._sectionStart = this._index + 1;
      } else {
        this._state = IN_DECLARATION;
      }
    } else if (this._state === IN_CDATA) {
      if (c === ']') this._state = AFTER_CDATA_1;
    } else if (this._state === AFTER_CDATA_1) {
      if (c === ']') this._state = AFTER_CDATA_2;
      else this._state = IN_CDATA;
    } else if (this._state === AFTER_CDATA_2) {
      if (c === '>') {
        //remove 2 trailing chars
        this.oncdata(this._buffer.substring(this._sectionStart, this._index - 2));
        this._state = TEXT;
        this._sectionStart = this._index + 1;
      } else if (c !== ']') {
        this._state = IN_CDATA;
      }
      //else: stay in AFTER_CDATA_2 (`]]]>`)
    }

    /*
     * special tags
     */
    else if (this._state === BEFORE_SPECIAL) {
      if (c === 'c' || c === 'C') {
        this._state = BEFORE_SCRIPT_1;
      } else if (c === 't' || c === 'T') {
        this._state = BEFORE_STYLE_1;
      } else {
        this._state = IN_TAG_NAME;
        continue; //consume the token again
      }
    } else if (this._state === BEFORE_SPECIAL_END) {
      if (this._special === 1 && (c === 'c' || c === 'C')) {
        this._state = AFTER_SCRIPT_1;
      } else if (this._special === 2 && (c === 't' || c === 'T')) {
        this._state = AFTER_STYLE_1;
      } else this._state = TEXT;
    }

    /*
     * script
     */
    else if (this._state === BEFORE_SCRIPT_1) {
      if (c === 'r' || c === 'R') {
        this._state = BEFORE_SCRIPT_2;
      } else {
        this._state = IN_TAG_NAME;
        continue; //consume the token again
      }
    } else if (this._state === BEFORE_SCRIPT_2) {
      if (c === 'i' || c === 'I') {
        this._state = BEFORE_SCRIPT_3;
      } else {
        this._state = IN_TAG_NAME;
        continue; //consume the token again
      }
    } else if (this._state === BEFORE_SCRIPT_3) {
      if (c === 'p' || c === 'P') {
        this._state = BEFORE_SCRIPT_4;
      } else {
        this._state = IN_TAG_NAME;
        continue; //consume the token again
      }
    } else if (this._state === BEFORE_SCRIPT_4) {
      if (c === 't' || c === 'T') {
        this._state = BEFORE_SCRIPT_5;
      } else {
        this._state = IN_TAG_NAME;
        continue; //consume the token again
      }
    } else if (this._state === BEFORE_SCRIPT_5) {
      if (c === '/' || c === '>' || whitespace(c)) {
        this._special = 1;
      }
      this._state = IN_TAG_NAME;
      continue; //consume the token again
    } else if (this._state === AFTER_SCRIPT_1) {
      if (c === 'r' || c === 'R') {
        this._state = AFTER_SCRIPT_2;
      } else this._state = TEXT;
    } else if (this._state === AFTER_SCRIPT_2) {
      if (c === 'i' || c === 'I') {
        this._state = AFTER_SCRIPT_3;
      } else this._state = TEXT;
    } else if (this._state === AFTER_SCRIPT_3) {
      if (c === 'p' || c === 'P') {
        this._state = AFTER_SCRIPT_4;
      } else this._state = TEXT;
    } else if (this._state === AFTER_SCRIPT_4) {
      if (c === 't' || c === 'T') {
        this._state = AFTER_SCRIPT_5;
      } else this._state = TEXT;
    } else if (this._state === AFTER_SCRIPT_5) {
      if (c === '>' || whitespace(c)) {
        this._state = IN_CLOSING_TAG_NAME;
        this._sectionStart = this._index - 6;
        continue; //reconsume the token
      } else this._state = TEXT;
    }

    /*
     * style
     */
    else if (this._state === BEFORE_STYLE_1) {
      if (c === 'y' || c === 'Y') {
        this._state = BEFORE_STYLE_2;
      } else {
        this._state = IN_TAG_NAME;
        continue; //consume the token again
      }
    } else if (this._state === BEFORE_STYLE_2) {
      if (c === 'l' || c === 'L') {
        this._state = BEFORE_STYLE_3;
      } else {
        this._state = IN_TAG_NAME;
        continue; //consume the token again
      }
    } else if (this._state === BEFORE_STYLE_3) {
      if (c === 'e' || c === 'E') {
        this._state = BEFORE_STYLE_4;
      } else {
        this._state = IN_TAG_NAME;
        continue; //consume the token again
      }
    } else if (this._state === BEFORE_STYLE_4) {
      if (c === '/' || c === '>' || whitespace(c)) {
        this._special = 2;
      }
      this._state = IN_TAG_NAME;
      continue; //consume the token again
    } else if (this._state === AFTER_STYLE_1) {
      if (c === 'y' || c === 'Y') {
        this._state = AFTER_STYLE_2;
      } else this._state = TEXT;
    } else if (this._state === AFTER_STYLE_2) {
      if (c === 'l' || c === 'L') {
        this._state = AFTER_STYLE_3;
      } else this._state = TEXT;
    } else if (this._state === AFTER_STYLE_3) {
      if (c === 'e' || c === 'E') {
        this._state = AFTER_STYLE_4;
      } else this._state = TEXT;
    } else if (this._state === AFTER_STYLE_4) {
      if (c === '>' || whitespace(c)) {
        this._state = IN_CLOSING_TAG_NAME;
        this._sectionStart = this._index - 5;
        continue; //reconsume the token
      } else this._state = TEXT;
    } else {
      this.onerror(Error('unknown state'), this._state);
    }

    this._index++;
  }

  //cleanup
  if (this._sectionStart === -1) {
    this._buffer = '';
    this._index = 0;
  } else {
    if (this._state === TEXT) {
      if (this._sectionStart !== this._index) {
        this.ontext(this._buffer.substr(this._sectionStart));
      }
      this._buffer = '';
      this._index = 0;
    } else if (this._sectionStart === this._index) {
      //the section just started
      this._buffer = '';
      this._index = 0;
    } else if (this._sectionStart > 0) {
      //remove everything unnecessary
      this._buffer = this._buffer.substr(this._sectionStart);
      this._index -= this._sectionStart;
    }

    this._sectionStart = 0;
  }
  this.push(chunk);
  done();
};

//Tokenizer event handlers
Hypar.prototype.ontext = function(data) {
  this._text = data;
  if (this._ontext) { this._ontext(data); }
};

Hypar.prototype.onopentagname = function(name) {

  this._tagname = name;

  this._onopentagname && this._onopentagname(name);
  this._attribs = {};
};

Hypar.prototype.onopentagend = function() {
  if (this._attribname !== '') this.onattribvalue('');

  var tag = {
    name: this._tagname,
    attr: this._attribs
  };
  this._stack.push(tag);
  this._onopentag && this._onopentag(tag);
  this._tagname = '';
  this._attribs = {}
};

Hypar.prototype.onclosetag = function(name) {
  this._onclosetag && this._onclosetag({name:name, attr: this._attribs, body: this._text});
  if (this._stack.length) {
    var pos = this._stack.lastIndexOf(name);
    var _stack = this._stack
      this.emit('tag', _stack.pop());

    if (pos !== -1) {
      if (this._onclosetag) {
        pos = this._stack.length - pos;
        while (pos--) {
          this._onclosetag(_stack.pop());
        }
      } else {
        //this._stack.splice(pos);
      }
    } else if (name === 'p') {
      this.onopentagname(name);
      this.onselfclosingtag();
    }
  } else if (name === 'br' || name === 'p') {
    this.onopentagname(name);
    this.onselfclosingtag();
  }
  this._attribs = {};
};

Hypar.prototype.onselfclosingtag = function() {
  var name = this._tagname;

  this.onopentagend();

  //self-closing tags will be on the top of the stack
  //(cheaper check than in onclosetag)
  if (this._stack[this._stack.length - 1] === name) {
    if (this._onclosetag) {
      this._onclosetag(name);
    }
    this._stack.pop();
  }
};

Hypar.prototype.onattribname = function(name) {
  if (this._attribname !== '') this.onattribvalue('');
  this._attribname = name;
};

Hypar.prototype.onattribvalue = function attribValue(value) {
  if (this._onattribute) this._onattribute(this._attribname, value);
  if (this._attribs) this._attribs[this._attribname] = value;
  this._attribname = '';
};

Hypar.prototype.ondeclaration = function(value) {
  if (this._onprocessinginstruction) {
    var name = value.split(/\s|\//, 1)[0];
    this._onprocessinginstruction('!' + name, '!' + value);
  }
};

Hypar.prototype.onprocessinginstruction = function(value) {
  if (this._onprocessinginstruction) {
    var name = value.split(/\s|\//, 1)[0];
    this._onprocessinginstruction('?' + name, '?' + value);
  }
};

Hypar.prototype.oncomment = function(value) {
  if (this._oncomment) this._oncomment(value);
  if (this._oncommentend) this._oncommentend();
};

Hypar.prototype.oncdata = function(value) {
  this.oncomment('[CDATA[' + value + ']]');
};

Hypar.prototype.onerror = function(err) {
  if (this._onerror) this._onerror(err);
};

function whitespace(c) {
  return c === ' ' || c === '\t' || c === '\r' || c === '\n';
}


Hypar.prototype._emitToken = function(name) {
  var data = this._buffer.substring(this._sectionStart, this._index);
  var shortName = name.replace('on', '');
  this.emit(shortName, data);
  this[name](data);
  this.emit('any', shortName, data);
  this._sectionStart = -1;
};

Hypar.prototype._emitIfToken = function(name) {
  if (this._index > this._sectionStart) {
    var data = this._buffer.substring(this._sectionStart, this._index);
    var shortName = name.replace('on', '');
    this.emit(shortName, data);
    this[name](data);
    this.emit('any', shortName, data);
    // this.push(this._buffer.substring(this._sectionStart, this._index));
  }
  this._sectionStart = -1;
};

// CONSTANTS

var TEXT = 1;
var BEFORE_TAG_NAME = 2; //after <
var IN_TAG_NAME = 3;
var BEFORE_CLOSING_TAG_NAME = 4;
var IN_CLOSING_TAG_NAME = 5;
var AFTER_CLOSING_TAG_NAME = 6;

//attributes
var BEFORE_ATTRIBUTE_NAME = 7;
var IN_ATTRIBUTE_NAME = 8;
var AFTER_ATTRIBUTE_NAME = 9;
var BEFORE_ATTRIBUTE_VALUE = 10;
var IN_ATTRIBUTE_VALUE_DOUBLE_QUOTES = 11; // '
var IN_ATTRIBUTE_VALUE_SINGLE_QUOTES = 12; // '
var IN_ATTRIBUTE_VALUE_NO_QUOTES = 13;

//declarations
var BEFORE_DECLARATION = 14; // !
var IN_DECLARATION = 15;

//processing instructions
var IN_PROCESSING_INSTRUCTION = 16; // ?

//comments
var BEFORE_COMMENT = 17;
var IN_COMMENT = 18;
var AFTER_COMMENT_1 = 19;
var AFTER_COMMENT_2 = 20;

//cdata
var BEFORE_CDATA_1 = 21; // [
var BEFORE_CDATA_2 = 22; // C
var BEFORE_CDATA_3 = 23; // D
var BEFORE_CDATA_4 = 24; // A
var BEFORE_CDATA_5 = 25; // T
var BEFORE_CDATA_6 = 26; // A
var IN_CDATA = 27; // [
var AFTER_CDATA_1 = 28; // ]
var AFTER_CDATA_2 = 29; // ]

//special tags
var BEFORE_SPECIAL = 30; //S
var BEFORE_SPECIAL_END = 31; //S

var BEFORE_SCRIPT_1 = 32; //C
var BEFORE_SCRIPT_2 = 33; //R
var BEFORE_SCRIPT_3 = 34; //I
var BEFORE_SCRIPT_4 = 35; //P
var BEFORE_SCRIPT_5 = 36; //T
var AFTER_SCRIPT_1 = 37; //C
var AFTER_SCRIPT_2 = 38; //R
var AFTER_SCRIPT_3 = 39; //I
var AFTER_SCRIPT_4 = 40; //P
var AFTER_SCRIPT_5 = 41; //T

var BEFORE_STYLE_1 = 42; //T
var BEFORE_STYLE_2 = 43; //Y
var BEFORE_STYLE_3 = 44; //L
var BEFORE_STYLE_4 = 45; //E
var AFTER_STYLE_1 = 46; //T
var AFTER_STYLE_2 = 47; //Y
var AFTER_STYLE_3 = 48; //L
var AFTER_STYLE_4 = 49; //E

var voidElements = {
  __proto__: null,
  area: true,
  base: true,
  basefont: true,
  br: true,
  col: true,
  command: true,
  embed: true,
  frame: true,
  hr: true,
  img: true,
  input: true,
  isindex: true,
  keygen: true,
  link: true,
  meta: true,
  param: true,
  source: true,
  track: true,
  wbr: true
};