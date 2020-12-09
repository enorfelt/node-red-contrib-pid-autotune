class deque extends Array {
  constructor(maxlen) {
    super();
    this.maxlen = maxlen;
  }

  append(item) {
    if (this.length === this.maxlen) {
      this.shift();
    }

    this.push(item);
  }

  clear() {
    this.splice(0, this.length);
  }
}
module.exports = deque;
