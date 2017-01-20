import * as _ from "lodash";

import { ISwaggerEndpoint } from "../../common/interfaces";
import { KeyedCollection } from "../../common/utilities";
import { images } from "./images";

const allRoutes = {};
const allServices = [];

_.merge(allRoutes, images.routes);
allServices.push(images.get);

export const api = (options) => {
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

class SwaggerEndpointDictionary extends KeyedCollection<ISwaggerEndpoint> {};

export const services: SwaggerEndpointDictionary = new SwaggerEndpointDictionary();

services.add("images", images);
