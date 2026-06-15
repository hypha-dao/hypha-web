'use client';

type GooglePickerDoc = {
  id: string;
  name: string;
  mimeType: string;
};

type GooglePickerResponse = {
  action: string;
  docs?: GooglePickerDoc[];
};

type GooglePickerBuilder = {
  setAppId: (appId: string) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  addView: (view: unknown) => GooglePickerBuilder;
  setCallback: (
    cb: (data: GooglePickerResponse) => void,
  ) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
};

type GooglePickerApi = {
  PickerBuilder: new () => GooglePickerBuilder;
  ViewId: { DOCS: unknown };
  Action: { PICKED: string };
};

type GoogleAccountsOAuth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: { access_token?: string; error?: string }) => void;
  }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
};

type GoogleGlobal = {
  picker?: GooglePickerApi;
  accounts?: { oauth2?: GoogleAccountsOAuth2 };
};

type GapiGlobal = {
  load: (api: string, callback: () => void) => void;
};

declare global {
  interface Window {
    google?: GoogleGlobal;
    gapi?: GapiGlobal;
  }
}

const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

const GOOGLE_APPS_EXPORT: Record<
  string,
  { mimeType: string; extension: string }
> = {
  'application/vnd.google-apps.document': {
    mimeType: 'application/pdf',
    extension: '.pdf',
  },
  'application/vnd.google-apps.spreadsheet': {
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
  },
  'application/vnd.google-apps.presentation': {
    mimeType: 'application/pdf',
    extension: '.pdf',
  },
  'application/vnd.google-apps.drawing': {
    mimeType: 'application/pdf',
    extension: '.pdf',
  },
};

let gisScriptPromise: Promise<void> | null = null;
let gapiScriptPromise: Promise<void> | null = null;

function loadScript(src: string, id: string): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('document_unavailable'));
  }
  const existing = document.getElementById(id);
  if (existing) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`script_load_failed:${src}`));
    document.head.appendChild(script);
  });
}

function loadGoogleIdentityServices(): Promise<void> {
  if (!gisScriptPromise) {
    gisScriptPromise = loadScript(
      'https://accounts.google.com/gsi/client',
      'hypha-google-identity-services',
    );
  }
  return gisScriptPromise;
}

function loadGooglePickerApi(): Promise<void> {
  if (!gapiScriptPromise) {
    gapiScriptPromise = (async () => {
      await loadScript('https://apis.google.com/js/api.js', 'hypha-google-api');
      await new Promise<void>((resolve, reject) => {
        const gapi = window.gapi;
        if (!gapi?.load) {
          reject(new Error('gapi_unavailable'));
          return;
        }
        gapi.load('picker', () => resolve());
      });
    })();
  }
  return gapiScriptPromise;
}

export function isGoogleDrivePickerConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID?.trim() &&
      process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY?.trim(),
  );
}

export function ensureFileExtension(name: string, extension: string): string {
  const trimmed = name.trim() || 'document';
  if (trimmed.toLowerCase().endsWith(extension.toLowerCase())) {
    return trimmed;
  }
  return `${trimmed}${extension}`;
}

export function buildDriveDownloadRequest(
  fileId: string,
  mimeType: string,
): { url: string; exportMimeType: string | null } {
  const exportSpec = GOOGLE_APPS_EXPORT[mimeType];
  if (exportSpec) {
    const params = new URLSearchParams({ mimeType: exportSpec.mimeType });
    return {
      url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        fileId,
      )}/export?${params}`,
      exportMimeType: exportSpec.mimeType,
    };
  }
  return {
    url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      fileId,
    )}?alt=media`,
    exportMimeType: null,
  };
}

async function downloadDriveDoc(
  accessToken: string,
  doc: GooglePickerDoc,
): Promise<File> {
  const { url, exportMimeType } = buildDriveDownloadRequest(
    doc.id,
    doc.mimeType,
  );
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`drive_download_failed:${response.status}`);
  }
  const blob = await response.blob();
  const exportExtension = GOOGLE_APPS_EXPORT[doc.mimeType]?.extension;
  const fileName = exportExtension
    ? ensureFileExtension(doc.name, exportExtension)
    : doc.name;
  const type =
    exportMimeType ?? (blob.type || doc.mimeType || 'application/octet-stream');
  return new File([blob], fileName, { type });
}

async function requestDriveAccessToken(clientId: string): Promise<string> {
  await loadGoogleIdentityServices();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('google_oauth_unavailable');
  }
  return new Promise((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_READONLY_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        if (!response.access_token) {
          reject(new Error('missing_access_token'));
          return;
        }
        resolve(response.access_token);
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

async function openDrivePicker(
  accessToken: string,
  apiKey: string,
  appId?: string,
): Promise<GooglePickerDoc[]> {
  await loadGooglePickerApi();
  const pickerApi = window.google?.picker;
  if (!pickerApi) {
    throw new Error('google_picker_unavailable');
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const builder = new pickerApi.PickerBuilder()
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .addView(pickerApi.ViewId.DOCS)
      .setCallback((data) => {
        if (data.action === pickerApi.Action.PICKED) {
          if (!settled) {
            settled = true;
            resolve(data.docs ?? []);
          }
          return;
        }
        if (!settled) {
          settled = true;
          resolve([]);
        }
      });
    if (appId?.trim()) {
      builder.setAppId(appId.trim());
    }
    builder.build().setVisible(true);
    window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve([]);
      }
    }, 5 * 60 * 1000);
  });
}

export async function pickGoogleDriveFiles(): Promise<File[]> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID?.trim();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY?.trim();
  const appId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID?.trim();
  if (!clientId || !apiKey) {
    throw new Error('google_drive_not_configured');
  }
  const accessToken = await requestDriveAccessToken(clientId);
  const docs = await openDrivePicker(accessToken, apiKey, appId);
  if (docs.length === 0) {
    return [];
  }
  const files = await Promise.all(
    docs.map((doc) => downloadDriveDoc(accessToken, doc)),
  );
  return files;
}

export function filesToFileList(files: File[]): FileList {
  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }
  return transfer.files;
}
