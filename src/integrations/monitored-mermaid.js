import mermaid from 'astro-mermaid';

// Keep astro-mermaid's renderer, theme handling and error UI. Instrument its
// per-diagram catch, where the error can be attributed without timing guesses.
export default function monitoredMermaid(options) {
  const integration = mermaid(options);
  const setup = integration.hooks['astro:config:setup'];
  const marker = "console.error('[astro-mermaid] Mermaid rendering error for diagram:', id, error);";
  return {
    ...integration,
    hooks: {
      ...integration.hooks,
      'astro:config:setup': async (context) => {
        let instrumented = 0;
        await setup({
          ...context,
          injectScript(stage, content) {
            if (content.includes(marker)) {
              if (content.split(marker).length !== 2) throw new Error('Ambiguous Mermaid error handler');
              instrumented++;
              content = `import { reportMermaidError } from '/src/lib/mermaid-error-monitoring.js';\n${content.replace(marker, `reportMermaidError(error, diagram);\n      ${marker}`)}`;
            }
            context.injectScript(stage, content);
          },
        });
        // Dependency updates must not silently remove diagnostic attribution.
        if (instrumented !== 1) throw new Error('Mermaid error handler changed; review monitoring integration');
      },
    },
  };
}
