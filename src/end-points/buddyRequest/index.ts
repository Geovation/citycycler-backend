import { EndpointCollection } from "../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { createBuddyRequest } from "./create";
import { getReceivedBuddyRequests } from "./getReceived";
import { getSentBuddyRequests } from "./getSent";
import { updateBuddyRequestStatus } from "./status";
import { updateBuddyRequest } from "./update";

export const buddyRequest: EndpointCollection = new EndpointCollection("buddyRequest");
export const sentBuddyRequest: EndpointCollection = new EndpointCollection("buddyRequest/sent");
export const receivedBuddyRequest: EndpointCollection = new EndpointCollection("buddyRequest/received");
export const buddyRequestStatus: EndpointCollection = new EndpointCollection("buddyRequest/status");

// export Endpoints
buddyRequest.addEndpoint(createBuddyRequest);
receivedBuddyRequest.addEndpoint(getReceivedBuddyRequests);
sentBuddyRequest.addEndpoint(getSentBuddyRequests);
buddyRequest.addEndpoint(updateBuddyRequest);
buddyRequestStatus.addEndpoint(updateBuddyRequestStatus);
