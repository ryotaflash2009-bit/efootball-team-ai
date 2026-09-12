import { describe, it, expect } from "vitest";
import { isLocalDevHostname } from "./local-dev";

describe("isLocalDevHostname", () => {
  it("localhostはローカル開発ホストと判定する", () => {
    expect(isLocalDevHostname("localhost")).toBe(true);
  });

  it("127.0.0.1はローカル開発ホストと判定する", () => {
    expect(isLocalDevHostname("127.0.0.1")).toBe(true);
  });

  it("IPv6ループバック(::1)はローカル開発ホストと判定する", () => {
    expect(isLocalDevHostname("::1")).toBe(true);
  });

  it("大文字小文字を区別しない", () => {
    expect(isLocalDevHostname("LOCALHOST")).toBe(true);
  });

  it("実際の公開ドメインはローカル開発ホストと判定しない", () => {
    expect(isLocalDevHostname("example.com")).toBe(false);
    expect(isLocalDevHostname("efootball-team-ai.vercel.app")).toBe(false);
  });

  it("LAN上のプライベートIPはローカル開発ホストと判定しない(別端末アクセスを想定するため)", () => {
    expect(isLocalDevHostname("192.168.0.8")).toBe(false);
  });
});
