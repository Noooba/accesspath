type Entry<T> = { value: T; expiresAt: number; bytes: number };
/** Short-lived server memory only: no analytics, disk cache, or persistent location history. */
export class BoundedTtlCache<T> {
  private entries = new Map<string, Entry<T>>();
  private bytes = 0;
  constructor(private maximumEntries: number, private maximumBytes: number, private ttlMs: number) {}
  get(key: string, now = Date.now()): T | undefined {
    const item = this.entries.get(key);
    if (!item) return;
    if (item.expiresAt <= now) { this.entries.delete(key); this.bytes -= item.bytes; return; }
    return structuredClone(item.value);
  }
  set(key: string, value: T, now = Date.now()) {
    const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
    if (bytes > this.maximumBytes) return;
    const previous = this.entries.get(key);
    if (previous) { this.entries.delete(key); this.bytes -= previous.bytes; }
    for (const [itemKey, item] of this.entries) {
      if (item.expiresAt <= now) { this.entries.delete(itemKey); this.bytes -= item.bytes; }
    }
    while (this.entries.size >= this.maximumEntries || this.bytes + bytes > this.maximumBytes) {
      const oldest = this.entries.entries().next().value;
      if (!oldest) break;
      this.entries.delete(oldest[0]); this.bytes -= oldest[1].bytes;
    }
    this.entries.set(key, { value: structuredClone(value), expiresAt: now + this.ttlMs, bytes }); this.bytes += bytes;
  }
  clear() { this.entries.clear(); this.bytes = 0; }
}
