// jshint node: true
'use strict';

var lt = function (a, b) { return a < b; };
var le = function (a, b) { return !lt(b, a); };

/*
 * @param {ListSlice} s -- slice to be sorted
 * @param {Number} sorted -- number of elements that are already sorted
 */
function binarysort(s, sorted) {
  var p;
  sorted = sorted || 1;
  var sList = s.list;
  var start = s.base + sorted,
      end = s.base + s.length;
  while (start < end) {
    var l = s.base;
    var r = start;
    var pivot = sList[r];
    while (l < r) {
      p = l + (r - l >> 1);
      if (lt(pivot, sList[p])) {
        r = p;
      } else {
        l = p + 1;
      }
    }
    for (p = start; p !== l; p--) {
      sList[p] = sList[p - 1];
    }
    sList[l] = pivot;
    start++;
  }
}

function TimSort(list) {
  this.list = list;
}

TimSort.prototype.MIN_GALLOP = 7;

TimSort.prototype.sort = function () {
  var remaining = new ListSlice(this.list, 0, this.list.length);
  if (remaining.length < 2) { return; }

  this.minGallop = this.MIN_GALLOP;
  this.pending = [];
  var minrun = this.minrun(remaining.length);

  while (remaining.length > 0) {
    var run = this.countRun(remaining);
    if (run.descending) {
      run.reverse();
    }
    if (run.length < minrun) {
      var sorted = run.length;
      run.length = Math.min(minrun, remaining.length);
      binarysort(run, sorted);
    }
    remaining.advance(run.length);
    this.pending.push(run);
    this.mergeCollapse();
  }
  this.mergeForceCollapse();
};

TimSort.prototype.mergeCollapse = function () {
  var p = this.pending;
  while (p.length > 1) {
    var plen = p.length;
    var lastLen = p[plen - 1].length;
    var secondLastLen = p[plen - 2].length;
    if (plen >= 3 &&
        p[plen - 3].length <= (secondLastLen + lastLen)) {
      if (p[plen - 3].length < lastLen) {
        this.mergeAt(-3);
      } else {
        this.mergeAt(-2);
      }
    } else if (secondLastLen <= lastLen) {
      this.mergeAt(-2);
    } else {
      break;
    }
  }
};

TimSort.prototype.mergeForceCollapse = function () {
  var p = this.pending;
  while (p.length > 1) {
    var plen = p.length;
    if (plen >= 3 && p[plen-3].length < p[plen-1].length) {
      this.mergeAt(-3);
    } else {
      this.mergeAt(-2);
    }
  }
};

TimSort.prototype.mergeAt = function (fromEnd) {
  var i = this.pending.length + fromEnd;
  var a = this.pending[i];
  var b = this.pending[i + 1];

  this.pending[i] = new ListSlice(this.list, a.base, a.length + b.length);
  this.pending.splice(i + 1, 1);

  var k = this.gallop(b.first(), a, 0, true);
  a.advance(k);
  if (a.length === 0) {
    return;
  }

  b.length = this.gallop(a.last(), b, b.length-1, false);
  if (b.length === 0) {
    return;
  }

  if (a.length <= b.length) {
    this.mergeLo(a, b);
  } else {
    this.mergeHi(a, b);
  }

};

TimSort.prototype.countRun = function (s) {
  var descending, runLen, p;
  if (s.length < 2) {
    runLen = s.length;
    descending = false;
  } else {
    runLen = 2;
    descending = lt(s.get(s.base + 1), s.first());
    var start = s.base + 2, sliceEnd = s.base + s.length;
    if (descending) {
      for (p = start; p < sliceEnd; p++) {
        if (!lt(s.get(p), s.get(p - 1))) {
          break;
        }
        runLen++;
      }
    } else {
      for (p = start; p < sliceEnd; p++) {
        if (lt(s.get(p), s.get(p - 1))) {
          break;
        }
        runLen++;
      }
    }
  }
  return new ListSlice(s.list, s.base, runLen, descending);
};

TimSort.prototype.gallop = function (key, s, hint, rightmost) {
  var lower;
  if (rightmost) {
    lower = le;
  } else {
    lower = lt;
  }

  var p = s.base + hint;
  var lastOffset = 0;    // last offset
  var maxOffset, offset = 1;
  if (lower(s.get(p), key)) {
    maxOffset = s.length - hint;
    while (offset < maxOffset) {
      if (lower(s.get(p + offset), key)) {
        lastOffset = offset;
        offset++;
      } else {
        break;
      }
    }

    if (offset > maxOffset) {
      offset = maxOffset;
    }
    lastOffset += hint;
    offset += hint;
  } else {
    maxOffset = hint + 1;
    while (offset < maxOffset) {
      if (lower(s.get(p - offset), key)) {
        break;
      } else {
        lastOffset = offset;
        offset++;
      }
    }
    if (offset > maxOffset) {
      offset = maxOffset;
    }
    var oldLastOffset = lastOffset;
    lastOffset = hint - offset;
    offset = hint - oldLastOffset;
  }


  lastOffset += 1;
  while (lastOffset < offset) {
    var m = lastOffset + (offset - lastOffset >> 1);
    if (lower(s.get(s.base + m), key)) {
      lastOffset = m + 1;
    } else {
      offset = m;
    }
  }
  return offset;
};

TimSort.prototype.mergeLo = function (a, b) {
  var p;
  var dest = a.base;
  var list = this.list;
  a = a.copy();
  list[dest] = b.popleft();
  dest += 1;
  if (a.length === 1 || b.length === 0) {
    return;
  }

  while (true) {
    var aCount = 0;
    var bCount = 0;

    var minGallop = this.minGallop;
    while (bCount < minGallop && aCount < minGallop) {
      // merge while keeping track of which side won
      if (lt(b.first(), a.first())) {
        list[dest++] = b.popleft();
        if (b.length === 0) {
          return this.finishMergeLo(a, b, dest);
        }
        bCount++;
        aCount = 0;
      } else {
        list[dest++] = a.popleft();
        if (a.length === 1) {
          return this.finishMergeLo(a, b, dest);
        }
        aCount++;
        bCount = 0;
      }
    }

    this.minGallop++;
    while (true) {
      this.minGallop -= this.minGallop > 1;
      aCount = this.gallop(b.first(), a, 0, true);

      for (p = a.base; p < a.base + aCount; p++) {
        list[dest] = a.get(p);
        dest++;
      }
      a.advance(aCount);

      if (a.length <= 1) { return this.finishMergeLo(a, b, dest); }

      list[dest] = b.popleft();
      dest++;
      if (b.length === 0) { return this.finishMergeLo(a, b, dest); }

      bCount = this.gallop(a.first(), b, 0, false);
      for (p = b.base; p < b.base + bCount; p++) {
        list[dest] = b.get(p);
        dest++;
      }
      b.advance(bCount);
      if (b.length === 0) { return this.finishMergeLo(a, b, dest); }

      list[dest] = a.popleft();
      dest++;
      if (a.length === 1) { return this.finishMergeLo(a, b, dest); }

      if (aCount < this.MIN_GALLOP && bCount < this.MIN_GALLOP) {
        break;
      }
    }

    this.minGallop++;
  }
};

TimSort.prototype.finishMergeLo = function (a, b, dest) {
  var list = this.list;
  for (var p = b.base; p < b.base + b.length; p++) {
    list[dest] = b.get(p);
    dest++;
  }
  for (p = a.base; p < a.base + a.length; p++) {
    list[dest] = a.get(p);
    dest++;
  }
};

TimSort.prototype.mergeHi = function (a, b) {

  var p, nextA, nextB;
  var dest = b.base + b.length;
  b = b.copy();

  dest -= 1;
  var list = this.list;
  list[dest] = a.popright();
  if (a.length === 0 || b.length === 1) {
    return;
  }

  while (true) {
    var aCount = 0;
    var bCount = 0;

    var minGallop = this.minGallop;
    while (aCount < minGallop && bCount < minGallop) {
      nextA = a.last();
      nextB = b.last();
      if (lt(nextB, nextA)) {
        list[--dest] = nextA;
        if (--a.length === 0) {
          return this.finishMergeHi(a, b, dest);
        }
        aCount += 1;
        bCount = 0;
      } else {
        list[--dest] = nextB;
        if (--b.length === 1) {
          return this.finishMergeHi(a, b, dest);
        }
        bCount += 1;
        aCount = 0;
      }
    }

    this.minGallop++;
    while (true) {
      this.minGallop -= this.minGallop > 1;

      nextB = b.last();
      var k = this.gallop(nextB, a, a.length - 1, true);
      aCount = a.length - k;

      for (p = a.base + a.length - 1; p !== a.base + k - 1; p--) {
        dest--;
        list[dest] = a.get(p);
      }

      a.length -= aCount;
      if (a.length === 0) { return this.finishMergeHi(a, b, dest); }

      dest--;
      list[dest] = b.popright();
      if (b.length === 1) { return this.finishMergeHi(a, b, dest); }

      nextA = a.last();
      k = this.gallop(nextA, b, b.length - 1, false);
      bCount = b.length - k;

      for (p = b.base + b.length - 1; p !== b.base + k - 1; p--) {
        dest--;
        list[dest] = b.get(p);
      }
      b.length -= bCount;

      if (b.length <= 1) { return this.finishMergeHi(a, b, dest); }

      dest--;
      list[dest] = a.popright();
      if (a.length === 0) {
        return this.finishMergeHi(a, b, dest);
      }

      if (aCount < this.MIN_GALLOP && bCount < this.MIN_GALLOP) {
        break;
      }
    }
    this.minGallop++;
  }
};

TimSort.prototype.finishMergeHi = function (a, b, dest) {
  var list = this.list;
  for (var p = a.base + a.length - 1; p !== a.base - 1; p--) {
    dest--;
    list[dest] = a.get(p);
  }
  for (p = b.base + b.length - 1; p !== b.base - 1; p--) {
    dest--;
    list[dest] = b.get(p);
  }
};


TimSort.prototype.minrun = function (n) {
  var r = 0;    // becomes 1 if any 1 bits are shifted off
  while (n >= 64) {
      r |= n & 1;
      n >>= 1;
  }
  return n + r;
};



function ListSlice(list, base, length, descending) {
  this.list = list;
  this.base = base;
  this.length = length;
  this.descending = descending;
}

ListSlice.prototype.copy = function () {
  var start = this.base;
  var stop = this.base + this.length;
  return new ListSlice(this.list.slice(start, stop), 0, this.length);
};

ListSlice.prototype.advance = function (n) {
  this.base += n;
  this.length -= n;
};

ListSlice.prototype.get = function (index) {
  return this.list[index];
};

ListSlice.prototype.set = function (index, value) {
  this.list[index] = value;
};

ListSlice.prototype.popleft = function () {
  var result = this.get(this.base);
  this.base += 1;
  this.length -= 1;
  return result;
};

ListSlice.prototype.popright = function () {
  this.length -= 1;
  return this.get(this.base + this.length);
};

ListSlice.prototype.reverse = function () {
  var list = this.list;
  var lo = this.base;
  var hi = lo + this.length - 1;
  while (lo < hi) {
    var listHi = list[hi];
    var listLo = list[lo];
    list[lo] = listHi;
    list[hi] = listLo;
    lo++;
    hi--;
  }
};

ListSlice.prototype.last = function () {
  return this.list[this.base + this.length - 1];
};

ListSlice.prototype.first = function () {
  return this.list[this.base];
};

module.exports = TimSort;