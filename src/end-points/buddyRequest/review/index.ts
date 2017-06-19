import { EndpointCollection } from "../../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { setReview } from "./set";

export const buddyRequestReview: EndpointCollection = new EndpointCollection("buddyRequest/review");

// export Endpoints
buddyRequestReview.addEndpoint(setReview);
