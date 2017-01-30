const _ = require("lodash");
const path = require("path");
const servicesPath = "src/common/services/";
const endpointsPath = "src/web/services/";

module.exports = (plop) => {

    const isNotEmpty = name => value => _.isEmpty(value) ? name + " is required" : true;
    const ensurePlural = text => _.trimEnd(text, "s") + "s";

    // We declare a new generator called "module"
    plop.setGenerator( "microservice", {
        description: "Create a new microservice",
        prompts: [
            {
                type: "input",
                name: "serviceName",
                message: "What is your microservice name?",
                validate: isNotEmpty("serviceName")
            },
            {
                type: "input",
                name: "addEndpoint",
                message: "Add an API endpoint for this service?",
                default: true,
                choices: [
                    { name: "Yes", value: true },
                    { name: "No", value: false }
                ]
            },
            {
                type: "input",
                name: "endpointName",
                message: "What is your API endpoint name?",
                validate: isNotEmpty("endpointName"),
                filter: ensurePlural
            }
        ],
        actions: (data) => {
            let actions = [
                {
                    type: "add",
                    path: path.join(servicesPath, "plugins/{{camelCase serviceName}}.ts"),
                    templateFile: "plop-templates/microservice.template"
                },
                {
                    type: "modify",
                    path: path.join(servicesPath, "composer.ts"),
                    pattern: /(\/\/ IMPORT MICROSERVICES)/g,
                    template: "$1\nimport \{ {{camelCase serviceName}}, {{camelCase serviceName}}Pin \} from \"./plugins/{{camelCase serviceName}}\";\n"
                },
                {
                    type: "modify",
                    path: path.join(servicesPath, "composer.ts"),
                    pattern: /(\/\/ ADD MICROSERVICES TO EXPORT)/g,
                    template: "$1\nservices[{{camelCase serviceName}}Pin] = {{camelCase serviceName}};"
                }
            ];

            if (data.addEndpoint) {
                actions = actions.concat([
                    {
                        type: "add",
                        path: path.join(endpointsPath, "{{camelCase endpointName}}/get.ts"),
                        templateFile: "plop-templates/serviceEndpoint.template"
                    },
                    {
                        type: "add",
                        path: path.join(endpointsPath, "{{camelCase endpointName}}/index.ts"),
                        templateFile: "plop-templates/endpointIndex.template"
                    },
                    {
                        type: "modify",
                        path: path.join(endpointsPath, "index.ts"),
                        pattern: /(\/\/ IMPORT MICROSERVICES)/g,
                        template: "$1\nimport \{ {{camelCase endpointName}} \} from \"./{{camelCase endpointName}}\";\n"
                    },
                    {
                        type: "modify",
                        path: path.join(endpointsPath, "index.ts"),
                        pattern: /(\/\/ ADD MICROSERVICES TO EXPORT)/g,
                        template: "$1\nservicePlugins.push({{camelCase endpointName}});"
                    }
                ]);
            }
            return actions;
        }
    });
};