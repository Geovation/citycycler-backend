/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as Maybe from "data.maybe";
import * as _ from "lodash";
import * as Seneca from "seneca";

import { config } from "../../config";

const allServices = [];
const senecaInstances = [];

export const registerAPI = endpointCollection => {
    _.each(
        endpointCollection.endpointCollections(),
        coll => {
            _.each(
                coll.endpoints(),
                endpoint =>
                    Maybe.fromNullable(endpoint.plugin())
                        .map(plugin => allServices.push(plugin))
            );
        }
    );

    const api = (options) => {
        _.each(
            allServices,
            service => service(options)
        );

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

export const registerServices = (endpointCollection): Promise<boolean> => {
    const seneca = Seneca({
        debug: {
            undead: true,
        },
        tag: "listener",
    });
    const senecaClient = Seneca({
        debug: {
            undead: true,
        },
        tag: "client",
    });
    senecaInstances.push(seneca);
    senecaInstances.push(senecaClient);
    _.each(
        endpointCollection.endpointServices(),
        service => {
            seneca.use(service, { seneca, senecaClient });
        }
    );
    seneca
        .listen({
            pins: endpointCollection.endpointPins(),
            type: config.services.transport,
        });
    senecaClient
        .client({
            pins: endpointCollection.endpointPins(),
            type: config.services.transport,
        });
    return new Promise((resolve, reject) => {
        seneca.ready(() => {
            resolve(true);
        });
    });
};

export const closeSeneca = () => senecaInstances.map(sen => sen.close());
