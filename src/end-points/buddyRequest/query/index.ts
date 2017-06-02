import * as path from "path";

import { EndpointCollection } from "../../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { buddyRequestQuery } from "./query";

export const queryBuddyRequest: EndpointCollection =
    new EndpointCollection("buddyrequest/" + path.parse(__dirname).name);

// export Endpoints
queryBuddyRequest.addEndpoint(buddyRequestQuery);
