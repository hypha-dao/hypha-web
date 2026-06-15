import { describe, expect, it } from 'vitest';

import {
  buildDriveDownloadRequest,
  ensureFileExtension,
} from '../google-drive-picker';

describe('google-drive-picker helpers', () => {
  it('builds export URL for Google Docs', () => {
    expect(
      buildDriveDownloadRequest(
        'doc-1',
        'application/vnd.google-apps.document',
      ),
    ).toEqual({
      url: 'https://www.googleapis.com/drive/v3/files/doc-1/export?mimeType=application%2Fpdf',
      exportMimeType: 'application/pdf',
    });
  });

  it('builds media URL for binary Drive files', () => {
    expect(buildDriveDownloadRequest('file-1', 'application/pdf')).toEqual({
      url: 'https://www.googleapis.com/drive/v3/files/file-1?alt=media',
      exportMimeType: null,
    });
  });

  it('appends export extension when missing', () => {
    expect(ensureFileExtension('Quarterly plan', '.pdf')).toBe(
      'Quarterly plan.pdf',
    );
  });

  it('keeps existing extension', () => {
    expect(ensureFileExtension('Quarterly plan.PDF', '.pdf')).toBe(
      'Quarterly plan.PDF',
    );
  });

  it('defaults to "document" for empty filename', () => {
    expect(ensureFileExtension('', '.pdf')).toBe('document.pdf');
  });

  it('builds export URL for Google Sheets', () => {
    expect(
      buildDriveDownloadRequest(
        'sheet-1',
        'application/vnd.google-apps.spreadsheet',
      ),
    ).toEqual({
      url: 'https://www.googleapis.com/drive/v3/files/sheet-1/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet',
      exportMimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  });

  it('encodes URL-unsafe characters in file IDs', () => {
    expect(
      buildDriveDownloadRequest('file/id+special', 'application/pdf'),
    ).toEqual({
      url: 'https://www.googleapis.com/drive/v3/files/file%2Fid%2Bspecial?alt=media',
      exportMimeType: null,
    });
  });
});
