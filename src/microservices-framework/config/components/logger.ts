import * as joi from "joi";
import * as winston from "winston";

const envVarsSchema: joi.Schema = joi.object({
    LOGGER_ENABLED: joi.boolean()
        .default(true),
    LOGGER_LEVEL: joi.string()
        .allow(["error", "warn", "info", "verbose", "debug", "silly"])
        .default("info"),
}).unknown().required();

winston.addColors({
      critical: "red",
      debug: "green",
      error: "red",
      info: "cyan",
      test: "blue",
      warn: "yellow",
});

const { error, value: envVars }: joi.ValidationResult<any> = joi.validate(process.env, envVarsSchema);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
    logger: {
        enabled: envVars.LOGGER_ENABLED,
        level: envVars.LOGGER_LEVEL,
    },
};

winston.remove(winston.transports.Console);
if (config.logger.enabled) {
    winston.add(winston.transports.Console, { colorize: true, level: config.logger.level });
}
