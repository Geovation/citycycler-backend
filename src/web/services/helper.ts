import * as _ from "lodash";

import { ISwaggerEndpoint } from "../../common/interfaces";
import { KeyedCollection } from "../../common/utilities";
import { config } from "../../config";

const allRoutes = {};
const allServices = [];
const allPins = [];
const methods = ["get", "post", "push", "delete"];
class SwaggerEndpointDictionary extends KeyedCollection<ISwaggerEndpoint> {};
const services: SwaggerEndpointDictionary = new SwaggerEndpointDictionary();

export const registerServices = plugins => {
    _.each(plugins, plugin => {
        _.merge(allRoutes, plugin.routes);
        allPins.push(plugin.pin);
        _.each(methods, method => {
            return _.has(plugin, method) ? allServices.push(plugin[method]) : null;
        });
        services.add(plugin.endpoint, plugin);
    });

    const api = (options) => {
        _.each(allServices, service => service(options));

        return {
            name: "api",
            options: {},
        };
    };

    const routes = [{
        map: allRoutes,
        pin: "role:api,path:*",
        prefix: config.server.prefix,
    }];

    return {
        api,
        pins: allPins,
        routes,
        services,
    };
};
