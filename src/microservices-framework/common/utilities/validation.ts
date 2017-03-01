/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as joi from "joi";

interface IValidationOptions {
    value: any;
    schema: joi.Schema;
    errorMessage: string;
    errorStatus: number;
}

interface IValidationFormatOptions {
    err: any;
    message: string;
    status: number;
    value: any;
}

/** @function formatError
 *
 *  Returns an error formatted for Seneca.
 *
 *  @param     {Object}    options - The error format options object.
 *  @param     {Object}    options.error - The error to be formatted.
 *  @param     {number}    options.status - The status to be applied to the error (defaults to 500).
 *  @param     {string}    options.message - The application error message to be returned.
 *  @param     {any}       options.value - The value whose validation raised this error.
 *  @param     {boolean}   options.isJoi - Indicates whether error is a joi error.
 *
 *  @return   { Object, any}
 */
const formatError = (options: IValidationFormatOptions): joi.ValidationResult<any> => {
    options.err.status = options.status || 500;
    options.err.message = options.message;
    return {
        error: options.err,
        value: options.value,
    };
};

/** @function validate
 *
 *  Validates the provided value using Joi (https://github.com/hapijs/joi) against to the provided schema.
 *  Returns the validated value. Throws an error if validation fails.
 *
 *  @summary   Validate a value against a defined schema.
 *
 *  @param     {Object}  options - The validation options object.
 *  @param     {any}     options.value - The thing to be validated.
 *  @param     {any}     options.schema - The Joi schema against which to validate.
 *  @param     {string}  options.errorMessage - The 'human-readable' message to be assigned to the error if thrown.
 *  @param     {number}  options.errorStatus- The status to be assigned to the error if thrown
 *
 *  @return    {any}
 */
const validateAgainstJoiSchema = (options: IValidationOptions): joi.ValidationResult<any> => {
    try {
        const { error, value: result } = joi.validate<any>(<joi.Schema> options.schema, options.value);
        if (error) {
            return formatError({
                err: error,
                message: options.errorMessage,
                status: options.errorStatus,
                value: result,
            });
        } else {
            return { error: null, value: result };
        }
    } catch (err) {
        return formatError({
            err,
            message: options.errorMessage,
            status: options.errorStatus,
            value: null,
        });
    }
};

export default {
    formatError,
    validateAgainstJoiSchema,
};
