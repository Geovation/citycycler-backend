import * as path from "path";

import { EndpointCollection } from "../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { getRoutes } from "./get";
import { matchRoute } from "./match";
import { nearby } from "./nearby";
import { routeQuery } from "./query";
import { updateRoute } from "./update";

export const route: EndpointCollection = new EndpointCollection(path.parse(__dirname).name);

// export Endpoints
route.addEndpoint(createRoute);
route.addEndpoint(getRoutes);
route.addEndpoint(deleteRoute);
route.addEndpoint(updateRoute);
route.addEndpointCollection(matchRoute);
route.addEndpointCollection(routeQuery);
route.addEndpointCollection(nearby);
