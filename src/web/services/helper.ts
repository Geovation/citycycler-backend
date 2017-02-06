/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as _ from "lodash";
import * as Seneca from "seneca";

import { config } from "../../config";

const allServices = [];

export const registerAPI = endpointCollection => {
    _.each(endpointCollection.endpointCollections(), coll => {
        _.each(coll.endpoints(), endpoint => allServices.push(endpoint.plugin()));
    });
    const api = (options) => {
        _.each(allServices, service => service(options));

        return {
            name: "api",
            options: {},
        };
    };
    return {
        api,
        endpointCollection,
    };
};

export const registerServices = endpointCollection => {
    const options: Seneca.Options = {
        debug: {
            undead: true,
        },
        tag: "service",
    };
    const seneca = Seneca(options);
    _.each(
        endpointCollection.endpointServices(),
        service => {
            seneca.use(service, { seneca });
        }
    );
    seneca
      .listen({ pins: endpointCollection.endpointPins(), type: config.services.transport });
  };
