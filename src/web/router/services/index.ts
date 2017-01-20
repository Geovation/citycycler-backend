import * as _ from "lodash";

import { images } from "./images";

const allRoutes = {};
const allServices = [];

_.merge(allRoutes, images.routes);
allServices.push(images.get);

export const api = (options) => {
    const seneca = options.seneca;

    _.each(allServices, service => service(options));

    return {
        name: "api",
        options: {},
    };
};

export const routes = [{
        map: allRoutes,
        pin: "role:api,path:*",
        prefix: "/api/v0",
     }];
