import * as joi from "joi";

const envVarsSchema: joi.Schema = joi.object({
    PORT: joi.number()
        .default(8080),
}).unknown().required();

const { error, value: envVars }: joi.ValidationResult<any> = joi.validate(process.env, envVarsSchema);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
    server: {
        port: envVars.PORT,
        prefix: "/api/v0",
    },
};
