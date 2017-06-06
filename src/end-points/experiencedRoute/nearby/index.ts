import * as path from "path";

import { EndpointCollection } from "../../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { getNearbyRoute } from "./getNearby";

export const nearby: EndpointCollection = new EndpointCollection("experiencedRoutes/" + path.parse(__dirname).name);

// export Endpoints
nearby.addEndpoint(getNearbyRoute);
