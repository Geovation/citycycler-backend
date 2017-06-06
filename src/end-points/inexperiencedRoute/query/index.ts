import * as path from "path";

import { EndpointCollection } from "../../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { inexperiencedRouteQuery } from "./query";

export const queryInexperiencedRoute: EndpointCollection =
    new EndpointCollection("inexperiencedRoute/" + path.parse(__dirname).name);

// export Endpoints
queryInexperiencedRoute.addEndpoint(inexperiencedRouteQuery);
