/**
 * What a member asked a Context section agent to do. Only an explicit request
 * may change the shared draft; everything else is answered in the chat.
 */
export type SpaceContextAgentIntent = 'answer' | 'save_draft' | 'propose';

const L = '(?<![\\p{L}\\p{N}])';
const R = '(?![\\p{L}\\p{N}])';

function words(sources: string[]): RegExp[] {
  return sources.map((source) => new RegExp(`${L}(?:${source})${R}`, 'iu'));
}

const IT = '(?:it|this|that|this one|that one|the text|the draft)';

const PROPOSE_PATTERNS = words([
  // en
  `(?:make|create|open|start|submit|prepare|raise|draft|turn ${IT} into)\\s+(?:it\\s+|this\\s+|that\\s+)?(?:into\\s+)?(?:a|an|the)?\\s*(?:ratification\\s+)?proposal`,
  `propose\\s+${IT}`,
  `(?:send|put|take|submit)\\s+${IT}\\s+(?:up\\s+)?(?:to|for)\\s+(?:a\\s+)?(?:vote|ratification)`,
  `ratify\\s+${IT}`,
  // pt
  `(?:criar|crie|cria|fazer|faça|faz|abrir|abra|submeter|submeta|enviar|envie)\\s+(?:uma\\s+|a\\s+)?proposta`,
  `propor\\s+(?:isso|isto|o\\s+rascunho)`,
  // es
  `(?:crear|crea|hacer|haz|abrir|abre|enviar|envía|presentar|presenta)\\s+(?:una\\s+|la\\s+)?propuesta`,
  `proponer(?:lo|la)`,
  // fr
  `(?:créer|crée|créez|faire|fais|faites|ouvrir|ouvre|soumettre|soumets|soumettez)\\s+(?:une\\s+|la\\s+)?proposition`,
  // de
  `(?:erstelle|erstellen|mach|machen|reiche|einreichen|stelle|stellen|öffne|öffnen)\\s+(?:einen\\s+|den\\s+)?(?:vorschlag|antrag)`,
  `(?:vorschlag|antrag)\\s+(?:erstellen|machen|einreichen|stellen|öffnen)`,
  `zur\\s+abstimmung`,
  // nl
  `(?:maak|maken|dien|indienen|open|openen)\\s+(?:een\\s+|het\\s+)?voorstel`,
  `voorstel\\s+(?:maken|indienen|openen)`,
  // no
  `(?:lag|lage|send|opprett|opprette)\\s+(?:et\\s+)?forslag`,
  // mk
  `(?:направи|креирај|поднеси|отвори)\\s+предлог`,
]);

const SAVE_PATTERNS = words([
  // en
  'save|store',
  `keep\\s+${IT}`,
  `(?:put|write|add|use|apply|set|make|turn)\\s+(?:[^.?!\\n]{0,40}\\s)?(?:in|into|as)\\s+(?:the\\s+|a\\s+)?draft`,
  '(?:update|replace|overwrite|fill in|fill)\\s+the\\s+draft',
  // pt
  'salvar|salve|salva|guardar|guarde|gravar|grave|como rascunho|no rascunho',
  // es
  'guarda|guárdalo|guardalo|guárdala|guardala|como borrador|en el borrador',
  // fr
  'enregistrer|enregistre|enregistrez|sauvegarder|sauvegarde|sauvegardez|comme brouillon|dans le brouillon',
  // de
  'speichern|speichere|speichert|sichern|als entwurf|in den entwurf|im entwurf',
  // nl
  'opslaan|bewaren|bewaar|als concept|in het concept',
  // no
  'lagre|lagr|som utkast|i utkastet',
  // mk
  'зачувај|зачувајте|зачувај го|како нацрт',
]);

const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
const MXID_RE = /@[\w.=\-/]+:[\w.-]+/g;

/** Classify the message that mentioned the agent. Links and user ids are ignored. */
export function detectSpaceContextAgentIntent(
  message: string,
): SpaceContextAgentIntent {
  const text = message.replace(URL_RE, ' ').replace(MXID_RE, ' ');
  if (PROPOSE_PATTERNS.some((pattern) => pattern.test(text))) return 'propose';
  if (SAVE_PATTERNS.some((pattern) => pattern.test(text))) return 'save_draft';
  return 'answer';
}
