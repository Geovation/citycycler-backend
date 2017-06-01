import * as path from "path";

import { EndpointCollection } from "../../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { query } from "./query";

export const queryBuddyRequest: EndpointCollection = new EndpointCollection(
    "buddyRequest/" + path.parse(__dirname).name);

// export Endpoints
queryBuddyRequest.addEndpoint(query);
