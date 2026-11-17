import Page from './page';

// A hard load of an overlay URL has no `children` match under `coherence`:
// show the section behind it. `default` gets no `searchParams`: pass them empty.
export default async function Default(props: {
  params: Promise<{ id: string; lang: string }>;
}) {
  return Page({ params: props.params, searchParams: Promise.resolve({}) });
}
