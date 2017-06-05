import { EndpointCollection } from "../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { createInexperiencedRoute } from "./create";
import { deleteInexperiencedRoute } from "./delete";
import { getInexperiencedRoutes } from "./get";
import { updateInexperiencedRoute } from "./update";

export const inexperiencedRoute: EndpointCollection = new EndpointCollection("inexperiencedRoute");

// export Endpoints
inexperiencedRoute.addEndpoint(createInexperiencedRoute);
inexperiencedRoute.addEndpoint(getInexperiencedRoutes);
inexperiencedRoute.addEndpoint(deleteInexperiencedRoute);
inexperiencedRoute.addEndpoint(updateInexperiencedRoute);
