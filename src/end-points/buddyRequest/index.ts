import { EndpointCollection } from "../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { createBuddyRequest } from "./create";
import { deleteBuddyRequest } from "./delete";
import { getBuddyRequests } from "./get";
import { updateBuddyRequest } from "./update";

export const buddyRequest: EndpointCollection = new EndpointCollection("buddyrequest");

// export Endpoints
buddyRequest.addEndpoint(createBuddyRequest);
buddyRequest.addEndpoint(getBuddyRequests);
buddyRequest.addEndpoint(deleteBuddyRequest);
buddyRequest.addEndpoint(updateBuddyRequest);
