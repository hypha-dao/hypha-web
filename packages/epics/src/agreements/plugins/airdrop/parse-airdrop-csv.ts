import { ETH_ADDRESS_REGEX } from '../components/common/recipient-field.validation';
import { AirdropRecipient } from './airdrop.validation';

export type AirdropCsvLineErrorType =
  | 'columns'
  | 'invalidAddress'
  | 'invalidAmount';

export interface AirdropCsvLineError {
  /** 1-based line number in the original file. */
  line: number;
  type: AirdropCsvLineErrorType;
}

export interface ParseAirdropCsvResult {
  recipients: AirdropRecipient[];
  errors: AirdropCsvLineError[];
}

const AMOUNT_REGEX = /^\d+(\.\d+)?$/;

/** Pick the column separator from the first non-empty line: tab and semicolon
 * take precedence so European Excel exports (`;` + decimal commas) work. */
const detectSeparator = (line: string): string => {
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  return ',';
};

/**
 * Parses an airdrop recipient list in CSV form.
 *
 * Expected format — one recipient per line, two columns:
 *
 *   recipient,amount            <- optional header line
 *   0x1111…1111,100
 *   0x2222…2222,42.5
 *
 * Rules:
 * - Separator may be a comma, semicolon, or tab (auto-detected).
 * - A header line is skipped when its first cell does not start with `0x`.
 * - Amounts use a dot decimal; a comma decimal is accepted when the column
 *   separator is not a comma (e.g. `0x…;42,5`).
 * - Empty lines are ignored. Trailing empty cells (Excel artifacts) are
 *   ignored, but extra data columns are reported as errors.
 */
export function parseAirdropCsv(text: string): ParseAirdropCsvResult {
  const recipients: AirdropRecipient[] = [];
  const errors: AirdropCsvLineError[] = [];

  const lines = text.split(/\r?\n/);
  const firstContentIndex = lines.findIndex((line) => line.trim() !== '');
  const firstContentLine = lines[firstContentIndex];
  if (firstContentIndex === -1 || firstContentLine === undefined) {
    return { recipients, errors };
  }

  const separator = detectSeparator(firstContentLine);
  const firstCell = firstContentLine.split(separator)[0]?.trim().toLowerCase();
  const hasHeader = !firstCell?.startsWith('0x');

  lines.forEach((rawLine, index) => {
    if (rawLine.trim() === '') return;
    if (hasHeader && index === firstContentIndex) return;

    const lineNumber = index + 1;
    const cells = rawLine.split(separator).map((cell) => cell.trim());
    // Drop trailing empty cells (e.g. "0x…,100,," from spreadsheet exports).
    while (cells.length > 0 && cells[cells.length - 1] === '') {
      cells.pop();
    }

    const [recipient, rawAmount] = cells;
    if (
      cells.length !== 2 ||
      recipient === undefined ||
      rawAmount === undefined
    ) {
      errors.push({ line: lineNumber, type: 'columns' });
      return;
    }

    if (!ETH_ADDRESS_REGEX.test(recipient)) {
      errors.push({ line: lineNumber, type: 'invalidAddress' });
      return;
    }

    // Allow a decimal comma only when it can't be confused with the separator.
    const amount = separator === ',' ? rawAmount : rawAmount.replace(',', '.');

    if (!AMOUNT_REGEX.test(amount) || parseFloat(amount) <= 0) {
      errors.push({ line: lineNumber, type: 'invalidAmount' });
      return;
    }

    recipients.push({ recipient, amount });
  });

  return { recipients, errors };
}
