import * as joi from "joi";

const envVarsSchema: joi.Schema = joi.object({
    TRANSPORT: joi.string()
        .allow(["tcp", "http", "https"])
        .default("tcp"),
}).unknown().required();

const { error, value: envVars }: joi.ValidationResult<any> = joi.validate(process.env, envVarsSchema);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
    services: {
        transport: envVars.TRANSPORT,
    },
};
