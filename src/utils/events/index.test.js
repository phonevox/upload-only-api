import { describe, it, expect, vi, beforeEach } from "vitest";

const { KafkaMock, connect, send } = vi.hoisted(() => ({
  KafkaMock: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  send: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("kafkajs", () => ({
  Kafka: KafkaMock.mockImplementation(function Kafka() {
    return { producer: () => ({ connect, send }) };
  }),
}));

import { publishEvent } from "./index.js";

beforeEach(() => {
  KafkaMock.mockClear();
  connect.mockClear();
  send.mockClear();
});

describe("publishEvent", () => {
  it("does nothing and never touches kafka when KAFKA_ENABLED is not 'true'", async () => {
    delete process.env.KAFKA_ENABLED;
    await publishEvent("user.registered", { username: "adrian" });
    expect(KafkaMock).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("connects and sends the payload as JSON when enabled", async () => {
    process.env.KAFKA_ENABLED = "true";
    process.env.KAFKA_BROKERS = "localhost:9092";

    await publishEvent("user.login", { username: "adrian" });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    const call = send.mock.calls[0][0];
    expect(call.topic).toBe("user.login");
    const message = JSON.parse(call.messages[0].value);
    expect(message.username).toBe("adrian");
    expect(message.timestamp).toBeDefined();

    delete process.env.KAFKA_ENABLED;
  });

  it("swallows kafka errors instead of throwing", async () => {
    process.env.KAFKA_ENABLED = "true";
    send.mockRejectedValueOnce(new Error("broker unreachable"));

    await expect(publishEvent("upload.started", {})).resolves.toBeUndefined();

    delete process.env.KAFKA_ENABLED;
  });
});
