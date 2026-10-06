module.exports = {
  configure: async (strategy, fetchResource) => {
    const { default: config } = await import('lighthouse/core/config/default-config.js');
    const { default: desktop } = await import('lighthouse/core/config/desktop-config.js');
    const overrides = new Map();
    for (const [id, path] of [['RobotsTxt', 'seo/robots-txt'], ['LlmsTxt', 'agentic/llms-txt'], ['AgentResourceDiscovery', 'agentic/ard']]) {
      const { default: Gatherer } = await import('lighthouse/core/gather/gatherers/' + path + '.js');
      const instance = new Gatherer();
      const gather = instance.getArtifact;
      // CDP resource fetches bypass page interception; replace only this run's fetcher.
      instance.getArtifact = context => gather.call(instance, { ...context, driver: new Proxy(context.driver, {
        get: (target, key) => {
          if (key === 'fetcher') return { fetchResource: url => fetchResource(url, id) };
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        }
      }) });
      overrides.set(id, { instance, implementation: Gatherer });
    }
    return { ...config, settings: { ...config.settings, ...(strategy === 'desktop' ? desktop.settings : {}) },
      artifacts: config.artifacts.map(artifact => overrides.has(artifact.id) ? { ...artifact, gatherer: overrides.get(artifact.id) } : artifact) };
  }
};
