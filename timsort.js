'use strict';

/*
 * Binary insertion sort
 *
 * @param {ListSlice} s -- slice to be sorted
 * @param {Number} sorted -- number of elements that are already sorted
 */
function binarysort(s, sorted, cmp) {
  sorted = sorted || 1;
  var sList = s.list,
      sBase = s.base,
      start = sBase + sorted,
      end = sBase + s.length;
  for (; start < end; start++) {
    var l = sBase,
        r = start,
        pivot = sList[r];
    while (l < r) {
      var p = l + (r - l >> 1);
      if (cmp(pivot, sList[p])) {
        r = p;
      } else {
        l = p + 1;
      }
    }
    // swap elements over to make room for pivot
    for (var i = start; i !== l; i--) {
      sList[i] = sList[i - 1];
    }
    sList[l] = pivot;
  }
}

function TimSort(list, lt) {
  this.list = list;
  this.lt = this.lt || lt;
  if (lt) {
    this.le = null;
  }
}

TimSort.prototype.MIN_GALLOP = 7;
TimSort.prototype.lt = function (a, b) { return a < b; };
TimSort.prototype.le = function (a, b) { return a <= b; };

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
      binarysort(run, sorted, this.lt);
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
  var pending = this.pending;
  var i = pending.length + fromEnd;
  var a = pending[i];
  var b = pending[i + 1];

  pending[i] = new ListSlice(this.list, a.base, a.length + b.length);
  pending.splice(i + 1, 1);

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
  if (s.length < 2) {
    return new ListSlice(s.list, s.base, s.length, false);
  }

  var lt = this.lt,
      runLen = 2,
      descending = lt(s.get(s.base + 1), s.first()),
      i = s.base + 2,
      end = s.base + s.length;
  if (descending) {
    for (; i < end && lt(s.get(i), s.get(i - 1)); i++) {
      runLen++;
    }
  } else {
    for (; i < end && !lt(s.get(i), s.get(i - 1)); i++) {
      runLen++;
    }
  }
  return new ListSlice(s.list, s.base, runLen, descending);
};

TimSort.prototype.gallop = function (key, s, hint, rightmost) {
  var lower, lt = this.lt, le = this.le;
  if (rightmost) {
    lower = le || function (a, b) { return !lt(b, a); };
  } else {
    lower = lt;
  }

  var p = s.base + hint;
  var sList = s.list;
  var lastOffset = 0;
  var maxOffset, offset = 1;
  if (lower(sList[p], key)) {
    maxOffset = s.length - hint;
    for (; offset < maxOffset && lower(sList[p + offset], key); offset++) {
      lastOffset = offset;
    }
    if (offset > maxOffset) {
      offset = maxOffset;
    }
    lastOffset += hint;
    offset += hint;
  } else {
    maxOffset = hint + 1;
    for (; offset < maxOffset && !lower(sList[p - offset], key); offset++) {
      lastOffset = offset;
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
    if (lower(sList[s.base + m], key)) {
      lastOffset = m + 1;
    } else {
      offset = m;
    }
  }
  return offset;
};

TimSort.prototype.mergeLo = function (a, b) {
  var p,
      dest = a.base,
      list = this.list,
      lt = this.lt;
  a = a.copy();
  var aList = a.list, bList = b.list;
  list[dest] = b.popleft();
  dest += 1;
  if (a.length === 1 || b.length === 0) {
    return this.finishMergeLo(a, b, dest);
  }

  while (true) {
    var aCount = 0;
    var bCount = 0;

    var minGallop = this.minGallop;
    var nextA = a.first(), nextB = b.first();
    while (bCount !== minGallop && aCount !== minGallop) {
      // merge while keeping track of which side won
      if (lt(nextB, nextA)) {
        list[dest++] = nextB;    // b.popleft
        b.base++, b.length--;
        if (b.length === 0) {
          return this.finishMergeLo(a, b, dest);
        }
        bCount++;
        aCount = 0;
        nextB = b.first();
      } else {
        list[dest++] = nextA;    // a.popleft
        a.base++, a.length--;
        if (a.length === 1) {
          return this.finishMergeLo(a, b, dest);
        }
        aCount++;
        bCount = 0;
        nextA = a.first();
      }
    }

    this.minGallop++;
    while (true) {
      this.minGallop -= this.minGallop > 1;
      aCount = this.gallop(b.first(), a, 0, true);

      for (p = a.base; p < a.base + aCount; p++) {
        list[dest] = aList[p];
        dest++;
      }
      a.advance(aCount);

      if (a.length < 2) { return this.finishMergeLo(a, b, dest); }

      list[dest] = b.popleft();
      dest++;
      if (b.length === 0) { return this.finishMergeLo(a, b, dest); }

      bCount = this.gallop(a.first(), b, 0, false);
      for (p = b.base; p < b.base + bCount; p++) {
        list[dest] = bList[p];
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
  var lt = this.lt;
  var dest = b.base + b.length;
  b = b.copy();
  var aList = a.list, bList = b.list;

  dest -= 1;
  var list = this.list;
  list[dest] = a.popright();
  if (a.length === 0 || b.length === 1) {
    return this.finishMergeHi(a, b, dest);
  }

  while (true) {
    var aCount = 0;
    var bCount = 0;

    var minGallop = this.minGallop;
    var nextA = a.last();
    var nextB = b.last();
    while (aCount !== minGallop && bCount !== minGallop) {

      if (lt(nextB, nextA)) {
        list[--dest] = nextA;
        if (--a.length === 0) {
          return this.finishMergeHi(a, b, dest);
        }
        aCount += 1;
        bCount = 0;
        nextA = a.last();
      } else {
        list[--dest] = nextB;
        if (--b.length === 1) {
          return this.finishMergeHi(a, b, dest);
        }
        bCount += 1;
        aCount = 0;
        nextB = b.last();
      }
    }

    this.minGallop++;
    while (true) {
      this.minGallop -= this.minGallop > 1;

      var k = this.gallop(b.last(), a, a.length - 1, true);
      aCount = a.length - k;

      for (var p = a.base + a.length - 1; p !== a.base + k - 1; p--) {
        dest--;
        list[dest] = aList[p];
      }

      a.length -= aCount;
      if (a.length === 0) { return this.finishMergeHi(a, b, dest); }

      dest--;
      list[dest] = b.popright();
      if (b.length === 1) { return this.finishMergeHi(a, b, dest); }

      k = this.gallop(a.last(), b, b.length - 1, false);
      bCount = b.length - k;

      for (p = b.base + b.length - 1; p !== b.base + k - 1; p--) {
        dest--;
        list[dest] = bList[p];
      }
      b.length -= bCount;

      if (b.length < 2) { return this.finishMergeHi(a, b, dest); }

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
  var result = this.list[this.base];
  this.base++;
  this.length--;
  return result;
};

ListSlice.prototype.popright = function () {
  this.length--;
  return this.list[this.base + this.length];
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
