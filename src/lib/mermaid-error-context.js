// Only static documentation identifiers may leave the browser. Neither diagram
// source, heading text nor arbitrary URLs are used as monitoring metadata.
const diagramIds = new Map([
  ['/overview/', ['data-flow']],
  ['/sync/architecture/', ['system-overview']],
  ['/architecture/relationship-system/', ['creating-a-relationship', 'updating-a-relationship']],
]);
const contexts = new WeakMap();

export function rememberDiagramError(error, diagram, document) {
  if (!error || typeof error !== 'object') return false;
  if (contexts.has(error)) return false;
  const path = document.location.pathname;
  const page = path.endsWith('/') ? path : `${path}/`;
  const index = Array.from(document.querySelectorAll('pre.mermaid')).indexOf(diagram);
  const diagramId = diagramIds.get(page)?.[index];
  if (!diagramId) return false;
  contexts.set(error, Object.freeze({ page, diagram_id: diagramId, error_source: 'mermaid' }));
  return true;
}

export function getDiagramErrorContext(error) {
  return error && typeof error === 'object' ? contexts.get(error) : undefined;
}
