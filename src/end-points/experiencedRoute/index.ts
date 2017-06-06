import { EndpointCollection } from "../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { createExperiencedRoute } from "./create";
import { deleteExperiencedRoute } from "./delete";
import { getExperiencedRoutes } from "./get";
import { updateExperiencedRoute } from "./update";

export const experiencedRoute: EndpointCollection = new EndpointCollection("experiencedRoute");

// export Endpoints
experiencedRoute.addEndpoint(createExperiencedRoute);
experiencedRoute.addEndpoint(getExperiencedRoutes);
experiencedRoute.addEndpoint(deleteExperiencedRoute);
experiencedRoute.addEndpoint(updateExperiencedRoute);
