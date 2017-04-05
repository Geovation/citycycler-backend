import * as path from "path";

import { EndpointCollection } from "../../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { createRouteQuery } from "./create";

export const routeQuery: EndpointCollection = new EndpointCollection("routes/" + path.parse(__dirname).name);

// export Endpoints
routeQuery.addEndpoint(createRouteQuery);
