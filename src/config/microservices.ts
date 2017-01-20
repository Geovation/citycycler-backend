import * as _ from "lodash";

// local modules
import { config as common } from "./components/common";
import { config as logger } from "./components/logger";

// if running separate microservices process update the package npm config value "with_services" to false
// e.g. npm config set multi-process-nodejs-example:with_services false

export default function (): IConfigurationComposite {
    return _.extend({}, common, logger);
}