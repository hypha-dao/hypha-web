import { notFound } from 'next/navigation';

/**
 * Anything under a Space that is not a served section: proposal detail, voters,
 * person pages, create flows, unknown paths. They render the white-label 404;
 * links to them open the full app in a new tab (see the link guard).
 */
export default function WhiteLabelNotServed() {
  notFound();
}
