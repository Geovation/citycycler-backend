import * as _ from "lodash";

// local modules
import { ISwaggerEndpoint } from "../../../common/interfaces";
import { get } from "./get";

const endpoint = "/images";

const paths = {};
paths[endpoint] = {};
const defs = get.definitions;
const routes = {};

_.merge(paths[endpoint], get.paths);
_.merge(defs, get.definitions);
_.merge(routes, get.routes);

export const images: ISwaggerEndpoint = {
    definitions: defs,
    endpoint,
    get: get.get,
    paths,
    routes,
};
