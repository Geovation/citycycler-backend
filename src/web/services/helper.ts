/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as _ from "lodash";

const allServices = [];

export const registerServices = apiEndpointCollection => {
    _.each(apiEndpointCollection.endpointCollections(), endpointCollection => {
        _.each(endpointCollection.endpoints(), endpoint => allServices.push(endpoint.plugin()));
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
        apiEndpointCollection,
    };
};
