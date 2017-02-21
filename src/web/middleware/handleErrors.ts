/**
 * DO NOT TOUCH IT. Ask Paul.
 */
import * as _ from "lodash";
import * as logger from "winston";

/* tslint:disable only-arrow-functions */
export const handleErrorsFactory = () => {
    return function * (next) {
        // formats error according to Swagger error definition (web/router/swagger/index)
        const formatError = (err) => {
            logger.error("middleware handling error", err);
            this.status = err.status || err.code || 500;
            return {
                detail: (err.isJoi ? err.details : err),
                error: err.message,
                path: this.request.url,
                status: this.status,
            };
        };
        try {
            yield next;
            // deal with microservice responses
            if (this.body && _.has(this.body, "ok")) {
                if (!this.body.ok) {
                    this.body = formatError(this.body.result);
                } else {
                    this.body = _.omit(this.body, ["ok"]);
                }
            }
        } catch (err) {
            this.body = formatError(err);
        }
    };
};
/* tslint:enable only-arrow-functions */
