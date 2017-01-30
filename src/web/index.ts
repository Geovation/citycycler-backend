/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as promisify from "es6-promisify";
import * as EventEmitter from "events";
import * as http from "http";
import * as logger from "winston";

// local modules
import { config } from "../config";
import { app, setupServer } from "./server";

class AppEmitter extends EventEmitter {};
const appEmitter = new AppEmitter();

export default function (): void {
    setupServer(appEmitter);

    const server: http.Server = http.createServer(app.callback());

    const serverListen: Function = promisify(server.listen, server);

    appEmitter.on("ready", () => {
        logger.info("server starting");
        serverListen(config.server.port)
            .then(() => {
                logger.info(`App is listening on port ${config.server.port}`);
                logger.info("Press CtrlC to quit.");
            })
            .catch((err) => {
                logger.error("Error happened during server start", err);
                process.exit(1);
            });
    });
}
