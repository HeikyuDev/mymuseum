import { describe, expect, it } from "vitest";
import { Limiter } from "./limiter";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Limiter", () => {
  it("never runs more than the limit, even when several waiters are woken by one release", async () => {
    const limiter = new Limiter();
    const started: string[] = [];
    const run = async (name: string, priority = 2) => {
      await limiter.acquire(1, priority);
      started.push(name);
    };
    void run("a");
    void run("b");
    void run("c");
    void run("d");
    await tick();
    expect(started).toEqual(["a"]);
    limiter.release(1);
    await tick();
    expect(started).toEqual(["a", "b"]);
    expect(limiter.running).toBe(1);
    limiter.release(1);
    await tick();
    expect(started).toEqual(["a", "b", "c"]);
  });

  it("serves the lowest priority number first", async () => {
    const limiter = new Limiter();
    const order: string[] = [];
    await limiter.acquire(1, 2);
    void limiter.acquire(1, 2).then(() => order.push("far"));
    void limiter.acquire(1, 0).then(() => order.push("front"));
    limiter.release(1);
    await tick();
    expect(order).toEqual(["front"]);
  });

  it("honours a raised limit", async () => {
    const limiter = new Limiter();
    await limiter.acquire(2, 2);
    await limiter.acquire(2, 2);
    expect(limiter.running).toBe(2);
  });
});
