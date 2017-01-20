// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NOTE: it should not be necessary to update this file. Endpoints should be added automatically to the router. //
// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

import * as Router from "koa-router";
import * as _ from "lodash";

// local modules
import { api } from "./api";

export const router = new Router();

// endpoints
const allowedMethods = ["get", "post", "put", "delete"];
_.each(api.values(), def => {
    _.each(_.pick(def, allowedMethods), method => router.get(`/api/v0${def.endpoint}`, method));
});
