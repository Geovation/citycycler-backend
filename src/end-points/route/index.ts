import { EndpointCollection } from "../../microservices-framework/web/services/endpoint-collection";

// Import Endpoints
import { createRoute } from "./create";
import { deleteRoute } from "./delete";
import { getRouteById } from "./getById";
import { updateRoute } from "./update";

export const route: EndpointCollection = new EndpointCollection("route");

// export Endpoints
route.addEndpoint(createRoute);
route.addEndpoint(getRouteById);
route.addEndpoint(deleteRoute);
route.addEndpoint(updateRoute);
