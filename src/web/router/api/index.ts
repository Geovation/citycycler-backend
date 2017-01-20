import { ISwaggerEndpoint } from "../../../common/interfaces";
import { KeyedCollection } from "../../../common/utilities";
import { photos } from "./photos";

class SwaggerEndpointDictionary extends KeyedCollection<ISwaggerEndpoint> {};

export const api: SwaggerEndpointDictionary = new SwaggerEndpointDictionary();

api.add("photos", photos);
