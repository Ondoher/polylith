import Feature from './Feature.js';

export default class ConfigFeature extends Feature {
    constructor (config, root) {
        super();
        this.config = config;
        this.root = root;
    }

    async build(app) {
        var config = this.config;

        if (config.loadables && Array.isArray(config.loadables)) {
            config.loadables.forEach(function(loadable) {
                if (loadable.name && loadable.index) {
                    app.addLoadable(loadable.name, loadable.index, loadable.prefix);
                }
            }, this);
        }
        if (config.index) app.addFeatureIndex(config.index);
        if (config.config) app.addConfig(config.config, this.root);
    }
}
