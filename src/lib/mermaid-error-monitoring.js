import './error-monitoring';
import { captureException } from '@sentry/browser';
import { isProductionHost } from './error-monitoring-config';
import { rememberDiagramError } from './mermaid-error-context';

export function reportMermaidError(error, diagram) {
  if (!isProductionHost(window.location.hostname)) return;
  if (rememberDiagramError(error, diagram, document)) captureException(error);
}
