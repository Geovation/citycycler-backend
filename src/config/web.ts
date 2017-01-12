import * as _ from "lodash";

import { config as common } from "config/components/common";
import { config as logger } from "config/components/logger";
import { config as server } from "config/components/server";

// if running separate microservices process update the package npm config value "with_services" to false
// e.g. npm config set multi-process-nodejs-example:with_services false

export default function (): IConfigurationComposite {
    return _.extend({}, common, logger, server);
}
