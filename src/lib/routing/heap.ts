/** Small binary min-heap; comparator ties are deterministic in the router. */
export class MinHeap<T> {
  private values: T[] = [];
  constructor(private readonly compare: (a: T, b: T) => number) {}
  get size(): number { return this.values.length; }
  push(value: T): void {
    this.values.push(value);
    let current = this.values.length - 1;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.compare(this.values[parent], value) <= 0) break;
      this.values[current] = this.values[parent];
      current = parent;
    }
    this.values[current] = value;
  }
  pop(): T | undefined {
    if (this.values.length === 0) return undefined;
    const result = this.values[0];
    const tail = this.values.pop()!;
    if (this.values.length === 0) return result;
    let current = 0;
    while (true) {
      const left = current * 2 + 1;
      if (left >= this.values.length) break;
      const right = left + 1;
      const child = right < this.values.length && this.compare(this.values[right], this.values[left]) < 0 ? right : left;
      if (this.compare(tail, this.values[child]) <= 0) break;
      this.values[current] = this.values[child];
      current = child;
    }
    this.values[current] = tail;
    return result;
  }
}
