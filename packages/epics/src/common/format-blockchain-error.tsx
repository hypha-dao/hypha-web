const BLOCKCHAIN_ERROR =
  /useroperation|execution reverted|reverted during simulation|0x[0-9a-fA-F]{16,}/i;

/** A chain failure the member should see, rather than a generic retry line. */
export function isBlockchainErrorMessage(message: string) {
  return BLOCKCHAIN_ERROR.test(message);
}

function splitHexPayload(hex: string) {
  const body = hex.slice(2);
  if (body.length <= 64) return hex;
  const lines = [`0x${body.slice(0, 8)}`];
  for (let index = 8; index < body.length; index += 64) {
    lines.push(body.slice(index, index + 64));
  }
  return lines.join('\n');
}

/** Sentence on its own line, then the selector and each 32-byte word. */
export function formatBlockchainError(message: string) {
  const trimmed = message.replace(/\s+/g, ' ').trim();
  const withReasonBreak = trimmed.replace(/(\breason:)\s*/gi, '$1\n');
  return withReasonBreak.replace(/0x[0-9a-fA-F]{8,}/g, splitHexPayload);
}

function isHexLine(line: string) {
  return line.startsWith('0x') || /^[0-9a-fA-F]{64}$/.test(line);
}

export function BlockchainErrorText({
  message,
  className = 'text-foreground',
}: {
  message: string;
  className?: string;
}) {
  const lines = formatBlockchainError(message)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    return (
      <p className={`text-2 break-words ${className}`} role="alert">
        {message}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-left" role="alert">
      {lines.map((line, index) => (
        <p
          key={`${index}-${line.slice(0, 16)}`}
          className={
            isHexLine(line)
              ? `font-mono text-1 leading-relaxed break-all ${className}`
              : `text-2 leading-relaxed ${className}`
          }
        >
          {line}
        </p>
      ))}
    </div>
  );
}
