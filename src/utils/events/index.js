import { Kafka } from "kafkajs";
import { logging } from "../logging/index.js";

const logger = logging.getLogger(process.env.LOGGING_BASE_NAME + ".events");

const isEnabled = () => process.env.KAFKA_ENABLED === "true";

let producerPromise = null;

function getProducer() {
    if (!producerPromise) {
        const kafka = new Kafka({
            clientId: process.env.KAFKA_CLIENT_ID || "upload-only-api",
            brokers: (process.env.KAFKA_BROKERS || "").split(",").map(b => b.trim()).filter(Boolean),
        });
        const producer = kafka.producer();
        producerPromise = producer.connect().then(() => producer);
    }
    return producerPromise;
}

// fire-and-forget: never throws, never blocks the caller on Kafka being slow/down/disabled
export async function publishEvent(topic, payload) {
    if (!isEnabled()) {
        logger.debug(`Kafka disabled, skipping event '${topic}'`);
        return;
    }

    try {
        const producer = await getProducer();
        await producer.send({
            topic,
            messages: [{ value: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }) }],
        });
        logger.trace(`Published event '${topic}'`);
    } catch (err) {
        producerPromise = null; // drop broken connection so the next call reconnects
        logger.error(`Failed to publish event '${topic}': ${err.message}`);
    }
}
