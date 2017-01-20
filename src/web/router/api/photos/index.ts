import * as _ from "lodash";

// local modules
import { ISwaggerEndpoint } from "../../../../common/interfaces";
import { get } from "./get";

const endpoint = "/photos";

const paths = {};
paths[endpoint] = {};
const defs = get.definitions;

_.merge(paths[endpoint], get.paths);
_.merge(defs, get.definitions);

export const photos: ISwaggerEndpoint = {
  definitions: defs,
  endpoint,
  get: get.get,
  paths,
};
