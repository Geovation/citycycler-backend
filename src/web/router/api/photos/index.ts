import * as _ from "lodash";

// local modules
import { get } from "./get";

const endpoint = "/photos";

const paths = {};
paths[endpoint] = {};
const defs = get.swaggerDefs;

_.merge(paths[endpoint], get.swaggerPath);
_.merge(defs, get.swaggerDefs);

export default {
  definitions: defs,
  endpoint,
  get: get.get,
  paths,
};
