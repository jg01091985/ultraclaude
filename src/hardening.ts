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

export function redactSecrets(text: string): string {
  let redacted = text;
  for (const pattern of secretPatterns) {
    redacted = redacted.replace(pattern, "[REDACTED_BY_LOCAL_BRIDGE]");
  }
  return redacted;
}

// Idempotency Tracker
interface IdempotencyRecord {
  requestId: string;
  state: "SUBMITTING" | "SUBMITTED" | "COMPLETED";
  promptHash: string;
  timestamp: number;
}

const idempotencyStore = new Map<string, IdempotencyRecord>();

export function checkIdempotency(requestId: string, prompt: string): boolean {
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

export function completeIdempotency(requestId: string) {
  const existing = idempotencyStore.get(requestId);
  if (existing) {
    existing.state = "COMPLETED";
  }
}

// Circuit Breaker
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private threshold = 3;
  private cooldownMs = 60000;

  canExecute(): boolean {
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

// Context Compaction Checkpoint
export interface Checkpoint {
  goal: string;
  filesRead: string[];
  filesChanged: string[];
  commands: { command: string; result: string }[];
  nextAction: string;
}

export function createCheckpoint(turnCount: number, goal: string, filesRead: string[], filesChanged: string[]): Checkpoint | null {
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
