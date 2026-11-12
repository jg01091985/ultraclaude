// Secret Redaction Filter
const secretPatterns = [
    /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
    /AWS_SECRET_ACCESS_KEY\s*=\s*[a-zA-Z0-9\/+=]{40}/g,
    /ghp_[a-zA-Z0-9]{36}/g,
    /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/g,
    /sk-[a-zA-Z0-9]{20,}/g,
    /npm_[a-zA-Z0-9]{36}/g,
    /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/g,
    /DATABASE_URL\s*=\s*[^\s]+/g,
    /PASSWORD\s*=\s*[^\s]+/g,
    /TOKEN\s*=\s*[^\s]+/g
];
export function redactSecrets(text) {
    let redacted = text;
    for (const pattern of secretPatterns) {
        redacted = redacted.replace(pattern, "[REDACTED_BY_LOCAL_BRIDGE]");
    }
    return redacted;
}
const idempotencyStore = new Map();
export function checkIdempotency(requestId, prompt) {
    const existing = idempotencyStore.get(requestId);
    if (existing && existing.state === "COMPLETED") {
        return true; // Already processed
    }
    idempotencyStore.set(requestId, {
        requestId,
        state: "SUBMITTING",
        promptHash: prompt.length.toString(),
        timestamp: Date.now()
    });
    return false;
}
export function completeIdempotency(requestId) {
    const existing = idempotencyStore.get(requestId);
    if (existing) {
        existing.state = "COMPLETED";
    }
}
// Circuit Breaker
class CircuitBreaker {
    failures = 0;
    lastFailureTime = 0;
    state = "CLOSED";
    threshold = 3;
    cooldownMs = 60000;
    canExecute() {
        if (this.state === "OPEN") {
            if (Date.now() - this.lastFailureTime > this.cooldownMs) {
                this.state = "HALF_OPEN";
                return true;
            }
            return false;
        }
        return true;
    }
    recordSuccess() {
        this.failures = 0;
        this.state = "CLOSED";
    }
    recordFailure() {
        this.failures++;
        this.lastFailureTime = Date.now();
        if (this.failures >= this.threshold) {
            this.state = "OPEN";
            console.warn(`Circuit Breaker tripped to OPEN after ${this.failures} failures.`);
        }
    }
}
export const browserCircuitBreaker = new CircuitBreaker();
export function createCheckpoint(turnCount, goal, filesRead, filesChanged) {
    if (turnCount >= 20) {
        return {
            goal,
            filesRead: Array.from(new Set(filesRead)),
            filesChanged: Array.from(new Set(filesChanged)),
            commands: [],
            nextAction: "Continue agent task with compacted state."
        };
    }
    return null;
}
